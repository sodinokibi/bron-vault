# Quick Start: Large File Upload

Get started with large file uploads in 5 minutes.

## 1. Install Redis

```bash
# Using Docker (easiest)
docker run -d --name redis -p 6379:6379 redis:latest

# Test Redis
docker exec -it redis redis-cli ping
# Should return: PONG
```

## 2. Update Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env and add:
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key-at-least-32-characters-long
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Start Services

Open **two terminals**:

**Terminal 1 - Next.js Server:**
```bash
npm run dev
```

**Terminal 2 - Background Worker:**
```bash
npm run worker
```

You should see:
```
✅ Redis connected successfully
✅ Worker started successfully!
👀 Watching for upload jobs...
```

## 5. Upload a Large File

### Option A: Web Interface

1. Login to Bron Vault
2. Navigate to Upload page
3. Drag and drop a large ZIP file (>100MB)
4. File will automatically queue for background processing
5. You'll see: "Upload queued for processing"
6. Monitor job status in the UI

### Option B: Using curl

```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.token')

# Upload file
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: auth=$TOKEN" \
  -F "file=@large_file.zip" \
  -F "async=true"

# Check job status (replace JOB_ID)
curl -H "Cookie: auth=$TOKEN" \
  http://localhost:3000/api/v1/jobs/JOB_ID
```

## 6. Monitor Progress

### Check Queue Stats
```bash
curl -H "Cookie: auth=$TOKEN" \
  http://localhost:3000/api/v1/queue/stats
```

### Watch Worker Logs
The worker terminal will show real-time progress:
```
🚀 Processing upload job upload_123_abc: large_file.zip
📊 [Job upload_123_abc] Progress 15%: Processing device 5/30
📊 [Job upload_123_abc] Progress 50%: Processing device 15/30
✅ Upload job upload_123_abc completed successfully
```

## That's It!

Your large file upload system is now ready. Files over 100MB will automatically queue for background processing.

## Next Steps

- Read [LARGE_FILE_UPLOAD.md](./LARGE_FILE_UPLOAD.md) for detailed documentation
- Set up PM2 for production deployment
- Configure chunked upload for files > 1GB
- Implement external API integrations

## Troubleshooting

**Worker won't start?**
- Make sure Redis is running: `docker ps | grep redis`
- Check Redis connection: `redis-cli ping`

**Jobs not processing?**
- Check worker is running in second terminal
- View queue stats: `curl http://localhost:3000/api/v1/queue/stats`

**Need help?**
- See [LARGE_FILE_UPLOAD.md](./LARGE_FILE_UPLOAD.md) for detailed troubleshooting
- Check worker logs for error messages
