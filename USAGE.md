# BronVault Usage Guide

This guide covers advanced features for password analysis and breach database correlation.

## Table of Contents

- [Archive Password Configuration](#archive-password-configuration)
- [Password Export for Hashcat](#password-export-for-hashcat)
- [Breach Database Correlation](#breach-database-correlation)
- [Workflow Examples](#workflow-examples)

## Archive Password Configuration

BronVault supports automatic password brute-forcing for ZIP, RAR, and 7z archives commonly used for stealer logs.

### Configuration File

Passwords are configured in `config/archive-passwords.txt`. This file allows you to easily add custom passwords.

**Location**: `/config/archive-passwords.txt`

**Format**:
- One password per line
- Lines starting with `#` are comments
- Empty lines are ignored

**Example**:
```
# Common stealer passwords
infected
malware
virus

# Custom passwords for your analysis
mypassword123
corp2024
# Add more as needed
```

### Built-in Passwords

The system includes 25+ built-in common passwords for stealer logs, including:
- infected, malware, virus, stealer, logs
- Stealer family names: redline, raccoon, aurora, vidar, meta, mars, etc.
- Common patterns: 1234, password, admin

**Note**: Config file passwords are tried FIRST, followed by built-in passwords.

## Password Export for Hashcat

Export passwords and identifiers from your parsed logs for breach database correlation and hashcat analysis.

### Quick Export

Export all data (all devices):
```bash
npm run export:hashcat ./exports
```

Export data from specific device:
```bash
npm run export:hashcat ./exports abc123-device-id
```

### Exported Files

The export creates 5 files in your output directory:

#### 1. `passwords.txt`
**Purpose**: Hashcat-compatible wordlist

**Format**: One password per line, no duplicates
```
password123
mypassword
corporate2024
```

**Use with hashcat**:
```bash
hashcat -m 0 -a 0 hashes.txt exports/passwords.txt
```

#### 2. `password-stats.txt`
**Purpose**: Password frequency analysis

**Format**: Tab-separated with count and percentage
```
COUNT   PERCENTAGE      PASSWORD
1523    15.23%         password123
892     8.92%          admin123
```

**Use case**: Identify most common passwords for targeted analysis

#### 3. `emails.txt`
**Purpose**: Email addresses for breach database lookup

**Format**: Pipe-separated (email|domain|email_domain)
```
EMAIL|DOMAIN|EMAIL_DOMAIN
john@company.com|company.com|company.com
admin@example.org|example.org|example.org
```

**Use with dehashed**:
```bash
# Extract just emails for lookup
cut -d'|' -f1 exports/emails.txt > email-list.txt
```

#### 4. `usernames.txt`
**Purpose**: Non-email usernames for breach database lookup

**Format**: Pipe-separated (username|domain)
```
USERNAME|DOMAIN
jsmith|company.com
administrator|internal.corp
```

#### 5. `identifiers.txt`
**Purpose**: Combined list of all emails and usernames

**Format**: One identifier per line (deduplicated)
```
admin@company.com
administrator
john@company.com
jsmith
```

**Use case**: Quick lookup across all identifiers

## Breach Database Correlation

### Workflow: Combining Logs with Breach Data

The goal is to cross-reference stealer log data with breach databases (like dehashed) to create comprehensive password wordlists for security analysis.

#### Step 1: Export Data from BronVault

```bash
npm run export:hashcat ./exports
```

#### Step 2: Query Breach Database

Use the exported emails and usernames to query breach databases:

**Example with dehashed API** (pseudo-code):
```bash
# Query emails
while read email; do
  dehashed search email:"$email" >> breach-results.json
done < <(cut -d'|' -f1 exports/emails.txt | tail -n +2)

# Query usernames with domain context
while read line; do
  username=$(echo "$line" | cut -d'|' -f1)
  domain=$(echo "$line" | cut -d'|' -f2)
  dehashed search username:"$username" domain:"$domain" >> breach-results.json
done < <(tail -n +2 exports/usernames.txt)
```

#### Step 3: Extract Passwords from Breach Data

Parse the breach database results to extract passwords:

```bash
# Example: Extract passwords from JSON results
jq -r '.entries[].password' breach-results.json | sort -u > breach-passwords.txt
```

#### Step 4: Combine Wordlists

Merge stealer log passwords with breach database passwords:

```bash
# Combine and deduplicate
cat exports/passwords.txt breach-passwords.txt | sort -u > combined-wordlist.txt

# Count unique passwords
wc -l combined-wordlist.txt
```

#### Step 5: Use with Hashcat

Now you have a comprehensive, targeted wordlist:

```bash
# Dictionary attack with combined wordlist
hashcat -m 0 -a 0 hashes.txt combined-wordlist.txt

# Hybrid attack (wordlist + rules)
hashcat -m 0 -a 0 hashes.txt combined-wordlist.txt -r rules/best64.rule

# Statistical analysis
hashcat --keyspace combined-wordlist.txt
```

## Workflow Examples

### Example 1: Corporate Security Audit

**Scenario**: Analyzing passwords from a compromised corporate device

```bash
# 1. Export data from specific device
npm run export:hashcat ./audit-2024 device-id-abc123

# 2. Review password statistics
cat audit-2024/password-stats.txt | head -20

# 3. Identify corporate email addresses
grep '@yourcompany.com' audit-2024/emails.txt

# 4. Cross-reference with breach databases
# ... query dehashed with corporate emails ...

# 5. Create targeted wordlist for that organization
cat audit-2024/passwords.txt company-breach-passwords.txt > company-wordlist.txt

# 6. Test against corporate password hashes
hashcat -m 1000 ntlm-hashes.txt company-wordlist.txt
```

### Example 2: Password Pattern Analysis

**Scenario**: Understanding password reuse patterns

```bash
# 1. Export all passwords with statistics
npm run export:hashcat ./analysis

# 2. Analyze top 100 passwords
head -100 analysis/password-stats.txt

# 3. Look for patterns
grep -i 'password' analysis/passwords.txt | wc -l  # Variations of "password"
grep -E '^[0-9]+$' analysis/passwords.txt | wc -l  # Numeric-only passwords
grep -E '^[a-z]+$' analysis/passwords.txt | wc -l  # Lowercase-only passwords

# 4. Generate rules based on patterns
# ... create hashcat rules based on observed patterns ...
```

### Example 3: Multi-Device Campaign Analysis

**Scenario**: Analyzing stealer logs from multiple infected devices

```bash
# 1. Export data from all devices
npm run export:hashcat ./campaign-data

# 2. Get unique password count across all devices
wc -l campaign-data/passwords.txt

# 3. Find most reused passwords
sort campaign-data/password-stats.txt -t$'\t' -k1 -rn | head -20

# 4. Extract all unique email domains
cut -d'|' -f3 campaign-data/emails.txt | tail -n +2 | sort -u > domains.txt

# 5. Target specific organization
grep 'targetcompany.com' campaign-data/emails.txt > target-emails.txt
```

## Advanced Tips

### Optimizing Password Lists

Remove passwords shorter than 8 characters:
```bash
awk 'length($0) >= 8' exports/passwords.txt > filtered-passwords.txt
```

Remove passwords with only letters or only numbers:
```bash
grep -v -E '^[a-zA-Z]+$' exports/passwords.txt | \
grep -v -E '^[0-9]+$' > complex-passwords.txt
```

### Creating Custom Archive Password Lists

Add organization-specific passwords to `config/archive-passwords.txt`:
```
# Organization-specific patterns
CompanyName2024
CompanyName!
dept-password
internal123
```

### Dehashed Integration Script

Example Python script for batch dehashed queries:

```python
import requests
import json

def query_dehashed(email, api_key):
    headers = {"Accept": "application/json"}
    auth = ("user@email.com", api_key)

    response = requests.get(
        f"https://api.dehashed.com/search?query=email:{email}",
        headers=headers,
        auth=auth
    )

    return response.json()

# Read emails from export
with open('exports/emails.txt', 'r') as f:
    emails = [line.split('|')[0] for line in f.readlines()[1:]]  # Skip header

# Query each email
results = []
for email in emails:
    result = query_dehashed(email, "your-api-key")
    results.append(result)

# Extract passwords
passwords = set()
for result in results:
    for entry in result.get('entries', []):
        if entry.get('password'):
            passwords.add(entry['password'])

# Save to file
with open('breach-passwords.txt', 'w') as f:
    f.write('\n'.join(sorted(passwords)))
```

## Security Considerations

**Important**: These tools are designed for legitimate security research and testing:

1. **Authorization**: Only analyze logs from authorized security assessments
2. **Data Handling**: Exported files contain sensitive credential data - handle appropriately
3. **Legal Use**: Ensure your use case complies with applicable laws and regulations
4. **Ethical Research**: Use for defensive security, vulnerability assessment, and authorized penetration testing only

## Troubleshooting

### No passwords exported

**Issue**: `passwords.txt` is empty or has very few entries

**Solutions**:
- Verify logs have been processed: Check database for credential records
- Check device ID if filtering by device
- Ensure logs contain password files (not just cookies/history)

### Archive extraction failing

**Issue**: RAR/ZIP files won't extract

**Solutions**:
- Add custom passwords to `config/archive-passwords.txt`
- Check archive isn't corrupted: `unzip -t file.zip`
- Verify archive format is supported (ZIP, RAR, 7z)

### Dehashed queries failing

**Issue**: No results from breach database

**Solutions**:
- Verify API key is valid and has credits
- Check email/username format is correct
- Try broader searches (domain instead of full email)
- Rate limit: Add delays between queries

## API Usage

For programmatic access, import the functions directly:

```typescript
import {
  exportPasswordsForHashcat,
  exportPasswordStatistics,
  exportEmailsForBreachDB,
  exportUsernamesForBreachDB,
  exportBreachLookupPackage
} from './lib/password-export'

// Export passwords for specific device
const result = await exportPasswordsForHashcat(
  './output/passwords.txt',
  'device-id-123'
)

console.log(`Exported ${result.total_records} passwords`)

// Export complete package
const packageResult = await exportBreachLookupPackage(
  './output',
  'device-id-123'
)

console.log(`Exported ${packageResult.total_files} files`)
```

## Support

For issues or feature requests, please check the project documentation or open an issue on the repository.
