# Kafka Setup Checklist ✅

Use this checklist to ensure the Kafka integration is properly configured.

## Step 1: Get Kafka Password from DigitalOcean

- [ ] Log into DigitalOcean dashboard
- [ ] Navigate to: **Databases** → **Kafka Cluster**
- [ ] Go to **Connection Details** or **Users** tab
- [ ] Copy the password for `doadmin` user
- [ ] Password format (usually starts with specific prefix)

## Step 2: Update .env File

The `.env` file should have these lines:

```env
# Kafka Configuration
KAFKA_BROKERS=your-kafka-broker-hostname:25073
KAFKA_USERNAME=doadmin
KAFKA_PASSWORD=your_kafka_password_here  # ← PASTE PASSWORD HERE
KAFKA_PRODUCE_TOPIC=Transcribe
KAFKA_CONSUME_TOPIC=update_transcribe
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_CONNECTION_TIMEOUT=10000
KAFKA_REQUEST_TIMEOUT=30000
```

**Checklist:**
- [ ] `.env` file exists in project root
- [ ] `KAFKA_PASSWORD` is filled with the actual password
- [ ] No extra spaces or quotes around the password
- [ ] `KAFKA_SSL=true` (not false)
- [ ] All other Kafka variables are present

## Step 3: Verify SSL Certificate (Automatic!)

**Note:** SSL certificates are handled automatically.

- [x] kafkajs library handles SSL automatically
- [x] Uses Node.js system certificates
- [x] DigitalOcean uses publicly trusted CAs
- [x] No manual certificate configuration needed

**Just ensure:**
- [ ] Node.js version is v18 or higher: `node --version`
- [ ] System certificates are up to date

## Step 4: Test Kafka Connection

Run the connectivity test:

```bash
npm run kafka:test
```

**Expected results:**
- [ ] ✅ Producer connects successfully
- [ ] ✅ Consumer connects successfully
- [ ] ✅ Test message is sent
- [ ] ✅ Consumer subscribes to topic
- [ ] ✅ No SSL/TLS errors
- [ ] ✅ No authentication errors

**If test fails, check:**
- [ ] Password is correct (no typos)
- [ ] Network allows connections to port 25073
- [ ] `.env` file is in the correct location
- [ ] No firewall blocking the connection

## Step 5: Create Kafka Topics in DigitalOcean

Ensure these topics exist in the Kafka cluster:

- [ ] Topic: `Transcribe` (producer sends here)
- [ ] Topic: `update_transcribe` (consumer reads from here)

**How to create topics:**
1. Go to DigitalOcean dashboard
2. Navigate to the Kafka cluster
3. Go to **Topics** tab
4. Click **Create Topic**
5. Create both topics with default settings

## Step 6: Start the Consumer Worker

For development (foreground):
```bash
npm run kafka:consumer
```

- [ ] Consumer starts without errors
- [ ] Logs show "Kafka consumer connected"
- [ ] Consumer is listening for messages

For production (background with PM2):
```bash
npm install -g pm2
pm2 start npm --name "kafka-consumer" -- run kafka:consumer
pm2 save
pm2 startup
```

- [ ] PM2 installed
- [ ] Consumer running in background
- [ ] Consumer auto-starts on server reboot

## Step 7: Test Sending a Message

In code, test sending a transcription request:

```typescript
import { kafkaProducer } from './services/kafka-producer';

await kafkaProducer.sendTranscriptionRequest({
  video_id: 'test-video-123',
  video_url: 'https://example.com/test.mp4',
  metadata: {
    title: 'Test Video',
  },
});
```

**Verify:**
- [ ] Message sends without errors
- [ ] Check logs: `tail -f logs/combined.log`
- [ ] Should see: "Transcription request sent to Kafka"

## Step 8: Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Never commit passwords to git
- [ ] `KAFKA_SSL=true` is always enabled
- [ ] Strong, unique Kafka password
- [ ] Regular password rotation schedule

## Troubleshooting Reference

### Connection Issues
```bash
# Test network connectivity
nc -zv your-kafka-broker-hostname 25073

# Check if port is accessible
telnet your-kafka-broker-hostname 25073
```

### View Logs
```bash
# All logs
tail -f logs/combined.log

# Only errors
tail -f logs/error.log

# Filter Kafka logs
grep "Kafka" logs/combined.log
```

### Common Errors

| Error | Solution |
|-------|----------|
| Connection timeout | Check network/firewall, verify broker address |
| Authentication failed | Verify password, check username is `doadmin` |
| SSL handshake failed | Update Node.js and system certificates |
| Topic not found | Create topics in DigitalOcean dashboard |

## Quick Reference Commands

```bash
# Test connection
npm run kafka:test

# Start consumer (dev)
npm run kafka:consumer

# Start consumer (production)
pm2 start npm --name "kafka-consumer" -- run kafka:consumer

# View consumer logs
pm2 logs kafka-consumer

# Stop consumer
pm2 stop kafka-consumer

# Restart consumer
pm2 restart kafka-consumer

# Check app logs
tail -f logs/combined.log | grep -i kafka
```

## Documentation Links

- [KAFKA_QUICK_START.md](KAFKA_QUICK_START.md) - Quick start guide
- [KAFKA_SETUP.md](KAFKA_SETUP.md) - Complete documentation
- [KAFKA_SSL_CERTIFICATE.md](KAFKA_SSL_CERTIFICATE.md) - SSL/TLS guide

## Final Verification

Before going to production, verify:

- [ ] All items in this checklist are complete
- [ ] Test passes: `npm run kafka:test`
- [ ] Consumer worker is running
- [ ] Can send test messages successfully
- [ ] Can receive messages in consumer
- [ ] Logs show no errors
- [ ] `.env` file is secure and not committed
- [ ] Kafka topics are created
- [ ] Production credentials are different from dev

---

## Current Status

**What's configured:**
✅ kafkajs installed
✅ Configuration files created
✅ Producer service ready
✅ Consumer service ready
✅ Test scripts available
✅ Documentation complete

**Next steps:**
1. Add the Kafka password to `.env`
2. Run `npm run kafka:test`
3. Create topics in DigitalOcean
4. Start the consumer worker

**Need help?** Review the documentation or run the test script for diagnostics.
