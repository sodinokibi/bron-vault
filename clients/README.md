# Bron Vault API Clients

Official CLI clients for uploading stealer logs to Bron Vault.

## Available Clients

### 1. Bash Client (`bron-upload.sh`)

Shell script for Unix/Linux/macOS systems.

**Requirements:**
- `curl`
- `jq` (optional, for better output)

**Setup:**

```bash
chmod +x bron-upload.sh
export BRON_API_KEY="bv_your_api_key_here"
```

**Usage:**

```bash
# Basic upload
./bron-upload.sh logs.zip

# Upload with password
./bron-upload.sh logs.zip infected

# Custom API URL
export BRON_API_URL="https://bron.example.com"
./bron-upload.sh logs.zip
```

---

### 2. Python Client (`bron_client.py`)

Python script with programmatic API.

**Requirements:**
- Python 3.6+
- `requests` library

**Setup:**

```bash
pip install requests
chmod +x bron_client.py
export BRON_API_KEY="bv_your_api_key_here"
```

**CLI Usage:**

```bash
# Upload file
python bron_client.py upload logs.zip

# Upload with password
python bron_client.py upload logs.zip --password infected

# Upload and wait for completion
python bron_client.py upload logs.zip --wait

# Monitor existing job
python bron_client.py monitor upload_1234567890_abc123
```

**Programmatic Usage:**

```python
from bron_client import BronVaultClient

client = BronVaultClient(
    api_url="https://bron.example.com",
    api_key="bv_your_api_key_here"
)

# Upload and wait
result = client.upload_and_wait("logs.zip", password="infected")
print(f"Processed {result['job']['result']['devicesProcessed']} devices")
```

---

## Getting an API Key

1. Login to Bron Vault web interface
2. Go to **Settings** > **API Keys**
3. Click **Create New API Key**
4. Enter a name (e.g., "CLI Upload Script")
5. Set permissions (or leave empty for full access)
6. **Copy the key immediately** - it won't be shown again!

**Example:**
```bash
export BRON_API_KEY="bv_a1b2c3d4e5f6..."
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BRON_API_KEY` | Your API key (required) | None |
| `BRON_API_URL` | Bron Vault API URL | `http://localhost:3000` |

---

## Examples

### Automated Daily Upload (Cron)

```bash
#!/bin/bash
# daily-upload.sh

export BRON_API_KEY="bv_your_api_key"
export BRON_API_URL="https://bron.example.com"

LOGS_DIR="/path/to/logs"
SCRIPT_DIR="/path/to/bron-vault/clients"

# Find today's logs
TODAY=$(date +%Y-%m-%d)
LOGS_FILE="$LOGS_DIR/stealer-logs-$TODAY.zip"

if [ -f "$LOGS_FILE" ]; then
    echo "Uploading $LOGS_FILE..."
    $SCRIPT_DIR/bron-upload.sh "$LOGS_FILE" "infected"
else
    echo "No logs found for $TODAY"
fi
```

**Crontab entry:**
```cron
# Upload at 2 AM every day
0 2 * * * /path/to/daily-upload.sh >> /var/log/bron-upload.log 2>&1
```

---

### Batch Upload Multiple Files

**Bash:**
```bash
#!/bin/bash
for file in /path/to/logs/*.zip; do
    echo "Uploading $file..."
    ./bron-upload.sh "$file" "infected"
    sleep 10  # Wait between uploads
done
```

**Python:**
```python
import os
from pathlib import Path
from bron_client import BronVaultClient

client = BronVaultClient()

logs_dir = Path("/path/to/logs")
for log_file in logs_dir.glob("*.zip"):
    print(f"Uploading {log_file}...")
    result = client.upload(str(log_file), password="infected")
    print(f"Job ID: {result['job_id']}")
```

---

### Integration with Monitoring

```python
#!/usr/bin/env python3
import sys
from bron_client import BronVaultClient

def upload_and_notify(file_path, webhook_url):
    """Upload file and send webhook notification"""
    import requests

    client = BronVaultClient()

    # Upload file
    result = client.upload_and_wait(file_path)

    # Extract results
    job_result = result['job']['result']
    devices = job_result['devicesProcessed']
    credentials = job_result['totalCredentials']

    # Send notification
    notification = {
        "text": f"✅ Upload complete: {devices} devices, {credentials} credentials found",
        "file": file_path
    }
    requests.post(webhook_url, json=notification)

if __name__ == "__main__":
    upload_and_notify(sys.argv[1], "https://hooks.slack.com/...")
```

---

## Features

### Bash Client
- ✅ Color-coded output
- ✅ Progress bars
- ✅ Interactive job monitoring
- ✅ Error handling with helpful messages
- ✅ JSON parsing (with jq)

### Python Client
- ✅ Clean API interface
- ✅ Type hints
- ✅ Exception handling
- ✅ Progress monitoring
- ✅ Programmatic access
- ✅ Comprehensive error messages

---

## Troubleshooting

### "API key is required"

Set the environment variable:
```bash
export BRON_API_KEY="bv_your_key_here"
```

Or pass it directly (Python):
```python
client = BronVaultClient(api_key="bv_your_key_here")
```

### "Connection refused"

Check API URL is correct:
```bash
export BRON_API_URL="http://localhost:3000"  # Local
export BRON_API_URL="https://bron.example.com"  # Production
```

### "Unsupported file format"

Ensure file has correct extension:
- `.zip`, `.tar`, `.tar.gz`, `.tgz`, `.tar.bz2`, `.tbz2`, `.7z`

### "Invalid API key"

Check:
1. Key format (starts with `bv_`)
2. Key is not revoked
3. Key has not expired
4. Correct API URL

---

## Advanced Usage

### Custom Timeout

**Python:**
```python
import requests

client = BronVaultClient()
client.session.timeout = 300  # 5 minutes
```

### Retry Logic

**Python:**
```python
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
client.session.mount("http://", adapter)
client.session.mount("https://", adapter)
```

### Logging

**Python:**
```python
import logging

logging.basicConfig(level=logging.DEBUG)
client = BronVaultClient()
# Now all requests will be logged
```

---

## Contributing

Found a bug or want to add a feature?

1. Fork the repository
2. Create your feature branch
3. Add tests if applicable
4. Submit a pull request

---

For full API documentation, see [`docs/API_GUIDE.md`](../docs/API_GUIDE.md)
