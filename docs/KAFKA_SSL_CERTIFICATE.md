# Kafka SSL Certificate Setup Guide

## Understanding SSL/TLS with DigitalOcean Managed Kafka

### Good News: No Manual Certificate Needed! 🎉

**DigitalOcean Managed Kafka uses standard SSL/TLS encryption, and the `kafkajs` library automatically handles certificate validation using the system's trusted Certificate Authorities (CAs).**

No manual configuration needed for:
- Download a certificate file
- Configure a custom CA certificate
- Manually handle certificate validation

### Why No Manual Certificate?

1. **DigitalOcean uses publicly trusted certificates**: Their Kafka brokers use SSL certificates signed by well-known Certificate Authorities (like Let's Encrypt or DigiCert)

2. **Node.js trusts these CAs by default**: The system already has these root CAs installed

3. **KafkaJS handles everything**: The library automatically uses Node.js's built-in TLS support

### Current Configuration (Already Correct)

In the `.env` file:
```env
KAFKA_BROKERS=your-kafka-broker-hostname:25073
KAFKA_USERNAME=doadmin
KAFKA_PASSWORD=your_kafka_password_here  # Replace with actual password
KAFKA_SSL=true                             # Enables SSL/TLS
KAFKA_SASL_MECHANISM=scram-sha-256        # Authentication method
```

### Setup Steps

**1. Get Kafka Password from DigitalOcean:**

- Log into the DigitalOcean account
- Navigate to **Databases** → **Kafka Cluster**
- Go to **Connection Details** or **Users** tab
- Copy the password for the `doadmin` user
- Paste it in the `.env` file:

```env
KAFKA_PASSWORD=your_kafka_password_here  # Actual password
```

**2. Test the Connection:**

```bash
npm run kafka:test
```

This will verify:
- SSL connection works ✅
- Authentication succeeds ✅
- Messages can be sent and received ✅

## How SSL Works in This Setup

### Connection Flow:

```
Application (Node.js)
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

The Kafka client is already properly configured in [src/config/kafka.ts](src/config/kafka.ts):

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
   - Check if the network requires a proxy
   - Ensure port 25073 is not blocked
   - Test from a different network

3. **System clock out of sync:**
   ```bash
   # Check system time
   date

   # SSL certificates are time-sensitive
   # Ensure the system clock is correct
   ```

### Issue 2: Certificate Verification Failed

**For custom CA certificates** (rare, usually only for self-hosted Kafka):

Modify [src/config/kafka.ts](src/config/kafka.ts):

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

**Note:** DigitalOcean Managed Kafka doesn't require this configuration.

### Issue 3: Connection Timeout

**Error:**
```
Connection timeout
Request timed out
```

**This is NOT an SSL issue.** Check:

1. **Broker address is correct:**
   ```env
   KAFKA_BROKERS=your-kafka-broker-hostname:25073
   ```

2. **Network connectivity:**
   ```bash
   # Test broker connectivity
   nc -zv your-kafka-broker-hostname 25073

   # Or use telnet
   telnet your-kafka-broker-hostname 25073
   ```

3. **Firewall rules:**
   - Ensure outbound connections on port 25073 are allowed
   - Check if the hosting provider blocks Kafka ports

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
   - Password format (check DigitalOcean for exact format)

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

### 2. Protect the Password

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

## Testing the Setup

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
  "brokers": ["your-kafka-broker-hostname:25073"],
  "ssl": true,
  "saslMechanism": "scram-sha-256"
}
```

## Summary

### What's Required:

✅ **Set `KAFKA_SSL=true`** in `.env`
✅ **Add the Kafka password** from DigitalOcean
✅ **Run `npm run kafka:test`** to verify

### What's NOT Required:

❌ Download or configure SSL certificates
❌ Add custom CA certificates
❌ Modify certificate validation logic
❌ Install additional SSL tools

### The kafkajs library handles SSL automatically using the system's trusted CAs! 🎉

## Need Help?

For SSL issues:

1. Check Node.js version: `node --version` (should be v18+)
2. Update system packages and certificates
3. Test network connectivity to broker
4. Verify credentials are correct
5. Check logs for specific error messages

For DigitalOcean Managed Kafka support:
- [DigitalOcean Kafka Documentation](https://docs.digitalocean.com/products/kafka/)
- [kafkajs SSL Documentation](https://kafka.js.org/docs/configuration#ssl)
