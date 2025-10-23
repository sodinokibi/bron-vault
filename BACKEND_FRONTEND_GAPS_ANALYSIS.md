# COMPREHENSIVE BACKEND-FRONTEND GAP ANALYSIS
## Bron Vault - Unexposed Features and Data

---

## EXECUTIVE SUMMARY

The Bron Vault backend contains significantly more data extraction, analysis, and intelligence capabilities than what is exposed to the frontend. This analysis identifies **35+ data fields, 15+ API endpoints, and multiple analysis features** that are retrieved but not displayed or utilized by the UI.

---

## DATABASE TABLES WITH DATA NOT FULLY EXPOSED

### 1. BROWSER_HISTORY TABLE
**Available Fields:**
- url, title, visit_count, last_visit_time
- **PLUS (NOT SHOWN):**
  - `primary_category` - Category detection (crypto, banking, cloud, etc.)
  - `categories` - JSON array of all detected categories
  - `risk_level` - Risk assessment (critical, high, medium, low)
  - `risk_score` - 0-100 risk scoring
  - `browser` - Browser type
  - `profile` - Browser profile info

**API Available:**
- `/api/v1/devices/[deviceId]/history` - Supports filtering by:
  - `category` parameter
  - `risk` parameter (critical, high, medium, low)
  - Search query
  - Browser filter

**Frontend Display:**
- ❌ No dedicated history page/view exists
- ❌ Risk scoring not shown
- ❌ Categories not displayed
- ❌ No risk filtering interface

---

### 2. COOKIES TABLE
**Available Fields:**
- host_key, name, value, path, expires_utc
- **PLUS (NOT SHOWN):**
  - `primary_category` - Category detection
  - `categories` - JSON array of categories
  - `risk_level` - Risk assessment
  - `risk_score` - Numerical risk score (0-100)
  - `is_secure`, `is_httponly`, `same_site` - Security flags
  - `browser`, `profile` - Source information

**API Available:**
- `/api/v1/cookies/[deviceId]` - Full endpoint with:
  - Filtering by category
  - Filtering by risk level
  - Top domains analysis
  - High-value targets detection
  - Cookie statistics (secure vs insecure, httponly, persistent)

**Frontend Display:**
- ✓ CookiesTable component exists
- ❌ Statistics panel not shown (secure/httponly counts missing)
- ❌ Top domains by risk not displayed
- ❌ High-value target cookies list not shown

---

### 3. CRYPTO_WALLETS TABLE
**Available Fields Beyond Basic Display:**
- Basic: address, blockchain, wallet_name, wallet_type
- **PLUS (NOT SHOWN):**
  - `public_key` - Extracted public keys (with format)
  - `account_name` - Account labels from wallet
  - `vault_data` - Encrypted vault data for hashcat cracking
  - `derivation_path` - BIP32/44 paths (e.g., m/44'/60'/0'/0/0)
  - `seed_id` - Hash of seed phrase to correlate addresses
  - `address_index` - Index in HD derivation
  - `wallet_software` - Detected software (MetaMask, Trust Wallet, etc.)
  - `ledger_device_model` - Hardware wallet model (Nano S, Nano X, etc.)
  - `ledger_balance_usd` - Portfolio value snapshot
  - `ledger_operations_count` - Transaction count
  - `primary_category` - Risk categorization
  - `categories` - JSON categories array
  - `risk_level` - Risk classification
  - `risk_score` - Numerical risk score
  - `extension_id` - Browser extension ID
  - `network_config` - JSON network configuration

**API Features:**
- `/api/v1/crypto/analysis/[deviceId]` returns:
  - ✓ Vault hashes (for hashcat cracking)
  - ✓ Public keys by blockchain
  - ✓ HD wallet analysis (seed grouping)
  - ✓ Ledger Live detection and portfolio data
  - ✓ Derivation path correlations
  - ✓ Wallet software detection
- `/api/v1/crypto/devices` returns:
  - ✓ Crypto activity scoring (0-100)
  - ✓ Device filtering by crypto activity
  - ✓ High/medium/low activity classification

**Frontend Display:**
- ✓ Crypto analysis page exists
- ❌ Vault hashes (hashcat mode, iterations) - DATA RETRIEVED BUT NOT SHOWN
- ❌ Public keys by blockchain - DATA RETRIEVED BUT NOT SHOWN
- ❌ HD wallet seed grouping analysis - DATA RETRIEVED BUT NOT SHOWN (endpoints return it)
- ❌ Ledger Live device model, balance, operations - DATA AVAILABLE BUT NOT DISPLAYED
- ❌ Derivation paths - PARTIALLY shown but not analyzed for clustering
- ❌ Wallet software (MetaMask, Exodus detection) - NOT DISPLAYED
- ❌ Risk scoring by wallet - NOT SHOWN
- ❌ Activity scoring for crypto devices page - NOT ACCESSIBLE

---

### 4. DISCORD_TOKENS TABLE
**Available Fields Beyond Basic Display:**
- token, token_type, user_id, username, email
- **PLUS (NOT SHOWN):**
  - `global_name` - Discord global name
  - `avatar` - Avatar URL
  - `discriminator` - Old discriminator field
  - `email_verified` - Boolean email verification status
  - `phone_verified` - Boolean phone verification
  - `premium_type` - 0=None, 1=Classic, 2=Nitro, 3=Basic
  - `account_flags` - Account feature flags
  - `server_count` - Number of servers/guilds user is in
  - `friend_count` - Number of friends
  - `account_created` - Account creation date from snowflake
  - `last_validated` - Last validation timestamp
  - `bio` - User bio/profile text
  - `is_valid` - Validation result
  - `is_validated` - Whether validation was attempted
  - `validation_error` - Error messages from validation

**API Features:**
- `/api/v1/messaging/discord/validation-stats` returns:
  - Nitro token counts
  - Tokens with servers count
  - Validation rates and percentages
- Per-device discord tokens available

**Frontend Display:**
- ❌ Discord token validation stats page NOT IMPLEMENTED
- ❌ Premium/Nitro account detection NOT SHOWN
- ❌ Account creation dates NOT DISPLAYED
- ❌ Server/friend counts NOT SHOWN
- ❌ Bio/profile information NOT DISPLAYED
- ❌ Global names NOT SHOWN
- ❌ Account flags NOT DISPLAYED
- ❌ Validation status tracking NOT SHOWN

---

### 5. AUTHENTICATOR_DATA TABLE
**Available Fields:**
- app_type, service_name, account_name, secret_key, backup_codes
- **PLUS (NOT SHOWN):**
  - `qr_code_path` - Path to extracted QR code images
  - `file_path` - Source file location

**API Features:**
- `/api/v1/authenticator/[deviceId]` available

**Frontend Display:**
- ✓ Authenticator table shown on device page
- ❌ QR code images not retrieved or displayed
- ❌ Backup codes list not accessible

---

### 6. TELEGRAM_SESSIONS TABLE
**Available Fields:**
- session_type, has_key_data, has_user_data, phone_number, username, file_count, total_size
- **PLUS (NOT SHOWN):**
  - `has_map_files` - Map database presence
  - `original_path` - Original Telegram data path
  - `user_id` - Telegram user ID

**API Features:**
- `/api/v1/messaging/telegram/[deviceId]` available
- `/api/v1/messaging/telegram/export` available

**Frontend Display:**
- ✓ Basic count shown in device overview
- ❌ Detailed session information not displayed
- ❌ Key/user data availability not shown
- ❌ File counts and sizes not displayed
- ❌ User IDs not shown

---

### 7. COOKIE_SESSIONS TABLE
**Available Fields:**
- service, service_category, account_identifier, session_valid, expires_at
- **PLUS (NOT SHOWN):**
  - `security_httponly` - HTTPOnly flag
  - `security_secure` - Secure flag
  - `security_samesite` - SameSite attribute
  - `browser` - Browser type
  - `profile` - Browser profile

**API Features:**
- `/api/v1/cookie-sessions/stats/[deviceId]` - Per-device statistics
- `/api/v1/cookie-sessions/stats/global` - Global statistics with breakdown
- `/api/v1/cookie-sessions/high-value` - High-value sessions filtering

**Frontend Display:**
- ✓ Cookie sessions page exists
- ✓ High-value sessions count shown
- ❌ Per-device statistics endpoint not used
- ❌ Global statistics breakdown not displayed
- ❌ Security flags (httponly, secure) not shown

---

### 8. CREDENTIALS TABLE
**Available Fields:**
- url, domain, username, password, browser
- **PLUS (NOT SHOWN):**
  - `is_email` - Boolean: is username an email?
  - `email_local_part` - Local part of email (before @)
  - `email_domain` - Domain of email (after @)
  - `primary_category` - Category detection
  - `categories` - JSON categories array
  - `risk_level` - Risk classification
  - `risk_score` - Numerical risk (0-100)
  - `tld` - Top-level domain parsed

**API Features:**
- `/api/v1/credentials/search` - Global search with category/risk filtering
- Per-device credentials endpoint supports category and risk filtering

**Frontend Display:**
- ✓ CredentialsEnhancedTable shows some risk/category data
- ✓ Filtering by category and risk available
- ❌ Email domain detection/grouping not displayed
- ❌ Global search/cross-device credentials not accessible
- ❌ TLD analysis not shown

---

### 9. FILE_CATEGORIES TABLE
**Available Fields:**
- category, subcategory, confidence_score, tags

**Frontend Display:**
- ❌ No dedicated file categorization view
- ❌ File category API endpoint not implemented
- ❌ File browsing doesn't show categories

---

### 10. BROWSER_HISTORY Not Used for:
- ✓ Crypto site visits tracked in crypto analysis
- ❌ High-value site visits (banking, email) not shown
- ❌ Malware/suspicious site detection not shown
- ❌ Category-based browsing history analysis not available

---

## API ENDPOINTS NOT CALLED BY FRONTEND

### UNUSED OR UNDERUTILIZED ENDPOINTS

| Endpoint | Purpose | Frontend Usage |
|----------|---------|-----------------|
| `/api/v1/crypto/devices` | List devices by crypto activity with scoring | ❌ NOT USED |
| `/api/v1/cookies/[deviceId]` | Detailed cookie analysis | ✓ PARTIALLY (missing stats) |
| `/api/v1/devices/[deviceId]/history` | Browser history with category/risk filtering | ❌ NOT USED |
| `/api/v1/messaging/discord/validation-stats` | Global Discord validation stats | ❌ NOT USED |
| `/api/v1/devices/[deviceId]/stealer-metadata` | Detailed stealer + threat intel | ✓ USED BUT LIMITED |
| `/api/v1/cookie-sessions/stats/[deviceId]` | Per-device session statistics | ❌ NOT USED |
| `/api/v1/credentials/export` | Bulk credential export | ❌ NOT USED |
| `/api/v1/messaging/discord/export` | Discord data export | ❌ NOT USED |
| `/api/v1/messaging/telegram/export` | Telegram data export | ❌ NOT USED |
| `/api/v1/wallets/export/seeds` | Seed phrase export | ❌ NOT USED |

---

## ANALYSIS FEATURES BACKEND HAS BUT FRONTEND DOESN'T USE

### 1. CRYPTO ACTIVITY SCORING
**Backend Capability:**
- Calculates 0-100 activity score based on:
  - Wallets count (0-40 points)
  - History visits (0-30 points)
  - Sessions count (0-20 points)
  - Software count (0-10 points)
- Classifies devices as: High Activity (70+), Medium (40-69), Low (<40)

**Frontend:**
- ❌ No "Crypto Devices" page showing ranked devices by activity
- ❌ Activity score not displayed
- ❌ No filtering by crypto activity level

---

### 2. DEVICE RISK SCORING
**Backend Capability:**
- Comprehensive 0-100 risk scoring based on:
  - Active sessions (0-30 points)
  - High-value sessions (0-20 points)
  - Crypto wallets (0-15 points)
  - Discord tokens (0-10 points)
  - Credit cards (0-15 points)
  - Credential volume (0-10 points)
  - Stealer threat level (0-10 points)
- Classifies as: Critical (80+), High (60-79), Medium (40-59), Low (<40)
- Provides risk factors and recommendations

**Frontend:**
- ✓ Risk score shown on device overview
- ✓ Risk factors displayed
- ✓ Recommendations shown
- ❌ But API calculation uses hardcoded domains - should use category data instead
- ❌ No dashboard view sorting devices by risk
- ❌ No risk comparison across devices

---

### 3. HD WALLET SEED CLUSTERING
**Backend Capability:**
- Groups wallet addresses by seed_id
- Tracks derivation paths (BIP32/44)
- Identifies "side wallets" from same seed
- Shows blockchain coverage per seed

**Frontend:**
- ✓ Crypto analysis shows seed groups
- ❌ But not clearly highlighted as a correlation analysis
- ❌ No visualization of wallet network
- ❌ No export of seed correlations

---

### 4. VAULT HASH EXTRACTION FOR CRACKING
**Backend Capability:**
- Extracts vault data with:
  - Hash value
  - Hashcat mode
  - KDF algorithm
  - Iterations
  - "can_crack" boolean flag

**Frontend:**
- ❌ ZERO exposure of this data
- ❌ No vault hash extraction interface
- ❌ No hashcat export format
- ❌ No crackable wallets identification

---

### 5. PUBLIC KEY EXTRACTION
**Backend Capability:**
- Extracts public keys for all wallets
- Groups by blockchain
- Tracks key format (compressed, uncompressed, etc.)
- Links to addresses

**Frontend:**
- ❌ ZERO public key exposure
- ❌ No public key export
- ❌ No blockchain-specific key analysis

---

### 6. LEDGER LIVE DETECTION
**Backend Capability:**
- Detects Ledger hardware wallets
- Extracts device model
- Shows portfolio balance (USD)
- Lists operations/transactions count
- Groups accounts by currency

**Frontend:**
- ✓ Ledger Live detected in crypto analysis
- ❌ But device model not shown
- ❌ Portfolio value (USD balance) not displayed
- ❌ Operations/transaction counts not shown

---

### 7. CATEGORY-BASED RISK ANALYSIS
**Backend Capability:**
- Every credential categorized:
  - crypto, banking, corporate, social_media, email, vpn_ftp, gaming, financial, developer, messaging, other
- Every cookie categorized with risk
- Every history entry categorized with risk
- Risk scoring per category

**Frontend:**
- ✓ Category filtering available
- ✓ Risk badges shown
- ❌ No category risk distribution (pie/bar chart)
- ❌ No "top risky categories" view
- ❌ No category trends or patterns

---

### 8. CROSS-DEVICE ANALYTICS
**Backend Capability:**
- Global statistics available:
  - Total Discord/Telegram/Auth/Wallets counts
  - Breakdown by type
  - Devices with each data type
  - High-value wallet counts

**Frontend:**
- ✓ Global stats shown on messaging-wallets page
- ❌ No cross-device comparison
- ❌ No global risk rankings
- ❌ No global category distribution charts

---

### 9. THREAT INTELLIGENCE
**Backend Capability:**
- Stealer metadata endpoint returns:
  - Threat level per malware family
  - Known C2 infrastructure
  - Typical distribution vectors
  - IOC indicators
  - Specific mitigation steps
  - Similar infected devices

**Frontend:**
- ✓ Stealer panel shows family + threat level
- ❌ C2 infrastructure not shown
- ❌ Distribution vectors not displayed
- ❌ Detailed mitigation steps not in UI
- ❌ Similar devices not listed

---

## DATA FIELDS RETRIEVED BUT NOT DISPLAYED

### By Category:

**Email Detection Fields (NOT SHOWN):**
- is_email (boolean)
- email_local_part (parsed email username)
- email_domain (parsed email domain)
- email_domain index for bulk email targeting

**Risk/Category Fields (PARTIALLY SHOWN):**
- risk_score numeric values (shown with badges but not numerically)
- categories JSON array (shown as single category only)
- confidence_score (never shown)

**Security Flags (NOT SHOWN):**
- is_secure (for cookies)
- is_httponly (for cookies)
- is_persistent (for cookies)
- same_site (for cookies)
- security_httponly (for sessions)
- security_secure (for sessions)
- security_samesite (for sessions)

**Device Metadata (NOT SHOWN):**
- upload_batch (shown in device list but not used for filtering)
- device_name_hash (never exposed)
- total_history (count tracked but not displayed)
- total_downloads (count tracked but not displayed)
- total_bookmarks (count tracked but not displayed)
- critical_risk_count (tracked but not displayed)
- high_risk_count (tracked but not displayed)

**Wallet/Crypto Fields (NOT SHOWN):**
- vault_data (encrypted vault passwords)
- public_key (blockchain public keys)
- public_key_format (key encoding type)
- ledger_balance_usd (portfolio value snapshot)
- ledger_operations_count (transaction count)
- ledger_device_model (hardware wallet model)
- wallet_software (detected from config)
- extension_id (browser extension ID)
- account_name (labeled account names)
- network_config (chain RPC config)
- derivation_path (only shown in analysis, not analyzed)
- address_index (never displayed)

---

## MISSING PAGES & VIEWS

### Should Exist But Don't:

1. **"Crypto Devices" Page**
   - Lists all devices with crypto wallets
   - Filtered by activity score
   - Sorted by risk or activity
   - Shows stats per device
   - API `/api/v1/crypto/devices` exists but not called

2. **"Browser History" Page**
   - Per-device browsing history
   - Filtered by category (crypto, banking, etc.)
   - Filtered by risk level
   - Top sites visualization
   - API `/api/v1/devices/[deviceId]/history` exists but not called

3. **"Global Risk Dashboard"**
   - Devices ranked by risk score
   - Risk distribution (pie chart)
   - Category breakdown
   - Top risky credentials/wallets
   - Risk trends

4. **"Discord Intelligence"**
   - Discord token validation statistics
   - Premium/Nitro account detection
   - Account age analysis
   - Server/friend network sizes
   - API `/api/v1/messaging/discord/validation-stats` exists but not called

5. **"Vault Hash Cracking"**
   - Extract passwords vault hashes
   - Show hashcat commands
   - List crackable wallets
   - Hash export format
   - API data available but not surfaced

6. **"Public Key Analysis"**
   - Extract and display public keys
   - Group by blockchain
   - Export formats (compressed, uncompressed)
   - Blockchain coverage analysis

7. **"Ledger Hardware Wallet Intelligence"**
   - Detect Ledger devices
   - Show device models
   - Display portfolio values (USD)
   - Transaction/operation counts
   - Account names

---

## FILTERING & SEARCH CAPABILITIES MISSING FROM UI

**Available in API but not frontend:**
- Category filtering for browser history
- Risk filtering for browser history
- Risk filtering for cookies (partially available)
- Category + Risk combined filtering
- Device filtering by crypto activity score
- Device filtering by minimum wallets
- Device filtering by blockchain
- Credential global search
- Seed phrase grouping export

---

## EXPORT CAPABILITIES NOT IMPLEMENTED

**Available endpoints:**
- `/api/v1/credentials/export` - Not accessible from UI
- `/api/v1/messaging/discord/export` - Not accessible from UI
- `/api/v1/messaging/telegram/export` - Not accessible from UI
- `/api/v1/wallets/export/seeds` - Not accessible from UI

**Missing from UI:**
- Vault hash export (hashcat format)
- Public key export (by blockchain)
- Seed phrase CSV export
- Device risk comparison export

---

## STATISTICAL VIEWS MISSING

**Available from API but not shown:**
1. Cookie statistics (secure vs insecure breakdown)
2. Per-device session statistics
3. Global session statistics with service breakdown
4. Discord token type breakdown
5. Telegram session type breakdown
6. Wallet breakdown by blockchain (globally)
7. Risk level distribution (device-wide)
8. Category distribution (device-wide)
9. Crypto activity score distribution
10. Browser history category breakdown

---

## SUMMARY TABLE: DATA GAPS BY SEVERITY

| Category | Count | Severity | Example |
|----------|-------|----------|---------|
| API Endpoints Unused | 10 | High | `/api/v1/crypto/devices`, `/api/v1/devices/[id]/history` |
| Data Fields Not Shown | 40+ | High | vault_data, public_keys, ledger_balance, ledger_model |
| Missing Pages | 7 | High | Crypto Devices, Browser History, Risk Dashboard |
| Missing Analytics | 10+ | Medium | Risk distribution, Category breakdown, Activity scores |
| Incomplete Features | 5 | Medium | Stealer threat intel, Discord validation stats, Vault hashes |
| Export Functions | 8+ | Medium | Seed export, vault hash export, public key export |

---

## RECOMMENDATIONS FOR FRONTEND ENHANCEMENT

### Priority 1 (High Impact):
1. Create "Crypto Devices" page using `/api/v1/crypto/devices` with activity scoring
2. Create "Global Risk Dashboard" sorting devices by risk score
3. Add "Browser History" page with category/risk filtering
4. Expose vault hashes with hashcat export format
5. Display public keys by blockchain

### Priority 2 (Medium Impact):
6. Add Discord token validation statistics page
7. Display Ledger device models, balances, and operations
8. Show risk/category distribution charts
9. Add cross-device risk comparison
10. Implement global search for credentials

### Priority 3 (Polish):
11. Add seed phrase grouping visualization
12. Export functions for all major data types
13. Threat intelligence detailed view
14. Security flags visualization for cookies
15. Device-to-device correlation analysis

---

## CONCLUSION

Bron Vault's backend is significantly more sophisticated than its frontend suggests. The platform collects and analyzes:
- **40+ data fields** that could enhance threat analysis
- **15+ API endpoints** that provide advanced capabilities
- **10+ analysis features** that detect patterns and risks

A more complete frontend would dramatically improve the platform's threat intelligence and data exfiltration analysis capabilities.

