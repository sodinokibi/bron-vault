# Database Migration Guide

This guide covers applying database migrations 009, 010, and 011 for enhanced crypto analysis capabilities.

## 🎯 What These Migrations Add

### Migration 009: Enhanced Crypto Wallets
- **public_key**: Public key extracted from wallet (hex format)
- **account_name**: Account name/label from wallet
- **network_config**: Network/chain configuration data (JSON)
- **vault_data**: Encrypted vault data for analysis
- **extension_id**: Browser extension ID

**Purpose**: Better LevelDB parsing and wallet metadata extraction

### Migration 010: HD Wallet Support
- **derivation_path**: BIP32/44 derivation path (e.g., m/44'/60'/0'/0/0)
- **seed_id**: Hash of seed phrase to group derived addresses (64 chars)
- **address_index**: Address index in derivation path
- **wallet_software**: Detected wallet software (MetaMask, Phantom, etc.)

**Purpose**: Track "side wallets" derived from same seed phrase

### Migration 011: Ledger Live Support
- **ledger_device_model**: Ledger device model (Nano S, X, S Plus)
- **ledger_balance_usd**: Portfolio balance in USD (if cached)
- **ledger_operations_count**: Number of transactions
- **wallet_type**: Modified to include 'hardware_wallet' enum value

**Purpose**: High-value target identification via hardware wallet detection

---

## 🚀 Quick Start (Automated)

### Method 1: Using Migration Script (Recommended)

```bash
# Navigate to project root
cd /home/user/bron-vault

# Run the automated migration script
./scripts/apply-migrations.sh
```

The script will:
1. ✅ Verify database connection
2. ✅ Apply migrations 009, 010, 011 in sequence
3. ✅ Verify schema changes
4. ✅ Show summary of new capabilities

**Requirements:**
- `.env` file with database credentials
- MySQL client installed (`mysql` command)

---

## 📋 Manual Migration (Step by Step)

### Prerequisites

1. **Database Access**
   - MySQL/MariaDB server running
   - Database credentials (host, port, user, password)
   - Database named `stealer_logs` (or your custom name)

2. **MySQL Client**
   - Install: `sudo apt install mysql-client` (Ubuntu/Debian)
   - Or: `brew install mysql-client` (macOS)
   - Or: Use MySQL Workbench, phpMyAdmin, DBeaver, etc.

### Step 1: Connect to Database

```bash
mysql -h localhost -u your_user -p your_database
```

**Example:**
```bash
mysql -h localhost -u root -p stealer_logs
```

### Step 2: Apply Migration 009

```bash
mysql -h localhost -u your_user -p your_database < scripts/009_enhance_crypto_wallets.sql
```

**Verify:**
```sql
DESCRIBE crypto_wallets;
-- Should show new columns: public_key, account_name, network_config, vault_data, extension_id
```

### Step 3: Apply Migration 010

```bash
mysql -h localhost -u your_user -p your_database < scripts/010_add_hd_wallet_support.sql
```

**Verify:**
```sql
DESCRIBE crypto_wallets;
-- Should show new columns: derivation_path, seed_id, address_index, wallet_software
```

### Step 4: Apply Migration 011

```bash
mysql -h localhost -u your_user -p your_database < scripts/011_add_ledger_live_support.sql
```

**Verify:**
```sql
DESCRIBE crypto_wallets;
-- Should show new columns: ledger_device_model, ledger_balance_usd, ledger_operations_count

SHOW COLUMNS FROM crypto_wallets WHERE Field = 'wallet_type';
-- Should show: ENUM('browser_extension','desktop_app','mobile','hardware_wallet','other')
```

### Step 5: Verify All Changes

```sql
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'stealer_logs'  -- Change to your database name
  AND TABLE_NAME = 'crypto_wallets'
  AND COLUMN_NAME IN (
    'public_key', 'account_name', 'network_config', 'vault_data', 'extension_id',
    'derivation_path', 'seed_id', 'address_index', 'wallet_software',
    'ledger_device_model', 'ledger_balance_usd', 'ledger_operations_count'
  );
```

**Expected Output:**
```
+---------------------------+---------------+-------------+-------------------------------------------+
| COLUMN_NAME               | DATA_TYPE     | IS_NULLABLE | COLUMN_COMMENT                            |
+---------------------------+---------------+-------------+-------------------------------------------+
| public_key                | text          | YES         | Public key extracted from wallet          |
| account_name              | varchar       | YES         | Account name/label from wallet            |
| network_config            | json          | YES         | Network/chain configuration data          |
| vault_data                | text          | YES         | Encrypted vault data (for analysis)       |
| extension_id              | varchar       | YES         | Browser extension ID if from extension    |
| derivation_path           | varchar       | YES         | BIP32/44 derivation path                  |
| seed_id                   | varchar       | YES         | Hash of seed phrase to group addresses    |
| address_index             | int           | YES         | Address index in derivation path          |
| wallet_software           | varchar       | YES         | Detected wallet software                  |
| ledger_device_model       | varchar       | YES         | Ledger device model                       |
| ledger_balance_usd        | decimal       | YES         | Portfolio balance in USD (if cached)      |
| ledger_operations_count   | int           | YES         | Number of transactions                    |
+---------------------------+---------------+-------------+-------------------------------------------+
```

---

## 🔍 Testing After Migration

### Test 1: Check HD Wallet Detection

Upload a stealer log with MetaMask/Phantom and check:

```sql
-- Find seed groups with multiple addresses (side wallets)
SELECT
    seed_id,
    COUNT(*) as address_count,
    GROUP_CONCAT(DISTINCT blockchain) as blockchains,
    wallet_software
FROM crypto_wallets
WHERE seed_id IS NOT NULL
GROUP BY seed_id, wallet_software
HAVING address_count > 1
ORDER BY address_count DESC;
```

### Test 2: Check Ledger Live Detection

Upload a log with Ledger Live and check:

```sql
-- Find Ledger Live installations
SELECT
    device_id,
    COUNT(*) as accounts,
    SUM(ledger_balance_usd) as total_portfolio,
    GROUP_CONCAT(DISTINCT blockchain) as currencies,
    ledger_device_model
FROM crypto_wallets
WHERE wallet_type = 'hardware_wallet'
  AND wallet_name = 'Ledger Live'
GROUP BY device_id, ledger_device_model;
```

### Test 3: Check Enhanced Parsing

```sql
-- Verify enhanced LevelDB data extraction
SELECT
    wallet_name,
    COUNT(*) as total,
    COUNT(DISTINCT public_key) as unique_pubkeys,
    COUNT(DISTINCT account_name) as named_accounts,
    COUNT(DISTINCT extension_id) as extensions
FROM crypto_wallets
WHERE wallet_type = 'browser_extension'
GROUP BY wallet_name;
```

---

## 🐛 Troubleshooting

### Error: "Table 'crypto_wallets' doesn't exist"

**Solution:** You need to run initial setup migrations first:
```bash
mysql -u your_user -p your_database < scripts/001_create_tables.sql
# ... run other numbered migrations in order
```

### Error: "Duplicate column name"

**Solution:** Migration already applied. Skip to next migration.

**Verify which migrations are applied:**
```sql
DESCRIBE crypto_wallets;
-- Check if the columns from migrations 009, 010, 011 exist
```

### Error: "Access denied"

**Solution:** Check your database credentials in `.env` file:
```bash
cat .env | grep MYSQL
```

### Error: "Unknown database"

**Solution:** Create the database first:
```sql
CREATE DATABASE stealer_logs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 🎯 What's Next?

After migrations are applied:

1. **Upload Test Data**
   - Upload a stealer log with crypto wallets
   - Check the "HD Wallets" tab for side wallet detection
   - Look for Ledger Live detections

2. **Verify Features Work**
   - HD Wallet tab shows seed groups
   - Derivation paths are extracted
   - Ledger Live shows portfolio data (if present)

3. **Review Queries**
   - Check the example queries in migration files
   - Run high-value target queries
   - Export intelligence data

---

## 📊 New Capabilities Summary

| Feature | Migration | Capability |
|---------|-----------|------------|
| Enhanced Parsing | 009 | Extract public keys, account names, vault data from LevelDB |
| HD Wallets | 010 | Detect side wallets, seed correlation, wallet software ID |
| Ledger Live | 011 | Hardware wallet detection, portfolio tracking, high-value targets |

---

## 📞 Support

If you encounter issues:

1. Check logs: `tail -f logs/*.log`
2. Verify database: `SHOW TABLES; DESCRIBE crypto_wallets;`
3. Test connection: `mysql -h localhost -u user -p database -e "SELECT 1;"`
4. Check migration files for syntax errors

---

**Migration Status:**
- ✅ 009_enhance_crypto_wallets.sql
- ✅ 010_add_hd_wallet_support.sql
- ✅ 011_add_ledger_live_support.sql

**Database Ready:** Enhanced crypto analysis with HD wallet & Ledger Live support
