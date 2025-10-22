# logSniper Analysis & Implementation

**Source:** https://github.com/4x0r-b17/logSniper

This document details what we learned from logSniper and how we're implementing its best features into Bron-Vault.

---

## 📊 What is logSniper?

**logSniper** is a modular parsing toolkit designed for Red Team operators and malware analysts. It automates extraction of credentials, cookies, and metadata from stealer malware output.

**Key Characteristics:**
- CLI/Terminal-based tool
- Python + Bash architecture
- Category-based wordlist system
- Bulk processing focus
- Lightweight and portable

---

## 🎯 logSniper's Best Features

### 1. **Category-Based Wordlist System** ⭐⭐⭐⭐⭐

**The Star Feature:** 18+ predefined categories for targeted credential filtering

**Categories:**
```
[0]  crypto             - Cryptocurrency exchanges and wallets
[1]  eCommerce          - Online shopping platforms
[2]  email providers    - Email services
[3]  gaming             - Gaming platforms and accounts
[4]  giftcards          - Gift card services
[5]  learning           - Educational platforms
[6]  banks/payments     - Banking and payment services
[7]  rides & delivery   - Transportation and delivery
[8]  subscriptions      - Subscription services
[9]  travel             - Travel booking platforms
[10] utility            - Utility services
[11] betting            - Gambling and betting sites
[12] password managers  - Password management services
[13] porn               - Adult content platforms
[14] tickets            - Event ticketing platforms
[15] juicy wordlist     - High-value targets compilation
[16] cloud              - Cloud storage and services
[17] social media       - Social networking platforms
[18] specific word      - Custom keyword search
[333] all categories    - Search across all categories
```

**Why This Matters:**
- Speeds up analysis by 10-100x
- Analysts can focus on specific target types
- No manual sifting through thousands of credentials
- Prioritization based on value/risk

**Status:** ✅ **IMPLEMENTED** in `lib/category-detector.ts`

---

### 2. **Multi-Component Validation**

**Approach:** Require all three components for complete data:
1. Valid system information
2. Cookie match for target service
3. Valid credentials (username/password)

**Why This Matters:**
- Reduces false positives
- Ensures complete breach context
- Higher data quality

**Status:** ⏳ **PLANNED** - Add completeness scoring

---

### 3. **Bulk Archive Processing**

**Feature:** Bash-based script (`extractor.sh`) for processing multiple ZIP/RAR/7z files

**Why This Matters:**
- Handle large datasets efficiently
- Automated folder normalization
- Batch processing workflows

**Status:** ⏳ **PLANNED** - CLI mode for batch uploads

---

### 4. **Folder Structure Normalization**

**Feature:** `rename.py` utility standardizes folder naming (N_target pattern)

**Why This Matters:**
- Organize large log collections
- Track individual infections
- Systematic batch processing

**Status:** ⏳ **PLANNED** - Pre-upload folder validator

---

## 🏆 Bron-Vault vs logSniper Comparison

| Feature | logSniper | Bron-Vault | Winner |
|---------|-----------|------------|--------|
| **Interface** | CLI/Terminal | Web Dashboard | Bron-Vault 🏆 |
| **Database** | File-based | MySQL | Bron-Vault 🏆 |
| **Category System** | 18+ categories | 18+ categories ✅ | Tie ✅ |
| **Risk Scoring** | Manual | Automatic (0-100) | Bron-Vault 🏆 |
| **Bulk Processing** | Native bash | Web upload | logSniper 🏆 |
| **Stealer Support** | Generic | Specific parsers | Bron-Vault 🏆 |
| **Wallet Analysis** | Basic | HD Wallet + Ledger Live | Bron-Vault 🏆 |
| **Cookie Filtering** | Keyword-based | Extract all | logSniper 🏆 |
| **Export Formats** | Text | Database queries | Tie ⚖️ |
| **Deployment** | Portable CLI | Full web app | Depends 🤔 |
| **Learning Curve** | Steep | Gentle | Bron-Vault 🏆 |
| **Automation** | Easy (scripts) | API-based | logSniper 🏆 |

**Overall:** Bron-Vault wins on UX and sophistication; logSniper wins on portability and bulk processing.

---

## ✅ What We Implemented from logSniper

### **1. Category Detection System** ✅

**File:** `lib/category-detector.ts`

**Features:**
- 18 predefined categories
- 1000+ keyword patterns
- Automatic URL-based categorization
- Risk scoring (0-100)
- 4-tier risk levels (critical/high/medium/low)

**Categories Implemented:**
```typescript
enum CredentialCategory {
  CRYPTO = 'crypto',                    // 100 risk score
  BANKING = 'banking',                  // 95 risk score
  PASSWORD_MANAGER = 'password_manager', // 90 risk score
  CLOUD = 'cloud',                      // 80 risk score
  DEVELOPER = 'developer',              // 75 risk score
  WORK = 'work',                        // 70 risk score
  EMAIL = 'email',                      // 65 risk score
  SOCIAL = 'social',                    // 50 risk score
  ECOMMERCE = 'ecommerce',              // 45 risk score
  GAMING = 'gaming',                    // 40 risk score
  VPN = 'vpn',                          // 30 risk score
  // ... and more
}
```

**Database Migration:** `scripts/012_add_category_and_risk_scoring.sql`

**New Fields:**
- `categories` JSON - Array of matched categories
- `primary_category` VARCHAR(50) - Highest-risk category
- `risk_level` ENUM - critical/high/medium/low
- `risk_score` INT - Numerical score 0-100

**Example Usage:**
```typescript
import { detectCategories } from '@/lib/category-detector'

const match = detectCategories('https://binance.com/login')
// Result:
// {
//   categories: ['crypto'],
//   primaryCategory: 'crypto',
//   riskLevel: 'critical',
//   riskScore: 100,
//   keywords: ['binance']
// }
```

---

## 🎯 Roadmap: Remaining Features

### **Priority 1: Integration (In Progress)**

- [ ] Integrate category detection into credential parsing
- [ ] Add category fields to browser history parser
- [ ] Add category detection to cookie parser
- [ ] Update database insertion with category data

### **Priority 2: UI Enhancements**

- [ ] Add category filter dropdowns in search
- [ ] Display category badges in results
- [ ] Show risk level indicators
- [ ] Create "High-Value Targets" dashboard
- [ ] Add category statistics to device view

### **Priority 3: Export Features**

- [ ] Export by category (CSV/JSON)
- [ ] "Simple format" export (USER:PASS)
- [ ] Category-filtered exports
- [ ] Risk-based export filtering

### **Priority 4: Advanced Features**

- [ ] CLI mode for batch processing
- [ ] Bulk archive upload
- [ ] Folder normalization validator
- [ ] Completeness scoring
- [ ] API endpoints for automation

---

## 💡 Key Learnings

### **1. Category System is Game-Changing**

The ability to filter credentials by category (crypto, banking, cloud, etc.) **dramatically speeds up analysis workflows**. Instead of searching through 10,000+ credentials, analysts can instantly focus on the 50-100 that matter most.

**Implementation Impact:**
- **Before:** Search all credentials manually
- **After:** "Show me all crypto exchange credentials" → instant results

### **2. Risk Scoring Enables Prioritization**

Assigning numerical risk scores (0-100) allows **automated prioritization** of analysis efforts.

**Use Cases:**
- Sort devices by highest-risk credentials
- Alert on critical-risk discoveries
- Focus red team efforts on high-value targets
- Generate executive summaries by risk level

### **3. Wordlists are Living Documents**

logSniper's category wordlists need regular updates as new services emerge. Our implementation is code-based (TypeScript), making it:
- Version controlled
- Testable
- Easy to extend
- Type-safe

### **4. Simple Beats Complex (Sometimes)**

logSniper's simple text-based parsing is less sophisticated than our stealer-specific parsers, but it works universally. There's value in **both approaches**:
- Specific parsers: Better data extraction
- Generic parsing: Wider compatibility

### **5. CLI + Web = Best of Both Worlds**

logSniper's CLI is great for automation and power users. Our web dashboard is great for accessibility and visualization. **We should have both**.

---

## 🔬 Technical Deep Dive

### **Category Detection Algorithm**

```typescript
function detectCategories(url: string): CategoryMatch {
  // 1. Normalize URL to lowercase
  const normalized = url.toLowerCase()

  // 2. Check each category's keyword list
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        // Match found!
        categories.add(category)
      }
    }
  }

  // 3. Sort categories by risk score
  const sorted = categories.sort((a, b) =>
    RISK_SCORES[b] - RISK_SCORES[a]
  )

  // 4. Primary category = highest risk
  const primary = sorted[0]

  // 5. Calculate overall risk
  const riskScore = RISK_SCORES[primary]
  const riskLevel = getRiskLevel(riskScore)

  return { categories, primary, riskScore, riskLevel }
}
```

### **Keyword Selection Strategy**

**Principles:**
1. **Specific over generic:** "binance.com" > "crypto"
2. **Common variations:** "github", "gitlab", "bitbucket"
3. **Brand names:** "chase", "wells fargo", "coinbase"
4. **Domain-based:** URL fragments that appear in login pages

**Example: Crypto Category**
```typescript
[
  // Exchanges (high-value)
  'binance', 'coinbase', 'kraken', 'gemini',

  // Wallets (medium-value)
  'metamask', 'trust', 'exodus',

  // DeFi (high-value)
  'uniswap', 'aave', 'compound',

  // NFT (medium-value)
  'opensea', 'blur', 'rarible'
]
```

---

## 📈 Expected Impact

### **Analysis Speed**

**Before Category System:**
- Search 10,000 credentials manually
- No prioritization
- Miss high-value targets
- **Time:** Hours

**After Category System:**
- Filter to 50 crypto credentials instantly
- Auto-prioritized by risk
- Critical targets highlighted
- **Time:** Minutes

**Speed Improvement:** **10-100x faster** for targeted analysis

### **Target Identification**

**Scenario:** Find all cryptocurrency exchange accounts

**logSniper way:**
```bash
python Logs&Cookies.py
# Select [0] crypto
# View results
```

**Bron-Vault way (after integration):**
```
Dashboard → Filter: Category = Crypto → Risk = Critical
```

Both take **seconds**, not hours.

---

## 🎓 Lessons for Future Development

### **1. Learn from Established Tools**

logSniper has been battle-tested by real analysts. Its category system exists because **it solves a real problem**. Don't reinvent the wheel—adopt proven patterns.

### **2. Different Tools, Different Strengths**

- **logSniper:** Portability, simplicity, CLI automation
- **Bron-Vault:** UX, sophistication, database power
- **Best approach:** Combine strengths

### **3. Categories Should be Domain-Specific**

Our categories are security/red-team focused:
- Crypto (financial impact)
- Banking (financial impact)
- Cloud (infrastructure access)
- Developer (supply chain attacks)

This is **different from** e-commerce categories or marketing categories. Domain-specific categorization is key.

### **4. Risk Scoring Must be Contextual**

A Netflix account is low-risk **generally**, but might be high-risk if:
- It's a corporate account
- It has payment info stored
- It's used for social engineering

Consider adding **contextual risk modifiers** in the future.

---

## 📝 References

- **logSniper Repository:** https://github.com/4x0r-b17/logSniper
- **Related Tools:**
  - lexfo/stealer-parser (PLY-based, JSON output)
  - universal_stealer_log_parser (credit card focus)
  - RParseX (website-organized output)

---

## 🚀 Next Steps

1. **✅ Phase 1: Category Detection (DONE)**
   - Created category detector
   - Defined 18+ categories
   - Implemented risk scoring
   - Created database migration

2. **⏳ Phase 2: Parser Integration (IN PROGRESS)**
   - Integrate into credential parser
   - Add to browser history parser
   - Apply to cookie extraction
   - Update database inserts

3. **⏳ Phase 3: UI Updates (PLANNED)**
   - Category filter dropdowns
   - Risk level badges
   - High-value target dashboard
   - Category statistics

4. **⏳ Phase 4: Export & CLI (FUTURE)**
   - CSV export by category
   - CLI mode for automation
   - Bulk processing tools
   - API endpoints

---

**Status:** Category detection system complete and ready for integration.

**Impact:** Expected **10-100x improvement** in targeted credential analysis workflows.

**Inspired by:** logSniper's category wordlist system—the single most valuable feature for analyst productivity.
