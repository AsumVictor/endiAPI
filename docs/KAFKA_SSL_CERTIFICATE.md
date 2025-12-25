# Kafka SSL Certificate Setup Guide

## Understanding SSL/TLS with DigitalOcean Managed Kafka

### Good News: No Manual Certificate Needed! 🎉

**DigitalOcean Managed Kafka uses standard SSL/TLS encryption, and the `kafkajs` library automatically handles certificate validation using your system's trusted Certificate Authorities (CAs).**

You **DO NOT** need to:
- Download a certificate file
- Configure a custom CA certificate
- Manually handle certificate validation

### Why No Manual Certificate?

1. **DigitalOcean uses publicly trusted certificates**: Their Kafka brokers use SSL certificates signed by well-known Certificate Authorities (like Let's Encrypt or DigiCert)

2. **Node.js trusts these CAs by default**: Your system already has these root CAs installed

3. **KafkaJS handles everything**: The library automatically uses Node.js's built-in TLS support

### Your Current Configuration (Already Correct!)

In your `.env` file:
```env
KAFKA_BROKERS=db-kafka-ams3-04956-do-user-11896611-0.f.db.ondigitalocean.com:25073
KAFKA_USERNAME=doadmin
KAFKA_PASSWORD=YOUR_KAFKA_PASSWORD_HERE  # Replace with actual password
KAFKA_SSL=true                             # Enables SSL/TLS
KAFKA_SASL_MECHANISM=scram-sha-256        # Authentication method
```

### What You Need to Do

**1. Get Your Kafka Password from DigitalOcean:**

- Log into your DigitalOcean account
- Navigate to **Databases** → **Your Kafka Cluster**
- Go to **Connection Details** or **Users** tab
- Copy the password for the `doadmin` user
- Paste it in your `.env` file:

```env
KAFKA_PASSWORD=AVNS_abc123xyz...  # Your actual password
```

**2. Test the Connection:**

```bash
npm run kafka:test
```

This will verify:
- SSL connection works ✅
- Authentication succeeds ✅
- You can send/receive messages ✅

## How SSL Works in Your Setup

### Connection Flow:

```
Your App (Node.js)
    ↓
kafkajs library
    ↓
Node.js TLS module (uses system CAs)
    ↓
SSL/TLS Handshake
    ↓
DigitalOcean Kafka Broker (port 25073)
    ↓
Presents SSL Certificate (signed by trusted CA)
    ↓
Node.js validates certificate automatically ✅
    ↓
SASL Authentication (SCRAM-SHA-256)
    ↓
Username: doadmin
Password: YOUR_PASSWORD
    ↓
Connected! 🎉
```

### Configuration in Code

Your Kafka client is already properly configured in [src/config/kafka.ts](src/config/kafka.ts):

```typescript
const kafka = new Kafka({
  clientId: 'codeendelea-api-server',
  brokers: config.kafka.brokers,
  ssl: true,  // Enables SSL/TLS with default system CAs
  sasl: {
    mechanism: 'scram-sha-256',
    username: config.kafka.username,
    password: config.kafka.password,
  },
  // ... other settings
});
```

Setting `ssl: true` tells kafkajs to:
1. Use TLS encryption
2. Validate the server certificate
3. Use Node.js's default trusted CAs

## Troubleshooting SSL Issues

### Issue 1: SSL Handshake Failed

**Error:**
```
SSL handshake failed
unable to verify the first certificate
```

**Causes & Solutions:**

1. **Outdated Node.js or system certificates:**
   ```bash
   # Update Node.js to latest LTS
   node --version  # Should be v18 or higher

   # On macOS, update certificates:
   brew upgrade openssl

   # On Ubuntu/Debian:
   sudo apt-get update
   sudo apt-get install ca-certificates
   ```

2. **Corporate proxy or firewall blocking SSL:**
   - Check if your network requires a proxy
   - Ensure port 25073 is not blocked
   - Test from a different network

3. **System clock out of sync:**
   ```bash
   # Check system time
   date

   # SSL certificates are time-sensitive
   # Ensure your system clock is correct
   ```

### Issue 2: Certificate Verification Failed

**If you need to use a custom CA certificate** (rare, usually only for self-hosted Kafka):

You would need to modify [src/config/kafka.ts](src/config/kafka.ts):

```typescript
import fs from 'fs';

const kafka = new Kafka({
  clientId: 'codeendelea-api-server',
  brokers: config.kafka.brokers,
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync('./path/to/ca-cert.pem', 'utf-8')],
    // Only needed for self-hosted Kafka with custom CA
  },
  sasl: {
    mechanism: 'scram-sha-256',
    username: config.kafka.username,
    password: config.kafka.password,
  },
});
```

**But for DigitalOcean Managed Kafka, you don't need this!**

### Issue 3: Connection Timeout

**Error:**
```
Connection timeout
Request timed out
```

**This is NOT an SSL issue.** Check:

1. **Broker address is correct:**
   ```env
   KAFKA_BROKERS=db-kafka-ams3-04956-do-user-11896611-0.f.db.ondigitalocean.com:25073
   ```

2. **Network connectivity:**
   ```bash
   # Test if you can reach the broker
   nc -zv db-kafka-ams3-04956-do-user-11896611-0.f.db.ondigitalocean.com 25073

   # Or use telnet
   telnet db-kafka-ams3-04956-do-user-11896611-0.f.db.ondigitalocean.com 25073
   ```

3. **Firewall rules:**
   - Ensure outbound connections on port 25073 are allowed
   - Check if your hosting provider blocks Kafka ports

### Issue 4: Authentication Failed

**Error:**
```
SASL authentication failed
Authentication failed: Invalid username or password
```

**This is NOT an SSL issue.** Check:

1. **Password is correct:**
   - Copy password directly from DigitalOcean
   - Ensure no extra spaces or characters
   - Password usually starts with `AVNS_`

2. **Username is correct:**
   ```env
   KAFKA_USERNAME=doadmin  # Must be exactly this
   ```

3. **SASL mechanism matches:**
   ```env
   KAFKA_SASL_MECHANISM=scram-sha-256  # Must be exactly this
   ```

## Security Best Practices

### 1. Keep SSL Enabled

**Always** keep `KAFKA_SSL=true` in production. Never disable SSL:

```env
# ✅ GOOD - Encrypted connection
KAFKA_SSL=true

# ❌ BAD - Unencrypted connection (DO NOT USE)
KAFKA_SSL=false
```

### 2. Protect Your Password

- Never commit `.env` to git
- Use environment variables in production
- Rotate passwords regularly
- Use different passwords for dev/staging/production

### 3. Network Security

- Restrict access to Kafka cluster in DigitalOcean dashboard
- Use VPC networking if available
- Enable trusted sources/IP whitelisting

### 4. Monitor Logs

Watch for SSL/TLS errors:

```bash
# Monitor application logs
tail -f logs/combined.log | grep -i "ssl\|tls\|certificate"

# Check for authentication failures
tail -f logs/error.log | grep -i "sasl\|auth"
```

## Testing Your Setup

### 1. Quick Test

```bash
npm run kafka:test
```

**Expected output:**
```
=== Starting Kafka Connectivity Test ===
Test 1: Connecting Kafka Producer...
Producer connection status: CONNECTED ✅
Test 2: Connecting Kafka Consumer...
Consumer connection status: CONNECTED ✅
Test 3: Sending test message...
Test message sent successfully ✅
=== Kafka Connectivity Test PASSED ===
```

### 2. Verify SSL Connection

The test already validates:
- SSL handshake completes successfully
- Certificate is trusted and valid
- Encrypted connection is established

### 3. Check Logs

```bash
# Should see this in logs
tail -f logs/combined.log
```

Look for:
```json
{
  "level": "info",
  "message": "Kafka client initialized",
  "brokers": ["db-kafka-ams3-04956-do-user-11896611-0.f.db.ondigitalocean.com:25073"],
  "ssl": true,
  "saslMechanism": "scram-sha-256"
}
```

## Summary

### What's Required:

✅ **Set `KAFKA_SSL=true`** in `.env`
✅ **Add your Kafka password** from DigitalOcean
✅ **Run `npm run kafka:test`** to verify

### What's NOT Required:

❌ Download or configure SSL certificates
❌ Add custom CA certificates
❌ Modify certificate validation logic
❌ Install additional SSL tools

### The kafkajs library handles SSL automatically using your system's trusted CAs! 🎉

## Need Help?

If you encounter SSL issues:

1. Check Node.js version: `node --version` (should be v18+)
2. Update system packages and certificates
3. Test network connectivity to broker
4. Verify credentials are correct
5. Check logs for specific error messages

For DigitalOcean Managed Kafka support:
- [DigitalOcean Kafka Documentation](https://docs.digitalocean.com/products/kafka/)
- [kafkajs SSL Documentation](https://kafka.js.org/docs/configuration#ssl)
