# Bron Vault API Guide

Complete guide for integrating with Bron Vault using the external API.

## Overview

Bron Vault provides a RESTful API for programmatic access to upload and manage stealer logs. The API uses API key authentication for secure access.

---

## Authentication

### API Keys

API keys are used to authenticate external applications and scripts.

**Format:** `bv_` followed by 64 hexadecimal characters
**Example:** `bv_a1b2c3d4e5f6...` (64 chars total)

### Getting an API Key

1. Login to Bron Vault web interface
2. Navigate to **Settings** > **API Keys**
3. Click **Create New API Key**
4. Enter a name and optional description
5. Set expiration (optional)
6. Choose permissions (or leave empty for full access)
7. **Save the key immediately** - it won't be shown again!

### Using API Keys

Include the API key in request headers:

```bash
# Method 1: X-API-Key header (recommended)
curl -H "X-API-Key: bv_your_api_key_here" ...

# Method 2: Authorization Bearer token
curl -H "Authorization: Bearer bv_your_api_key_here" ...
```

---

## API Endpoints

Base URL: `https://your-domain.com` (or `http://localhost:3000` for local development)

### 1. Upload Archive

**Endpoint:** `POST /api/v1/external/upload`

Upload an archive file for processing.

**Authentication:** API Key required

**Headers:**
- `X-API-Key` (string, required) - Your API key
- `X-Filename` (string, required) - Filename with extension
- `X-Archive-Password` (string, optional) - Password for encrypted archives
- `Content-Type` (string) - `application/octet-stream` or `multipart/form-data`

**Supported Formats:**
`.zip`, `.tar`, `.tar.gz`, `.tgz`, `.tar.bz2`, `.tbz2`, `.7z`

**Request Body:**
Binary file data

**Example (curl):**

```bash
curl -X POST https://your-domain.com/api/v1/external/upload \
  -H "X-API-Key: bv_your_api_key_here" \
  -H "X-Filename: logs.zip" \
  -H "X-Archive-Password: infected" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@logs.zip"
```

**Response (200 OK):**

```json
{
  "success": true,
  "job_id": "upload_1234567890_abc123",
  "filename": "logs.zip",
  "archive_type": ".zip",
  "size_bytes": 1048576,
  "size_mb": 1.0,
  "status_url": "/api/v1/jobs/upload_1234567890_abc123",
  "message": "Upload queued for processing"
}
```

**Error Responses:**

```json
// 401 Unauthorized
{
  "error": "Invalid or missing API key"
}

// 400 Bad Request
{
  "error": "Missing X-Filename header",
  "hint": "Provide filename with extension, e.g., 'logs.zip'"
}

// 400 Bad Request
{
  "error": "Unsupported file format. Supported formats: .zip, .tar, .tar.gz, .tgz, .tar.bz2, .tbz2, .7z",
  "filename": "logs.txt"
}
```

---

### 2. Get Job Status

**Endpoint:** `GET /api/v1/jobs/{jobId}`

Get the status of an upload job.

**Authentication:** API Key required

**Headers:**
- `X-API-Key` (string, required) - Your API key

**Example:**

```bash
curl -H "X-API-Key: bv_your_api_key_here" \
  https://your-domain.com/api/v1/jobs/upload_1234567890_abc123
```

**Response (200 OK):**

```json
{
  "success": true,
  "job": {
    "id": "upload_1234567890_abc123",
    "state": "completed",
    "progress": 100,
    "data": {
      "filename": "logs.zip",
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
- `waiting` - In queue, not started yet
- `active` - Currently processing
- `completed` - Successfully completed
- `failed` - Processing failed
- `delayed` - Delayed retry

---

### 3. List API Keys

**Endpoint:** `GET /api/v1/api-keys`

List all API keys for your account.

**Authentication:** JWT (web UI only, not API key)

**Response:**

```json
{
  "success": true,
  "api_keys": [
    {
      "id": 1,
      "name": "Production Script",
      "description": "Daily automated uploads",
      "api_key_preview": "************************************a1b2c3d4",
      "is_active": true,
      "created_at": "2025-10-20T10:00:00.000Z",
      "last_used_at": "2025-10-21T08:30:00.000Z",
      "expires_at": null,
      "permissions": ["upload", "search"]
    }
  ]
}
```

---

### 4. Create API Key

**Endpoint:** `POST /api/v1/api-keys`

Create a new API key.

**Authentication:** JWT (web UI only)

**Request Body:**

```json
{
  "name": "Production Script",
  "description": "Daily automated uploads",
  "expiresInDays": 365,
  "permissions": ["upload", "search"]
}
```

**Response:**

```json
{
  "success": true,
  "api_key": "bv_a1b2c3d4e5f6...",
  "message": "API key created successfully. Save this key - you won't be able to see it again!"
}
```

---

### 5. Revoke API Key

**Endpoint:** `DELETE /api/v1/api-keys?api_key=...&permanent=false`

Revoke or delete an API key.

**Authentication:** JWT (web UI only)

**Query Parameters:**
- `api_key` (string, required) - API key to revoke
- `permanent` (boolean, optional) - If true, permanently delete; if false, just deactivate

**Example:**

```bash
curl -X DELETE \
  -H "Cookie: auth=YOUR_JWT_TOKEN" \
  "https://your-domain.com/api/v1/api-keys?api_key=bv_old_key&permanent=false"
```

**Response:**

```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

### 6. Get Queue Statistics

**Endpoint:** `GET /api/v1/queue/stats`

Get upload queue statistics.

**Authentication:** API Key required

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

## CLI Clients

### Bash Client

**Location:** `clients/bron-upload.sh`

**Installation:**

```bash
chmod +x clients/bron-upload.sh
export BRON_API_KEY="bv_your_api_key_here"
```

**Usage:**

```bash
# Basic upload
./clients/bron-upload.sh logs.zip

# Upload with password
./clients/bron-upload.sh logs.zip infected

# Custom API URL
export BRON_API_URL="https://bron.example.com"
./clients/bron-upload.sh logs.zip

# Upload and monitor
./clients/bron-upload.sh logs.zip
# Answer 'y' when asked to monitor
```

**Features:**
- ✅ Color-coded output
- ✅ Progress monitoring
- ✅ Automatic job status polling
- ✅ JSON parsing with jq (optional)
- ✅ Error handling

---

### Python Client

**Location:** `clients/bron_client.py`

**Installation:**

```bash
pip install requests
chmod +x clients/bron_client.py
export BRON_API_KEY="bv_your_api_key_here"
```

**Usage:**

```bash
# Upload file
python clients/bron_client.py upload logs.zip

# Upload with password
python clients/bron_client.py upload logs.zip --password infected

# Upload and wait for completion
python clients/bron_client.py upload logs.zip --wait

# Monitor existing job
python clients/bron_client.py monitor upload_1234567890_abc123
```

**Programmatic Usage:**

```python
from bron_client import BronVaultClient

# Initialize client
client = BronVaultClient(
    api_url="https://bron.example.com",
    api_key="bv_your_api_key_here"
)

# Upload file
result = client.upload("logs.zip", password="infected")
print(f"Job ID: {result['job_id']}")

# Monitor job
final_result = client.monitor_job(result['job_id'])
print(f"Devices processed: {final_result['job']['result']['devicesProcessed']}")

# Upload and wait (all in one)
result = client.upload_and_wait("logs.zip")
```

---

## Integration Examples

### Node.js

```javascript
const axios = require('axios');
const fs = require('fs');

async function uploadToB ronVault(filePath, apiKey, password = null) {
  const filename = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);

  const headers = {
    'X-API-Key': apiKey,
    'X-Filename': filename,
    'Content-Type': 'application/octet-stream',
  };

  if (password) {
    headers['X-Archive-Password'] = password;
  }

  const response = await axios.post(
    'https://your-domain.com/api/v1/external/upload',
    fileData,
    { headers }
  );

  return response.data;
}

// Usage
uploadToB ronVault('logs.zip', 'bv_your_api_key', 'infected')
  .then(result => console.log('Job ID:', result.job_id))
  .catch(error => console.error('Error:', error.message));
```

### Go

```go
package main

import (
    "bytes"
    "fmt"
    "io"
    "net/http"
    "os"
    "path/filepath"
)

func uploadToBronVault(filePath, apiKey, password string) error {
    file, err := os.Open(filePath)
    if err != nil {
        return err
    }
    defer file.Close()

    filename := filepath.Base(filePath)

    req, err := http.NewRequest("POST",
        "https://your-domain.com/api/v1/external/upload", file)
    if err != nil {
        return err
    }

    req.Header.Set("X-API-Key", apiKey)
    req.Header.Set("X-Filename", filename)
    req.Header.Set("Content-Type", "application/octet-stream")

    if password != "" {
        req.Header.Set("X-Archive-Password", password)
    }

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))

    return nil
}
```

### Ruby

```ruby
require 'net/http'
require 'json'

def upload_to_bron_vault(file_path, api_key, password = nil)
  filename = File.basename(file_path)
  file_data = File.binread(file_path)

  uri = URI('https://your-domain.com/api/v1/external/upload')
  request = Net::HTTP::Post.new(uri)
  request['X-API-Key'] = api_key
  request['X-Filename'] = filename
  request['Content-Type'] = 'application/octet-stream'
  request['X-Archive-Password'] = password if password

  request.body = file_data

  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
    http.request(request)
  end

  JSON.parse(response.body)
end

# Usage
result = upload_to_bron_vault('logs.zip', 'bv_your_api_key', 'infected')
puts "Job ID: #{result['job_id']}"
```

---

## Permissions

API keys support granular permissions:

| Permission | Description |
|------------|-------------|
| `upload` | Upload archive files |
| `search` | Search credentials |
| `download` | Download device data |
| `stats` | View statistics |
| `admin` | Full admin access |

**Empty permissions = Full access**

---

## Rate Limits

Current rate limits per API key:

| Endpoint | Limit |
|----------|-------|
| `/api/v1/external/upload` | 10 uploads / hour |
| `/api/v1/jobs/*` | 100 requests / minute |
| `/api/v1/queue/stats` | 60 requests / minute |

Rate limit headers:
- `X-RateLimit-Limit` - Total requests allowed
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Reset timestamp

---

## Best Practices

### 1. Secure API Keys

```bash
# ✅ Good: Store in environment variable
export BRON_API_KEY="bv_..."

# ✅ Good: Use secrets manager
aws secretsmanager get-secret-value --secret-id bron-api-key

# ❌ Bad: Hardcode in scripts
API_KEY="bv_..."  # DON'T DO THIS
```

### 2. Handle Errors Gracefully

```python
try:
    result = client.upload("logs.zip")
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 401:
        print("Invalid API key")
    elif e.response.status_code == 429:
        print("Rate limit exceeded")
    else:
        print(f"Error: {e}")
```

### 3. Monitor Job Progress

```bash
# Don't spam the status endpoint
sleep 2  # Poll every 2 seconds, not every 100ms
```

### 4. Use Expiring Keys

Create API keys with expiration dates for temporary access:

```json
{
  "name": "Temp Key for Contractor",
  "expiresInDays": 30
}
```

### 5. Rotate Keys Regularly

```bash
# Create new key
NEW_KEY=$(curl -X POST /api/v1/api-keys ...)

# Update application
export BRON_API_KEY="$NEW_KEY"

# Revoke old key
curl -X DELETE "/api/v1/api-keys?api_key=$OLD_KEY"
```

---

## Troubleshooting

### Invalid API Key

**Error:** `401 Unauthorized - Invalid or missing API key`

**Solutions:**
1. Check API key format (starts with `bv_`)
2. Verify key is active (not revoked)
3. Check expiration date
4. Ensure correct header name (`X-API-Key`)

### Upload Fails

**Error:** `400 Bad Request - Unsupported file format`

**Solutions:**
1. Check file extension is supported
2. Verify `X-Filename` header is set
3. Ensure file is not corrupted

### Job Stuck in "active" State

**Solutions:**
1. Check worker is running: `npm run worker`
2. View worker logs for errors
3. Check Redis is running
4. Wait longer (large files take time)

---

## API Changelog

### v1.0.0 (Current)
- ✅ API key authentication
- ✅ External upload endpoint
- ✅ Job status monitoring
- ✅ Multi-format archive support
- ✅ Password-protected archives
- ✅ Chunked uploads
- ✅ Queue statistics

### Planned Features
- ⏳ Search API
- ⏳ Download API
- ⏳ Webhook notifications
- ⏳ GraphQL endpoint

---

For additional help, see the main README or open an issue on GitHub.
