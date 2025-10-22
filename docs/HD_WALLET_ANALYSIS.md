# HD Wallet Derivation Path Analysis

## Overview

**HD (Hierarchical Deterministic) Wallets** can derive unlimited addresses from a single seed phrase. If you find a seed phrase, the victim likely has **multiple addresses** you haven't discovered yet.

This guide explains how to detect and enumerate these "side wallets".

---

## 🔑 Key Concepts

### What is an HD Wallet?

From a **single 12 or 24-word seed phrase**, modern wallets generate multiple addresses using mathematical derivation:

```
Seed Phrase (12 words)
    ↓
Master Private Key
    ↓
m/44'/60'/0'/0/0  → Address 1 (0xabc...)
m/44'/60'/0'/0/1  → Address 2 (0xdef...)
m/44'/60'/0'/0/2  → Address 3 (0x123...)
...
m/44'/60'/0'/0/99 → Address 100 (0x999...)
```

**Each address**:
- Has its own public/private key pair
- Can hold different balances
- May be on different blockchains
- But all derive from the same seed

### Derivation Path Format

```
m / purpose' / coin_type' / account' / change / address_index
```

**Example**: `m/44'/60'/0'/0/5`

- `m` = Master key
- `44'` = BIP44 standard (apostrophe means "hardened")
- `60'` = Ethereum coin type
- `0'` = Account 0
- `0` = External chain (receiving addresses)
- `5` = **6th address** (index starts at 0)

---

## 📊 Common Wallet Patterns

### MetaMask (Ethereum)
```
Default Path: m/44'/60'/0'/0/x

m/44'/60'/0'/0/0  → Account 1
m/44'/60'/0'/0/1  → Account 2
m/44'/60'/0'/0/2  → Account 3
...
```

**Implication**: If you find MetaMask with one address, try indices 0-20 to find more accounts.

### Trust Wallet (Multi-Chain)
```
Ethereum:       m/44'/60'/0'/0/x
Bitcoin:        m/44'/0'/0'/0/x
Binance Chain:  m/44'/714'/0'/0/x
```

**Implication**: Same seed generates addresses on **multiple blockchains**.

### Phantom (Solana)
```
Default Path: m/44'/501'/x'/0'

m/44'/501'/0'/0'  → Account 1
m/44'/501'/1'/0'  → Account 2
m/44'/501'/2'/0'  → Account 3
```

**Implication**: Account number changes instead of address index.

### Ledger Hardware Wallet
```
Ethereum:        m/44'/60'/x'/0/0
Bitcoin Legacy:  m/44'/0'/x'/0/0
Bitcoin SegWit:  m/84'/0'/x'/0/0
```

**Implication**: Uses account-level derivation (changes x instead of last index).

---

## 🔍 Detection Methods

### Method 1: Pattern Recognition (No Crypto Libraries)

If you found **multiple addresses** in wallet data, check if they follow a pattern:

```typescript
import { detectSharedSeed, identifyWalletSoftware } from '@/lib/hd-wallet-analyzer'

// Found addresses with derivation info
const addresses = [
  { address: "0xabc...", derivationPath: "m/44'/60'/0'/0/0", addressIndex: 0 },
  { address: "0xdef...", derivationPath: "m/44'/60'/0'/0/1", addressIndex: 1 },
  { address: "0x123...", derivationPath: "m/44'/60'/0'/0/5", addressIndex: 5 },
]

// Detect if they share a seed
const seedGroups = detectSharedSeed(addresses)

// Result: All three addresses likely from same seed
// Gap analysis: Found indices 0, 1, 5
// Estimation: Probably 6-26 total addresses (5 + gap limit of 20)
```

### Method 2: Known Seed Phrase (With Crypto Libraries)

If you **extracted a seed phrase**, you can mathematically derive addresses:

```typescript
// Requires: npm install @scure/bip32 @scure/bip39 @noble/secp256k1

import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync } from '@scure/bip39'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'

function deriveEthereumAddresses(seedPhrase: string, count: number = 20) {
  // Convert seed phrase to master key
  const seed = mnemonicToSeedSync(seedPhrase)
  const masterKey = HDKey.fromMasterSeed(seed)

  const addresses = []

  for (let i = 0; i < count; i++) {
    // Derive for path m/44'/60'/0'/0/i
    const path = `m/44'/60'/0'/0/${i}`
    const child = masterKey.derive(path)

    if (!child.publicKey) continue

    // Convert public key to Ethereum address
    const publicKeyBytes = child.publicKey.slice(1) // Remove 0x04 prefix
    const hash = keccak_256(publicKeyBytes)
    const address = '0x' + bytesToHex(hash.slice(-20))

    addresses.push({
      index: i,
      path,
      address,
      publicKey: bytesToHex(child.publicKey)
    })
  }

  return addresses
}

// Usage
const seedPhrase = "abandon abandon abandon ... art"
const derivedAddresses = deriveEthereumAddresses(seedPhrase, 100)

// Now check which of these 100 addresses exist in your data
// Addresses you find = confirmed wallets
// Addresses you don't find = potential "side wallets" to investigate
```

### Method 3: BIP44 Gap Limit Rule

**BIP44 Standard**: Stop scanning after finding 20 consecutive unused addresses.

```
Example:
- Found addresses at indices: 0, 1, 2, 5, 8, 12
- Last found: index 12
- Scan until: index 32 (12 + 20 gap limit)
- If indices 13-32 are all empty, stop
- Estimation: ~32 total addresses maximum
```

---

## 📈 Information You Can Extract

### 1. **Total Number of Side Wallets**

```sql
-- Count addresses derived from same seed
SELECT seed_id, COUNT(*) as total_addresses
FROM crypto_wallets
WHERE seed_id IS NOT NULL
GROUP BY seed_id
ORDER BY total_addresses DESC;
```

**Example Output**:
```
seed_id          | total_addresses
-----------------|----------------
abc123...        | 15
def456...        | 8
ghi789...        | 3
```

**Interpretation**: Seed `abc123` has **15 known addresses**. Likely 20-35 total addresses (including undiscovered).

### 2. **Wallet Software Identification**

```typescript
import { identifyWalletSoftware } from '@/lib/hd-wallet-analyzer'

const paths = [
  "m/44'/60'/0'/0/0",
  "m/44'/60'/0'/0/1",
  "m/44'/60'/0'/0/2"
]

const detected = identifyWalletSoftware(paths)
// Result: [{ name: "MetaMask", confidence: "high" }]
```

**Indicators**:
- `m/44'/60'/0'/0/x` → MetaMask, Coinbase Wallet, Trust Wallet (ETH)
- `m/44'/501'/x'/0'` → Phantom, Solflare (Solana)
- `m/84'/0'/0'/0/x` → Bitcoin SegWit wallet (Electrum, Ledger)

### 3. **Multi-Blockchain Usage**

```sql
-- Check if same seed used across multiple blockchains
SELECT seed_id, GROUP_CONCAT(DISTINCT blockchain) as blockchains, COUNT(*) as addresses
FROM crypto_wallets
WHERE seed_id IS NOT NULL
GROUP BY seed_id
HAVING COUNT(DISTINCT blockchain) > 1;
```

**Example Output**:
```
seed_id    | blockchains  | addresses
-----------|--------------|----------
abc123...  | ETH,BTC,SOL  | 25
```

**Interpretation**: This user has **25 addresses** across **3 blockchains** from one seed.

### 4. **Activity Patterns by Index**

```sql
-- See which address indices are actively used
SELECT address_index, COUNT(*) as count
FROM crypto_wallets
WHERE seed_id = 'abc123...'
GROUP BY address_index
ORDER BY address_index;
```

**Example Output**:
```
address_index | count
--------------|------
0             | 1
1             | 1
2             | 1
5             | 1
12            | 1
```

**Interpretation**: User created addresses at indices 0,1,2,5,12. Gaps suggest:
- Indices 3,4 might exist but not captured
- Indices 6-11 likely unused
- Scan up to index 32 (12 + 20 gap limit)

---

## 🛠️ Practical Usage

### Scenario 1: Found One MetaMask Address

```
Found: 0xabcd1234... (from browser extension)
```

**Action**:
1. Extract seed phrase from MetaMask vault (if encrypted)
2. Derive addresses for `m/44'/60'/0'/0/0` through `m/44'/60'/0'/0/20`
3. Check blockchain explorers for balances on each address
4. Identify which addresses have activity

**Tools**:
```bash
# Use Ian Coleman's BIP39 tool (offline!)
# https://github.com/iancoleman/bip39
# Or use the derivation code above
```

### Scenario 2: Found Seed Phrase in Text File

```
Found: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

**Action**:
1. Derive addresses for ALL major blockchains:
   - ETH: `m/44'/60'/0'/0/x`
   - BTC: `m/84'/0'/0'/0/x`
   - SOL: `m/44'/501'/x'/0'`
   - BNB: `m/44'/714'/0'/0/x`
2. Check each derived address on blockchain explorers
3. Calculate total value across all addresses

**Estimation**: For a 12-word seed, assuming standard patterns:
- **20-50 Ethereum addresses** possible
- **10-30 Bitcoin addresses** possible
- **5-20 Solana accounts** possible
- **Total**: 35-100 unique addresses from one seed

### Scenario 3: Found Multiple Addresses with Patterns

```
Found addresses:
- 0xabc... (path: m/44'/60'/0'/0/0)
- 0xdef... (path: m/44'/60'/0'/0/1)
- 0x123... (path: m/44'/60'/0'/0/2)
```

**Deduction**:
- Sequential indices (0,1,2) → Same seed
- Pattern: `m/44'/60'/0'/0/x` → MetaMask
- **Likely**: Indices 3-22 also exist
- **Action**: Attempt to find seed phrase in MetaMask vault or backups

---

## ⚠️ Important Notes

### 1. **Encryption Matters**

MetaMask stores seeds **encrypted** in:
```
Chrome:
Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn/
```

**Vault Structure**:
```json
{
  "vault": "encrypted_data_here",
  "data": { ... }
}
```

Decryption requires the **wallet password**. Without it, you can't derive addresses.

### 2. **Gap Limit is a Guideline**

While BIP44 recommends stopping at 20 consecutive empty addresses, some users:
- Create addresses sporadically (index 0, then 50, then 100)
- Use different wallet software with different gap limits
- Have addresses on testnets vs mainnets

**Best Practice**: Scan 0-100 for high-value targets.

### 3. **Privacy Considerations**

**IMPORTANT**: This tool is for **defensive security analysis** only:
- ✅ Analyzing compromised credentials YOU own
- ✅ Security research on malware samples
- ✅ Forensic investigation with proper authorization
- ❌ Unauthorized access to others' wallets
- ❌ Theft or misuse of discovered credentials

---

## 📚 References

- **BIP32**: Hierarchical Deterministic Wallets - https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- **BIP39**: Mnemonic code for generating deterministic keys - https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- **BIP44**: Multi-Account Hierarchy for Deterministic Wallets - https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
- **SLIP-0044**: Registered coin types - https://github.com/satoshilabs/slips/blob/master/slip-0044.md

---

## 🔧 Implementation Checklist

- [x] Derivation path analyzer library
- [x] Database schema for HD wallet tracking
- [x] Pattern detection algorithms
- [x] Wallet software identification
- [ ] UI component for HD wallet visualization
- [ ] Automatic seed phrase detection in files
- [ ] Derivation for Bitcoin/Solana/other chains
- [ ] Balance checking integration
