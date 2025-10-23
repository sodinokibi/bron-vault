# Folder Watcher Service

The Folder Watcher is an automated service that monitors a directory for new stealer log archives and automatically processes them without manual intervention.

## Features

- **Automatic Detection**: Monitors a configured directory for new archive files
- **Multi-Format Support**: Handles .zip, .rar, .7z, .tar, .gz archives
- **Password Handling**: Automatically tries common passwords from your configured list
- **Error Handling**: Failed files are moved to a separate directory with error logs
- **Statistics Tracking**: Real-time processing stats and success rates
- **Flexible Configuration**: Configurable paths, debounce times, and auto-delete options
- **Graceful Shutdown**: Proper cleanup on SIGINT/SIGTERM signals

## Quick Start

### 1. Configure Environment Variables

Add these variables to your `.env` file:

```bash
# Required: Directory to monitor for new files
WATCHER_FOLDER_PATH=/path/to/incoming/logs

# Optional: Where to move successfully processed files (default: ../processed)
WATCHER_PROCESSED_PATH=/path/to/processed

# Optional: Where to move failed files (default: ../failed)
WATCHER_FAILED_PATH=/path/to/failed

# Optional: Delete files after processing instead of moving (default: false)
WATCHER_AUTO_DELETE=false

# Optional: Wait time before processing new file in ms (default: 3000)
WATCHER_DEBOUNCE_MS=3000

# Optional: User context for processing (default: "system")
WATCHER_USER_ID=system
WATCHER_USERNAME=folder-watcher
```

### 2. Start the Watcher

```bash
# Production mode
npm run watcher

# Development mode with auto-restart
npm run watcher:dev
```

### 3. Add Files to Watch Directory

Simply copy or move stealer log archives to the configured `WATCHER_FOLDER_PATH`. The watcher will:

1. Detect the new file
2. Wait for it to finish writing (debounce period)
3. Process it with the upload processor
4. Try common archive passwords automatically
5. Extract and categorize all data
6. Move to processed folder or delete (based on configuration)

## How It Works

```
┌─────────────────────┐
│  Incoming Folder    │
│  (WATCHER_FOLDER)   │
└──────────┬──────────┘
           │
           │ New file detected
           ▼
┌─────────────────────┐
│  Folder Watcher     │
│  - Validates file   │
│  - Waits for write  │
│  - Processes        │
└──────────┬──────────┘
           │
           ├─── Success ──────► Processed Folder
           │                     (or deleted)
           │
           └─── Failed ───────► Failed Folder
                                 (with error log)
```

## Directory Structure

Example directory structure when using default settings:

```
/incoming/
├── stealer-log-1.zip          ← Watched directory
├── stealer-log-2.rar
├── ../processed/              ← Successfully processed files
│   ├── 2025-10-23T10-30-00_stealer-log-1.zip
│   └── 2025-10-23T10-31-00_stealer-log-2.rar
└── ../failed/                 ← Failed files with error logs
    ├── 2025-10-23T10-32-00_bad-file.zip
    └── 2025-10-23T10-32-00_bad-file.zip.error.txt
```

## Configuration Options

### WATCHER_FOLDER_PATH (Required)
The directory to monitor for new archive files. Must exist or will be created.

### WATCHER_PROCESSED_PATH (Optional)
Where to move successfully processed files. If not set, defaults to `../processed` relative to the watch folder.

### WATCHER_FAILED_PATH (Optional)
Where to move files that failed to process. If not set, defaults to `../failed` relative to the watch folder.

### WATCHER_AUTO_DELETE (Optional)
If set to `true`, successfully processed files will be deleted instead of moved to the processed folder. Use with caution!

**Default**: `false`

### WATCHER_DEBOUNCE_MS (Optional)
How long to wait (in milliseconds) after a file is created before processing it. This ensures the file has finished being written.

**Default**: `3000` (3 seconds)

### WATCHER_USER_ID and WATCHER_USERNAME (Optional)
The user context used for processing files. This appears in the database records and logs.

**Defaults**: `system` and `folder-watcher`

## Archive Password Handling

The folder watcher uses the same password-trying system as manual uploads:

1. **Common Passwords**: Tries built-in common passwords (infected, malware, 1234, etc.)
2. **Custom Passwords**: Loads additional passwords from `config/archive-passwords.txt`
3. **Automatic**: No manual intervention needed - passwords are tried automatically

To add custom passwords, create/edit `config/archive-passwords.txt`:

```
mypassword123
custompass
anotherpass
```

## Monitoring and Stats

The watcher logs real-time statistics after each file is processed:

```
📊 Watcher Stats:
   Uptime: 45 minutes
   Processed: 23
   Succeeded: 21
   Failed: 2
   Success Rate: 91%
   Last Processed: 2025-10-23T10:45:00.000Z
```

## Running as a System Service

### Linux (systemd)

Create `/etc/systemd/system/bron-vault-watcher.service`:

```ini
[Unit]
Description=Bron-Vault Folder Watcher
After=network.target mysql.service redis.service

[Service]
Type=simple
User=bronvault
WorkingDirectory=/opt/bron-vault
Environment="NODE_ENV=production"
EnvironmentFile=/opt/bron-vault/.env
ExecStart=/usr/bin/npm run watcher
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable bron-vault-watcher
sudo systemctl start bron-vault-watcher
sudo systemctl status bron-vault-watcher
```

View logs:

```bash
sudo journalctl -u bron-vault-watcher -f
```

### macOS (launchd)

Create `~/Library/LaunchAgents/com.bronvault.watcher.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.bronvault.watcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npm</string>
        <string>run</string>
        <string>watcher</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/bron-vault</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/bron-vault-watcher.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/bron-vault-watcher.error.log</string>
</dict>
</plist>
```

Load and start:

```bash
launchctl load ~/Library/LaunchAgents/com.bronvault.watcher.plist
launchctl start com.bronvault.watcher
```

## Troubleshooting

### Watcher doesn't start

**Check environment variables**:
```bash
# Verify WATCHER_FOLDER_PATH is set
echo $WATCHER_FOLDER_PATH
```

**Check directory permissions**:
```bash
# Ensure watch directory is readable
ls -la $WATCHER_FOLDER_PATH
```

### Files aren't being processed

**Check file extensions**:
- Only .zip, .rar, .7z, .tar, .gz files are processed
- Other files are ignored

**Check debounce time**:
- Files are processed after `WATCHER_DEBOUNCE_MS` milliseconds
- If files are large, increase this value

**Check logs**:
```bash
# If running with npm
npm run watcher

# If running as service
sudo journalctl -u bron-vault-watcher -f
```

### Files moved to failed folder

**Check error log**:
Each failed file has a corresponding `.error.txt` file with details:

```bash
cat /path/to/failed/2025-10-23T10-32-00_file.zip.error.txt
```

**Common issues**:
- Corrupted archive
- Unknown archive format
- Password protected (and password not in list)
- Insufficient disk space
- Database connection errors

### High CPU usage

**Increase debounce time**:
```bash
WATCHER_DEBOUNCE_MS=5000  # 5 seconds instead of 3
```

**Reduce file frequency**:
- Process files in batches rather than continuous stream
- Use a separate staging directory

## Integration with Existing Systems

### Automated Upload Pipeline

```bash
# Example: FTP server receives files → Watcher processes automatically
/ftp-incoming/          ← FTP upload directory
      ↓
/stealer-logs/incoming/ ← Watcher monitors this
      ↓
/stealer-logs/processed/ ← Successfully processed
```

### Cron Job Example

Process files at specific times:

```bash
# Copy files to watch directory every hour
0 * * * * cp /external-source/*.zip /path/to/watched/folder/
```

### API Integration

The watcher uses the existing upload processor, so all API features are supported:
- Device deduplication
- Category detection
- Risk scoring
- Cookie expiration tracking
- Binary file extraction

## Performance Considerations

- **Large Files**: Files >100MB use async queue processing automatically
- **Concurrent Processing**: Only processes one file at a time to avoid resource contention
- **Memory Usage**: Minimal - only tracks currently processing files
- **Disk Usage**: Ensure sufficient space in processed/failed directories

## Security Notes

- Files are processed with the configured user context (WATCHER_USER_ID)
- Archive passwords are only stored in memory
- Failed files preserve original for manual inspection
- All processing follows existing upload security measures

## API Programmatic Usage

You can also use the FolderWatcher class programmatically:

```typescript
import { FolderWatcher } from './lib/folder-watcher'

const watcher = new FolderWatcher({
  watchPath: '/path/to/incoming',
  processedPath: '/path/to/processed',
  failedPath: '/path/to/failed',
  debounceMs: 3000,
  autoDelete: false
})

await watcher.start()

// Get stats
const stats = watcher.getStats()
console.log(`Processed ${stats.filesProcessed} files`)

// Stop when done
await watcher.stop()
```

## Support

For issues or questions:
1. Check the logs for error details
2. Verify environment configuration
3. Test with a small sample file first
4. Check database and Redis connectivity
