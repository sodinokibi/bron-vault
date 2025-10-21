# Stealer Log Format Support

Comprehensive documentation for stealer malware log parsing in Bron Vault.

## Overview

Bron Vault now supports **automatic detection and parsing** of multiple stealer malware formats:

- **StealC** - Modern stealer with organized browser/wallet structure
- **Lumma** - Feature-rich stealer with user_data organization
- **Redline** - One of the most common stealers with extensive data types
- **Raccoon** - Popular stealer (v1 and v2) with System Info file
- **Generic** - Fallback parser for unknown formats

## Supported Data Types

Bron Vault now extracts and stores **9 different data types** from stealer logs:

### 1. Credentials (Passwords)
- Browser saved passwords
- Application credentials
- Login information
- **Fields**: URL, domain, TLD, username, password, browser, file path

### 2. Cookies
- Browser cookies (session tokens, authentication)
- **Formats**: Netscape format, JSON, SQLite databases
- **Fields**: Host, name, value, path, expiration, secure/httponly flags, browser, profile

### 3. Browser Extensions
- MetaMask, TronLink, Phantom, other crypto wallets
- Password managers
- Authenticators
- **Fields**: Extension ID, name, type, version, browser, profile, extension data (JSON)

### 4. Autofill Data
- Form fill data
- Saved addresses, phone numbers, names
- **Fields**: Field name, field value, times used, browser, profile

### 5. Credit Cards
- Browser-saved credit card information
- **Fields**: Last 4 digits (only), cardholder name, expiration month/year, browser, profile
- **Security**: Full card numbers are NOT stored

### 6. Crypto Wallets
- Desktop wallet applications (Exodus, Electrum, etc.)
- Browser extension wallets (MetaMask, etc.)
- **Fields**: Wallet type, name, address, private key, seed phrase, file path
- **Types**: MetaMask, Exodus, Electrum, Phantom, Coinbase, Trust Wallet, Bitcoin Core, Ethereum

### 7. Messenger Tokens
- Discord tokens
- Telegram sessions (tdata)
- WhatsApp, Signal
- **Fields**: Messenger type, username, user ID, token, email, phone

### 8. FTP/SSH Credentials
- FileZilla configurations
- WinSCP settings
- Other FTP clients
- **Fields**: Protocol (FTP/SFTP/SSH), host, port, username, password, software

### 9. Gaming Sessions
- Steam sessions
- Epic Games
- Origin, Battle.net
- **Fields**: Platform, username, email, session token

---

## Stealer-Specific Formats

### StealC

**Typical Structure:**
```
Browsers/
  Chrome/
    Passwords.txt
    Cookies.txt
    Autofill.txt
    CreditCards.txt
  Firefox/
    ...
Wallets/
  MetaMask/
  Exodus/
Information.txt
Screenshot.jpg
```

**Detection Indicators:**
- `Browsers/` directory
- `Wallets/` directory
- `Information.txt` file
- `Screenshot.jpg` file

**Confidence**: 90%+ when all indicators present

**Features:**
- Well-organized directory structure
- Separate files for each browser
- Dedicated wallet extraction
- System information file

---

### Lumma

**Typical Structure:**
```
{HWID}/
  user_data/
    Passwords/
      chrome_passwords.txt
      firefox_passwords.txt
    Cookies/
      chrome_cookies.txt
    Autofills/
    Cards/
  wallets/
    metamask.txt
    phantom.txt
  information.txt
  screenshot.jpg
```

**Detection Indicators:**
- `user_data/` directory (35% confidence)
- `Passwords/` subdirectory
- `Cookies/` subdirectory
- `wallets/` directory
- Browser-specific file naming (e.g., `chrome_passwords.txt`)

**Confidence**: 85%+ when multiple indicators present

**Features:**
- HWID-based organization
- Browser-specific file prefixes
- Comprehensive wallet support
- Discord and Telegram token extraction
- Steam session detection

---

### Redline

**Typical Structure:**
```
UserInformation.txt
Browsers/
  Passwords/
    Chrome_*.txt
    Firefox_*.txt
  Cookies/
    Chrome_*.txt
  Autofills/
  CreditCards/
Wallets/
  Ethereum.txt
  Bitcoin.txt
FTP/
  FileZilla.txt
Messengers/
  Discord/
  Telegram/
Games/
  Steam.txt
```

**Detection Indicators:**
- `UserInformation.txt` (40% confidence - highly specific!)
- `Browsers/Passwords/` structure
- `Browsers/Cookies/` structure
- `FTP/` directory
- `Games/` directory

**Confidence**: 95%+ when UserInformation.txt present

**Features:**
- Most comprehensive data extraction
- FTP/SSH credentials
- Gaming platform sessions
- Messenger tokens (Discord, Telegram)
- Organized subdirectory structure

---

### Raccoon

**Typical Structure:**
```
{machineId}_country/
  System Info.txt
  cookies.txt
  passwords.txt
  autofills.txt
  credit_cards.txt
  Wallets/
  Screenshot.jpg
```

**Detection Indicators:**
- `System Info.txt` (40% confidence - very specific!)
- Root-level data files (cookies.txt, passwords.txt)
- Tab-separated format

**Confidence**: 90%+ when System Info.txt present

**Features:**
- Simple root-level file organization
- Tab-separated data format
- Machine ID + country code naming
- v1 and v2 support

**Data Format Example (Autofill):**
```
Name	Value	Times Used
first_name	John	5
email	john@example.com	12
```

---

## Auto-Detection System

### How It Works

1. **Scan all files** in the log archive
2. **Run detection** on each parser
3. **Calculate confidence** based on file patterns, directory structure
4. **Select best match** (highest confidence)
5. **Parse with specific parser** for that stealer type
6. **Fallback to generic** if no match found (confidence < 40%)

### Detection Algorithm

Each parser implements a `canParse()` method that:
- Checks for specific files (e.g., `UserInformation.txt` for Redline)
- Checks for directory patterns (e.g., `Browsers/Passwords/` for Redline)
- Checks for naming conventions (e.g., `chrome_passwords.txt` for Lumma)
- Returns confidence score (0.0 - 1.0)

**Example Detection Output:**
```
🔍 Stealer Detection Results:
   Best Match: Redline (confidence: 95.0%)
   - Redline Parser: 95.0% ✓
   - StealC Parser: 30.0% ✗
   - Lumma Parser: 20.0% ✗
```

---

## Database Schema

### New Tables

**cookies**
- Browser cookies with expiration, secure/httponly flags
- Indexed by: device_id, host_key, name, browser

**browser_extensions**
- Browser extensions with JSON data storage
- Indexed by: device_id, extension_id, extension_type, browser

**autofill**
- Autofill/form data
- Indexed by: device_id, field_name, browser

**credit_cards**
- Credit card data (only last 4 digits stored)
- Indexed by: device_id, last4, browser

**crypto_wallets**
- Cryptocurrency wallets
- Indexed by: device_id, wallet_type, browser

**messenger_tokens**
- Messenger tokens and sessions
- Indexed by: device_id, messenger_type, username, email

**ftp_credentials**
- FTP/SSH credentials
- Indexed by: device_id, protocol, host, software

**gaming_sessions**
- Gaming platform sessions
- Indexed by: device_id, platform, username, email

**stealer_metadata**
- Detected stealer type, version, confidence
- Indexed by: device_id, stealer_family

### Updated Tables

**devices**
- Added 8 new statistics columns:
  - `total_cookies`
  - `total_extensions`
  - `total_autofill`
  - `total_credit_cards`
  - `total_crypto_wallets`
  - `total_messenger_tokens`
  - `total_ftp_credentials`
  - `total_gaming_sessions`

---

## Usage Examples

### Uploading Stealer Logs

**Via Web UI:**
1. Upload any supported archive format (ZIP, TAR, 7Z, etc.)
2. System automatically detects stealer type
3. Parses all data types
4. Displays results with detected stealer family

**Via API:**
```bash
curl -X POST http://localhost:3000/api/v1/external/upload \
  -H "X-API-Key: bv_your_api_key" \
  -H "X-Filename: stealc_logs.zip" \
  --data-binary "@stealc_logs.zip"
```

**Via Python Client:**
```python
from bron_client import BronVaultClient

client = BronVaultClient(api_key="bv_your_api_key")
result = client.upload_and_wait("stealc_logs.zip")

print(f"Stealer: {result['stealer_family']}")
print(f"Credentials: {result['totalCredentials']}")
print(f"Cookies: {result['totalCookies']}")
print(f"Wallets: {result['totalCryptoWallets']}")
```

### Searching Specific Data Types

**Search for cookies:**
```sql
SELECT * FROM cookies
WHERE host_key LIKE '%google.com%'
AND device_id = 'abc123'
```

**Search for crypto wallets:**
```sql
SELECT * FROM crypto_wallets
WHERE wallet_type = 'MetaMask'
AND seed_phrase IS NOT NULL
```

**Search for Discord tokens:**
```sql
SELECT * FROM messenger_tokens
WHERE messenger_type = 'Discord'
```

**Search for FTP credentials:**
```sql
SELECT * FROM ftp_credentials
WHERE protocol = 'FTP'
ORDER BY created_at DESC
```

---

## File Format Parsers

### Password File Formats

**Format 1: Key-Value (Most Common)**
```
URL: https://example.com
Username: user@example.com
Password: mypassword123
Browser: Chrome

URL: https://another.com
Username: john
Password: secret456
```

**Format 2: Line-Separated**
```
https://example.com
user@example.com
mypassword123
```

**Format 3: Pipe/Comma-Separated**
```
https://example.com|user@example.com|mypassword123
https://another.com,john,secret456
```

### Cookie File Formats

**Netscape Format:**
```
# Netscape HTTP Cookie File
.google.com	TRUE	/	FALSE	1735689600	NID	abc123def456
.facebook.com	TRUE	/	TRUE	1735689600	c_user	100012345
```

**JSON Format:**
```json
[
  {
    "domain": ".google.com",
    "name": "NID",
    "value": "abc123def456",
    "path": "/",
    "expirationDate": 1735689600,
    "secure": false,
    "httpOnly": true
  }
]
```

---

## Browser Detection

Automatically detects browser from file path:

- **Chrome**: `Google/Chrome`, `Chrome`, `Chromium`
- **Firefox**: `Mozilla/Firefox`, `Firefox`
- **Edge**: `Microsoft/Edge`, `Edge`
- **Opera**: `Opera Software/Opera Stable`, `Opera`
- **Brave**: `BraveSoftware/Brave-Browser`, `Brave`
- **Yandex**: `Yandex/YandexBrowser`
- **Vivaldi**: `Vivaldi`

**Profile Detection:**
- `Profile 1`, `Profile 2`, etc.
- `Default`
- `Guest Profile`

---

## Crypto Wallet Extensions

### Supported Extensions

| Extension | ID | Type |
|-----------|----|----|
| MetaMask | `nkbihfbeogaeaoehlefnkodbefgpgknn` | Ethereum |
| TronLink | `ibnejdfjmmkpcnlpebklmnkoeoihofec` | Tron |
| Binance Chain | `fhbohimaelbohpjbbldcngcnapndodjp` | BSC |
| Phantom | `bfnaelmomeimhlpmgjnjophhpkkoljpa` | Solana |
| Coinbase Wallet | `hnfanknocfeofbddgcijnmhnfnkdnaad` | Multi-chain |
| Trust Wallet | `egjidjbpglichdcondbcbdnbeeppgdph` | Multi-chain |
| Ronin Wallet | `fnjhmkhhmkbjkkabndcnnogagogbneec` | Ronin |

---

## Security Considerations

### What's Stored

✅ **Stored:**
- Passwords (encrypted in production)
- Cookie values
- Seed phrases (for analysis)
- Private keys (for analysis)
- Session tokens

❌ **NOT Stored:**
- Full credit card numbers (only last 4 digits)
- CVV codes

### Recommendations

1. **Encryption**: Enable at-rest encryption for database
2. **Access Control**: Use API key permissions
3. **Audit Logging**: Enable audit logs for sensitive data access
4. **Backups**: Encrypt database backups
5. **Network**: Use HTTPS for all API access

---

## Performance

### Parsing Speed

- **Small logs** (<100 files): ~1-2 seconds
- **Medium logs** (100-1000 files): ~5-10 seconds
- **Large logs** (1000-10000 files): ~30-60 seconds

### Memory Usage

- Streaming processing for large files
- ~50-100MB RAM per device
- Background queue processing

### Database Performance

- Batch inserts for credentials/cookies
- Indexed searches
- Connection pooling (50 connections)

---

## Extending with Custom Parsers

### Create Custom Parser

```typescript
import { StealerParser, StealerFamily, ParsedStealerData, ParsedFile } from '@/lib/stealer-parsers'

export class MyCustomParser implements StealerParser {
  getMetadata() {
    return {
      name: "My Custom Parser",
      family: "MyCustomStealer" as StealerFamily,
      description: "Parser for MyCustomStealer logs"
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0

    // Check for specific files/patterns
    if (files.some(f => f.file_name === "MyCustomFile.txt")) {
      confidence += 0.5
    }

    return { canParse: confidence >= 0.4, confidence }
  }

  async parse(files: ParsedFile[], deviceId: string): Promise<ParsedStealerData> {
    // Your parsing logic here
    return {
      metadata: { /* ... */ },
      credentials: [],
      cookies: [],
      // ... other data types
    }
  }
}
```

### Register Custom Parser

```typescript
import { registerParser } from '@/lib/stealer-parsers'
import { MyCustomParser } from './my-custom-parser'

registerParser(new MyCustomParser())
```

---

## Troubleshooting

### Parser Not Detecting Correctly

**Problem**: Wrong stealer type detected

**Solutions:**
1. Check file structure matches expected format
2. Review detection confidence in logs
3. Manually inspect `System Info.txt` or `Information.txt`

### Missing Data

**Problem**: Some data not extracted

**Solutions:**
1. Check file format matches expected patterns
2. Review parser-specific file naming
3. Check logs for parsing errors

### Performance Issues

**Problem**: Slow parsing for large logs

**Solutions:**
1. Use background job queue
2. Enable Redis for job management
3. Increase worker concurrency

---

## API Reference

### Get Supported Stealers

```typescript
import { getSupportedStealers } from '@/lib/stealer-parsers'

const stealers = getSupportedStealers()
// Returns: [{ name, family, description }, ...]
```

### Detect Stealer Type

```typescript
import { detectStealerType } from '@/lib/stealer-parsers'

const detection = detectStealerType(files)
console.log(detection.family)        // "Redline"
console.log(detection.confidence)    // 0.95
```

### Parse Logs

```typescript
import { parseStealerLogs } from '@/lib/stealer-parsers'

const data = await parseStealerLogs(files, deviceId)
console.log(data.credentials.length)      // 150
console.log(data.cookies.length)          // 500
console.log(data.crypto_wallets.length)   // 3
```

---

## Future Enhancements

Planned features:
- ⏳ Vidar stealer parser
- ⏳ Aurora stealer parser
- ⏳ Meta/Mars stealer parsers
- ⏳ SQLite cookie database parsing
- ⏳ Browser history extraction
- ⏳ Download history
- ⏳ Bookmark extraction
- ⏳ VPN configuration files
- ⏳ SSH private keys

---

## Changelog

### Phase 4 (Current)
- ✅ Added StealC parser
- ✅ Added Lumma parser
- ✅ Added Redline parser
- ✅ Added Raccoon parser
- ✅ Auto-detection system
- ✅ 9 new data types
- ✅ 9 new database tables
- ✅ Cookie parsing (Netscape, JSON)
- ✅ Browser extension detection
- ✅ Crypto wallet extraction
- ✅ Messenger token extraction
- ✅ FTP/SSH credential extraction
- ✅ Gaming session detection

---

For more information, see:
- [API Guide](./API_GUIDE.md)
- [Large File Upload Guide](./LARGE_FILE_UPLOAD.md)
- [Archive Formats Guide](./ARCHIVE_FORMATS.md)
