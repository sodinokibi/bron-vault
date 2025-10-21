# Large File Upload Guide

This guide explains how to upload and process large stealer log files (1-5 GB+) using Bron Vault's background job queue system.

## Overview

Bron Vault now supports three methods for uploading files:

1. **Synchronous Upload** - For small files (<100MB), processed immediately
2. **Asynchronous Upload** - For large files (>100MB), queued for background processing
3. **Chunked Upload** - For very large files (1GB+), uploaded in chunks

## Prerequisites

### Required Services

1. **Redis** - Required for background job queue
   ```bash
   # Using Docker (recommended)
   docker run -d --name redis -p 6379:6379 redis:latest

   # Or install locally
   # Ubuntu/Debian
   sudo apt-get install redis-server

   # macOS
   brew install redis
   brew services start redis
   ```

2. **MySQL/MariaDB** - Already required for Bron Vault

### Environment Variables

Update your `.env` file with Redis configuration:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty if no password

# JWT Secret (required for security)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
```

## Running the Worker

The background worker processes upload jobs from the queue.

### Start the Worker

```bash
# Production
npm run worker

# Development (with auto-reload)
npm run worker:dev
```

The worker should show:
```
🚀 Starting Bron Vault Upload Worker...
✅ Redis connected successfully
🗄️ Initializing database...
✅ Worker started successfully!
👀 Watching for upload jobs...
```

### Worker Management

**Keep the worker running** alongside your Next.js server:

```bash
# Terminal 1: Next.js server
npm run dev

# Terminal 2: Worker
npm run worker
```

For production, use a process manager like **PM2**:

```bash
# Install PM2
npm install -g pm2

# Start Next.js
pm2 start npm --name "bron-vault" -- start

# Start worker
pm2 start npm --name "bron-vault-worker" -- run worker

# Save configuration
pm2 save

# Set up auto-start on boot
pm2 startup
```

---

## Upload Methods

### Method 1: Automatic Async (Recommended for Large Files)

Files over 100MB are automatically queued for background processing.

**Web UI:**
```typescript
// Just upload normally, large files auto-queue
const formData = new FormData()
formData.append('file', file)
formData.append('sessionId', sessionId)

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
})

const result = await response.json()
if (result.async) {
  // File was queued
  console.log('Job ID:', result.jobId)
  console.log('Status URL:', result.statusUrl)
}
```

**Force Async Mode:**
```typescript
// Force async for any file size
formData.append('async', 'true')
```

### Method 2: Chunked Upload (For Files > 1GB)

Upload large files in chunks to avoid timeout issues.

**Example Implementation:**

```typescript
// lib/chunked-uploader.ts
export class ChunkedUploader {
  private chunkSize = 50 * 1024 * 1024 // 50MB chunks

  async upload(
    file: File,
    onProgress: (percent: number) => void
  ): Promise<string> {
    const uploadId = crypto.randomUUID()
    const totalChunks = Math.ceil(file.size / this.chunkSize)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize
      const end = Math.min(start + this.chunkSize, file.size)
      const chunk = file.slice(start, end)

      const response = await fetch('/api/v1/upload/chunked', {
        method: 'POST',
        headers: {
          'X-Upload-ID': uploadId,
          'X-Chunk-Number': i.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'X-Filename': file.name,
        },
        body: chunk,
      })

      const result = await response.json()

      if (result.status === 'complete') {
        return result.jobId
      }

      onProgress((i + 1) / totalChunks * 100)
    }

    throw new Error('Upload incomplete')
  }
}

// Usage
const uploader = new ChunkedUploader()
const jobId = await uploader.upload(file, (progress) => {
  console.log(`Upload progress: ${progress}%`)
})
```

### Method 3: External Programs (CLI/Scripts)

Upload from external programs using the API.

**Bash Script:**

```bash
#!/bin/bash
# upload.sh

FILE_PATH="$1"
API_URL="http://localhost:3000/api/upload"

# Get auth token (login first)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' \
  | jq -r '.token')

# Upload file
RESPONSE=$(curl -X POST "$API_URL" \
  -H "Cookie: auth=$TOKEN" \
  -F "file=@$FILE_PATH" \
  -F "async=true")

echo "$RESPONSE" | jq .

# Extract job ID
JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId')
echo "Job ID: $JOB_ID"

# Poll for status
while true; do
  STATUS=$(curl -s -H "Cookie: auth=$TOKEN" \
    "http://localhost:3000/api/v1/jobs/$JOB_ID")

  STATE=$(echo "$STATUS" | jq -r '.job.state')
  PROGRESS=$(echo "$STATUS" | jq -r '.job.progress')

  echo "Status: $STATE | Progress: $PROGRESS%"

  if [ "$STATE" = "completed" ] || [ "$STATE" = "failed" ]; then
    echo "Final result:"
    echo "$STATUS" | jq .
    break
  fi

  sleep 2
done
```

**Python Script:**

```python
#!/usr/bin/env python3
# upload.py

import requests
import time
import sys

class BronVaultUploader:
    def __init__(self, base_url, username, password):
        self.base_url = base_url
        self.session = requests.Session()
        self.login(username, password)

    def login(self, username, password):
        response = self.session.post(
            f'{self.base_url}/api/auth/login',
            json={'username': username, 'password': password}
        )
        response.raise_for_status()
        print("✅ Logged in successfully")

    def upload(self, file_path):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'async': 'true'}

            print(f"📤 Uploading {file_path}...")
            response = self.session.post(
                f'{self.base_url}/api/upload',
                files=files,
                data=data
            )
            response.raise_for_status()
            result = response.json()

            if result.get('async'):
                job_id = result['jobId']
                print(f"📋 Job queued: {job_id}")
                return self.wait_for_job(job_id)
            else:
                return result

    def wait_for_job(self, job_id):
        print(f"⏳ Waiting for job {job_id} to complete...")

        while True:
            response = self.session.get(
                f'{self.base_url}/api/v1/jobs/{job_id}'
            )
            response.raise_for_status()
            status = response.json()

            job = status['job']
            state = job['state']
            progress = job.get('progress', 0)

            print(f"   {state.upper()} | Progress: {progress}%")

            if state in ['completed', 'failed']:
                return job

            time.sleep(2)

# Usage
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python upload.py <file_path>")
        sys.exit(1)

    uploader = BronVaultUploader(
        'http://localhost:3000',
        'admin',
        'your-password'
    )

    result = uploader.upload(sys.argv[1])
    print("Final result:", result)
```

---

## Monitoring Jobs

### Check Job Status

```bash
# Get job status
curl -H "Cookie: auth=YOUR_TOKEN" \
  http://localhost:3000/api/v1/jobs/JOB_ID
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "upload_1234567890_abc123",
    "state": "completed",
    "progress": 100,
    "data": {
      "filename": "large_stealer_logs.zip",
      "uploadBatch": "batch_1234567890_xyz789"
    },
    "result": {
      "success": true,
      "devicesProcessed": 45,
      "totalFiles": 2341,
      "totalCredentials": 15678,
      "totalDomains": 892,
      "totalUrls": 1543
    },
    "timestamps": {
      "created": 1234567890000,
      "started": 1234567891000,
      "finished": 1234567950000
    }
  }
}
```

**Job States:**
- `waiting` - In queue, not started
- `active` - Currently processing
- `completed` - Successfully processed
- `failed` - Processing failed
- `delayed` - Delayed retry

### Queue Statistics

```bash
curl -H "Cookie: auth=YOUR_TOKEN" \
  http://localhost:3000/api/v1/queue/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "waiting": 3,
    "active": 2,
    "completed": 127,
    "failed": 1,
    "delayed": 0,
    "total": 133
  },
  "timestamp": "2025-10-21T10:30:00.000Z"
}
```

---

## Configuration

### Worker Concurrency

Edit `lib/upload-queue.ts`:

```typescript
const uploadWorker = new Worker(
  "uploads",
  processFunction,
  {
    connection,
    concurrency: 2, // Process 2 uploads simultaneously (adjust based on resources)
    limiter: {
      max: 5,      // Max 5 jobs
      duration: 60000, // per minute
    },
  },
)
```

**Recommendations:**
- **2 concurrent jobs** for 8GB RAM
- **4 concurrent jobs** for 16GB RAM
- **8 concurrent jobs** for 32GB+ RAM

### Chunk Size

Edit `next.config.mjs`:

```javascript
publicRuntimeConfig: {
  maxChunkSize: 52428800, // 50MB (default)
  // For slower connections: 10485760 (10MB)
  // For faster connections: 104857600 (100MB)
},
```

### Job Retention

Edit `lib/upload-queue.ts`:

```typescript
defaultJobOptions: {
  removeOnComplete: {
    age: 86400,    // Keep completed jobs for 24 hours
    count: 100,    // Keep last 100 completed jobs
  },
  removeOnFail: {
    age: 604800,   // Keep failed jobs for 7 days
  },
}
```

---

## Troubleshooting

### Redis Connection Failed

**Error:** `❌ Redis connection error: connect ECONNREFUSED`

**Solution:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start Redis
docker start redis
# OR
sudo systemctl start redis
```

### Worker Not Processing Jobs

**Check:**
1. Worker is running: `npm run worker`
2. Redis is connected (check worker logs)
3. Jobs are in queue:
   ```bash
   curl http://localhost:3000/api/v1/queue/stats
   ```

### Upload Timeout

For files larger than expected, increase Next.js timeout:

```typescript
// app/api/upload/route.ts
export const maxDuration = 600 // 10 minutes
```

### Out of Memory

**Reduce worker concurrency** in `lib/upload-queue.ts`:
```typescript
concurrency: 1, // Process one at a time
```

### Job Stuck in "Active" State

Restart the worker:
```bash
# Ctrl+C to stop
npm run worker
```

Or manually fail the job:
```bash
curl -X DELETE \
  -H "Cookie: auth=YOUR_TOKEN" \
  http://localhost:3000/api/v1/jobs/JOB_ID
```

---

## Best Practices

1. **Always run the worker** when expecting large file uploads
2. **Monitor queue stats** to ensure jobs are processing
3. **Use chunked upload** for files over 1GB
4. **Set up PM2** for production to auto-restart worker
5. **Monitor disk space** - extracted files can be large
6. **Configure retention policies** to prevent queue bloat
7. **Use Redis persistence** to survive restarts:
   ```bash
   # In redis.conf
   save 900 1
   save 300 10
   save 60 10000
   ```

---

## Performance Benchmarks

Typical processing times (on 8GB RAM, 4 CPU cores):

| File Size | Method | Upload Time | Processing Time | Total Time |
|-----------|--------|-------------|-----------------|------------|
| 50 MB     | Sync   | 5s          | 20s             | 25s        |
| 200 MB    | Async  | 15s         | 60s             | 75s        |
| 1 GB      | Chunked| 60s         | 300s            | 360s       |
| 5 GB      | Chunked| 300s        | 1200s           | 1500s      |

---

## API Reference

### POST /api/upload
Upload file (sync or async based on size)

**Parameters:**
- `file` (File) - The ZIP file
- `async` (string, optional) - "true" to force async
- `sessionId` (string, optional) - For SSE logs

**Response (Async):**
```json
{
  "success": true,
  "async": true,
  "jobId": "upload_123_abc",
  "message": "Upload queued for processing",
  "statusUrl": "/api/v1/jobs/upload_123_abc"
}
```

### POST /api/v1/upload/chunked
Upload file in chunks

**Headers:**
- `X-Upload-ID` - Unique upload identifier
- `X-Chunk-Number` - Current chunk (0-indexed)
- `X-Total-Chunks` - Total number of chunks
- `X-Filename` - Original filename
- `X-Chunk-Hash` (optional) - SHA256 hash for integrity

**Response (Final Chunk):**
```json
{
  "success": true,
  "uploadId": "uuid",
  "jobId": "upload_123_abc",
  "status": "complete",
  "statusUrl": "/api/v1/jobs/upload_123_abc"
}
```

### GET /api/v1/jobs/[jobId]
Get job status

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "upload_123_abc",
    "state": "completed",
    "progress": 100,
    "result": { ... }
  }
}
```

### GET /api/v1/queue/stats
Get queue statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "waiting": 0,
    "active": 1,
    "completed": 42
  }
}
```

---

For additional help, see the main README or open an issue on GitHub.
