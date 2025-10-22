/**
 * Category Detection and Risk Scoring
 *
 * Based on logSniper's category system with 18+ predefined categories.
 * Automatically tags credentials, cookies, and wallets by category during parsing.
 * Implements risk scoring for high-value target identification.
 */

export enum CredentialCategory {
  CRYPTO = 'crypto',
  BANKING = 'banking',
  ECOMMERCE = 'ecommerce',
  EMAIL = 'email',
  GAMING = 'gaming',
  CLOUD = 'cloud',
  SOCIAL = 'social',
  PASSWORD_MANAGER = 'password_manager',
  WORK = 'work',
  DEVELOPER = 'developer',
  SUBSCRIPTION = 'subscription',
  TRAVEL = 'travel',
  BETTING = 'betting',
  ADULT = 'adult',
  LEARNING = 'learning',
  DELIVERY = 'delivery',
  TICKETS = 'tickets',
  VPN = 'vpn',
  OTHER = 'other'
}

export enum RiskLevel {
  CRITICAL = 'critical',  // 90-100: Crypto exchanges, banks, password managers
  HIGH = 'high',          // 70-89: Cloud services, work accounts, developer tools
  MEDIUM = 'medium',      // 40-69: Social media, gaming, ecommerce
  LOW = 'low',            // 0-39: Other services
  UNKNOWN = 'unknown'
}

export interface CategoryMatch {
  categories: CredentialCategory[]
  primaryCategory: CredentialCategory
  riskLevel: RiskLevel
  riskScore: number  // 0-100
  keywords: string[]  // Matched keywords for this categorization
}

/**
 * Category wordlists based on logSniper's classification
 * Expanded with more modern platforms and services
 */
const CATEGORY_KEYWORDS: Record<CredentialCategory, string[]> = {
  [CredentialCategory.CRYPTO]: [
    // Exchanges
    'binance', 'coinbase', 'kraken', 'bitfinex', 'bitstamp', 'gemini', 'crypto.com',
    'kucoin', 'bybit', 'okx', 'gate.io', 'huobi', 'bittrex', 'poloniex', 'ftx',
    'bitmart', 'mexc', 'bitget', 'coinex', 'bitmex',
    // Wallets
    'blockchain.com', 'wallet', 'metamask', 'phantom', 'trust', 'exodus', 'atomic',
    'myetherwallet', 'mycrypto', 'electrum', 'jaxx', 'coinomi', 'guarda',
    // DeFi
    'uniswap', 'pancakeswap', 'sushiswap', 'curve', 'aave', 'compound', 'makerdao',
    'yearn', '1inch', 'balancer',
    // NFT
    'opensea', 'rarible', 'blur', 'looksrare', 'magiceden',
    // Mining
    'nicehash', 'ethermine', 'pool', 'mining'
  ],

  [CredentialCategory.BANKING]: [
    // US Banks
    'chase', 'wellsfargo', 'bankofamerica', 'citi', 'usbank', 'pnc', 'truist',
    'capitalone', 'td', 'schwab', 'fidelity', 'vanguard',
    // Payments
    'paypal', 'venmo', 'cashapp', 'zelle', 'stripe', 'square', 'braintree',
    'worldpay', 'adyen', 'klarna', 'afterpay', 'affirm',
    // International
    'hsbc', 'barclays', 'santander', 'bnpparibas', 'deutschebank', 'revolut',
    'n26', 'wise', 'transferwise', 'monzo', 'starling',
    // Investment
    'robinhood', 'etrade', 'webull', 'interactive', 'trading212', 'degiro'
  ],

  [CredentialCategory.ECOMMERCE]: [
    'amazon', 'ebay', 'etsy', 'shopify', 'walmart', 'target', 'bestbuy',
    'aliexpress', 'alibaba', 'wish', 'mercadolibre', 'rakuten', 'zalando',
    'asos', 'wayfair', 'overstock', 'newegg', 'gearbest', 'banggood'
  ],

  [CredentialCategory.EMAIL]: [
    'gmail', 'outlook', 'yahoo', 'protonmail', 'icloud', 'aol', 'zoho',
    'yandex', 'mail.ru', 'gmx', 'fastmail', 'tutanota', 'mailbox',
    'mail.com', 'inbox', 'proton'
  ],

  [CredentialCategory.GAMING]: [
    // Platforms
    'steam', 'epicgames', 'origin', 'uplay', 'battlenet', 'gog', 'rockstar',
    'bethesda', 'xbox', 'playstation', 'nintendo', 'twitch', 'discord',
    // Games
    'roblox', 'minecraft', 'fortnite', 'valorant', 'leagueoflegends', 'dota',
    'csgo', 'pubg', 'apex', 'warzone', 'overwatch', 'hearthstone', 'worldofwarcraft',
    // Marketplaces
    'g2a', 'kinguin', 'cdkeys', 'humblebundle', 'fanatical'
  ],

  [CredentialCategory.CLOUD]: [
    // Storage
    'dropbox', 'google drive', 'onedrive', 'icloud', 'box', 'mega', 'sync.com',
    'pcloud', 'tresorit', 'nextcloud', 'owncloud',
    // Cloud Platforms
    'aws', 'amazon.com/aws', 'console.aws', 'azure', 'gcp', 'google.com/cloud',
    'digitalocean', 'linode', 'vultr', 'heroku', 'netlify', 'vercel',
    'cloudflare', 'oracle cloud', 'ibm cloud'
  ],

  [CredentialCategory.SOCIAL]: [
    'facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'snapchat',
    'reddit', 'pinterest', 'tumblr', 'vk', 'telegram', 'whatsapp', 'signal',
    'wechat', 'line', 'viber', 'messenger', 'discord', 'slack', 'teams',
    'zoom', 'skype', 'meet.google'
  ],

  [CredentialCategory.PASSWORD_MANAGER]: [
    '1password', 'lastpass', 'bitwarden', 'dashlane', 'keeper', 'nordpass',
    'roboform', 'passwordboss', 'true key', 'sticky password', 'enpass',
    'myki', 'zoho vault'
  ],

  [CredentialCategory.WORK]: [
    // Productivity
    'office365', 'microsoft365', 'sharepoint', 'onedrive', 'outlook',
    'google workspace', 'gsuite', 'slack', 'asana', 'trello', 'jira',
    'confluence', 'notion', 'monday.com', 'clickup', 'basecamp',
    // HR/Payroll
    'adp', 'paychex', 'gusto', 'bamboohr', 'workday', 'namely',
    // Enterprise
    'salesforce', 'hubspot', 'zendesk', 'servicenow', 'sap', 'oracle'
  ],

  [CredentialCategory.DEVELOPER]: [
    // Code Hosting
    'github', 'gitlab', 'bitbucket', 'sourceforge', 'codeberg',
    // CI/CD
    'jenkins', 'travis', 'circleci', 'gitlab-ci', 'github actions',
    // Package Managers
    'npmjs', 'pypi', 'nuget', 'rubygems', 'packagist',
    // Other
    'stackoverflow', 'docker', 'kubernetes', 'terraform', 'ansible',
    'atlassian', 'jetbrains'
  ],

  [CredentialCategory.SUBSCRIPTION]: [
    // Streaming
    'netflix', 'hulu', 'disney', 'hbo', 'prime video', 'paramount',
    'peacock', 'apple tv', 'youtube premium', 'crunchyroll', 'funimation',
    // Music
    'spotify', 'apple music', 'tidal', 'deezer', 'soundcloud', 'pandora',
    // News
    'nytimes', 'wsj', 'washington post', 'medium', 'substack',
    // Software
    'adobe', 'canva', 'figma', 'sketch', 'autodesk'
  ],

  [CredentialCategory.TRAVEL]: [
    'expedia', 'booking', 'airbnb', 'hotels.com', 'priceline', 'kayak',
    'tripadvisor', 'vrbo', 'uber', 'lyft', 'delta', 'american airlines',
    'united', 'southwest', 'jetblue', 'marriott', 'hilton', 'hyatt',
    'hertz', 'enterprise', 'avis', 'budget'
  ],

  [CredentialCategory.BETTING]: [
    'draftkings', 'fanduel', 'betmgm', 'caesars', 'bet365', 'unibet',
    'pokerstars', 'stake', 'bwin', 'pinnacle', 'bovada', 'betonline',
    '888', 'william hill', 'ladbrokes', 'paddypower'
  ],

  [CredentialCategory.ADULT]: [
    'onlyfans', 'pornhub', 'xvideos', 'xnxx', 'redtube', 'brazzers',
    'chaturbate', 'stripchat', 'cam4', 'livejasmin', 'myfreecams',
    'admireme', 'fansly', 'manyvids'
  ],

  [CredentialCategory.LEARNING]: [
    'coursera', 'udemy', 'edx', 'linkedin learning', 'skillshare', 'pluralsight',
    'codecademy', 'datacamp', 'khan academy', 'brilliant', 'masterclass',
    'udacity', 'treehouse', 'lynda', 'coursera'
  ],

  [CredentialCategory.DELIVERY]: [
    'uber eats', 'doordash', 'grubhub', 'postmates', 'instacart', 'shipt',
    'deliveroo', 'just eat', 'seamless', 'caviar', 'gopuff'
  ],

  [CredentialCategory.TICKETS]: [
    'ticketmaster', 'stubhub', 'seatgeek', 'vivid seats', 'eventbrite',
    'tickpick', 'gametime', 'axs', 'viagogo'
  ],

  [CredentialCategory.VPN]: [
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'ipvanish',
    'private internet access', 'pia', 'purevpn', 'hotspot shield',
    'tunnelbear', 'windscribe', 'protonvpn', 'mullvad'
  ],

  [CredentialCategory.OTHER]: []
}

/**
 * Risk scores by category (0-100)
 */
const CATEGORY_RISK_SCORES: Record<CredentialCategory, number> = {
  [CredentialCategory.CRYPTO]: 100,           // Critical: Direct financial access
  [CredentialCategory.BANKING]: 95,           // Critical: Direct financial access
  [CredentialCategory.PASSWORD_MANAGER]: 90,  // Critical: Access to all other accounts
  [CredentialCategory.CLOUD]: 80,             // High: Cloud infrastructure, data access
  [CredentialCategory.DEVELOPER]: 75,         // High: Code, CI/CD, package repos
  [CredentialCategory.WORK]: 70,              // High: Corporate access
  [CredentialCategory.EMAIL]: 65,             // High: Password reset access
  [CredentialCategory.SOCIAL]: 50,            // Medium: Social engineering, reputation
  [CredentialCategory.ECOMMERCE]: 45,         // Medium: Stored payment methods
  [CredentialCategory.GAMING]: 40,            // Medium: Valuable accounts, items
  [CredentialCategory.SUBSCRIPTION]: 35,      // Medium: Service access
  [CredentialCategory.BETTING]: 35,           // Medium: Financial accounts
  [CredentialCategory.VPN]: 30,               // Low-Medium: Privacy tools
  [CredentialCategory.TRAVEL]: 25,            // Low: Loyalty points
  [CredentialCategory.LEARNING]: 20,          // Low: Educational access
  [CredentialCategory.DELIVERY]: 20,          // Low: Food delivery
  [CredentialCategory.TICKETS]: 15,           // Low: Event tickets
  [CredentialCategory.ADULT]: 10,             // Low: Blackmail potential
  [CredentialCategory.OTHER]: 5               // Unknown/low value
}

/**
 * Detect categories from URL or domain
 */
export function detectCategories(url: string): CategoryMatch {
  const normalizedUrl = url.toLowerCase()
  const matchedCategories: Set<CredentialCategory> = new Set()
  const matchedKeywords: string[] = []

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedUrl.includes(keyword)) {
        matchedCategories.add(category as CredentialCategory)
        matchedKeywords.push(keyword)
        break // Only count first match per category
      }
    }
  }

  // If no matches, assign OTHER
  if (matchedCategories.size === 0) {
    matchedCategories.add(CredentialCategory.OTHER)
  }

  // Convert to array and sort by risk score
  const categories = Array.from(matchedCategories).sort((a, b) => {
    return CATEGORY_RISK_SCORES[b] - CATEGORY_RISK_SCORES[a]
  })

  // Primary category is the highest risk one
  const primaryCategory = categories[0]

  // Calculate overall risk score
  const riskScore = CATEGORY_RISK_SCORES[primaryCategory]

  // Determine risk level
  let riskLevel: RiskLevel
  if (riskScore >= 90) riskLevel = RiskLevel.CRITICAL
  else if (riskScore >= 70) riskLevel = RiskLevel.HIGH
  else if (riskScore >= 40) riskLevel = RiskLevel.MEDIUM
  else if (riskScore > 0) riskLevel = RiskLevel.LOW
  else riskLevel = RiskLevel.UNKNOWN

  return {
    categories,
    primaryCategory,
    riskLevel,
    riskScore,
    keywords: matchedKeywords
  }
}

/**
 * Get risk level badge color for UI
 */
export function getRiskLevelColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case RiskLevel.CRITICAL:
      return 'bg-red-500 text-white'
    case RiskLevel.HIGH:
      return 'bg-orange-500 text-white'
    case RiskLevel.MEDIUM:
      return 'bg-yellow-500 text-white'
    case RiskLevel.LOW:
      return 'bg-blue-500 text-white'
    case RiskLevel.UNKNOWN:
    default:
      return 'bg-gray-500 text-white'
  }
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: CredentialCategory): string {
  const names: Record<CredentialCategory, string> = {
    [CredentialCategory.CRYPTO]: 'Cryptocurrency',
    [CredentialCategory.BANKING]: 'Banking & Finance',
    [CredentialCategory.ECOMMERCE]: 'E-Commerce',
    [CredentialCategory.EMAIL]: 'Email',
    [CredentialCategory.GAMING]: 'Gaming',
    [CredentialCategory.CLOUD]: 'Cloud Services',
    [CredentialCategory.SOCIAL]: 'Social Media',
    [CredentialCategory.PASSWORD_MANAGER]: 'Password Manager',
    [CredentialCategory.WORK]: 'Work & Productivity',
    [CredentialCategory.DEVELOPER]: 'Developer Tools',
    [CredentialCategory.SUBSCRIPTION]: 'Subscriptions',
    [CredentialCategory.TRAVEL]: 'Travel & Transportation',
    [CredentialCategory.BETTING]: 'Betting & Gambling',
    [CredentialCategory.ADULT]: 'Adult Content',
    [CredentialCategory.LEARNING]: 'Education & Learning',
    [CredentialCategory.DELIVERY]: 'Food & Delivery',
    [CredentialCategory.TICKETS]: 'Events & Tickets',
    [CredentialCategory.VPN]: 'VPN & Privacy',
    [CredentialCategory.OTHER]: 'Other'
  }
  return names[category] || category
}

/**
 * Get category icon (emoji)
 */
export function getCategoryIcon(category: CredentialCategory): string {
  const icons: Record<CredentialCategory, string> = {
    [CredentialCategory.CRYPTO]: '₿',
    [CredentialCategory.BANKING]: '🏦',
    [CredentialCategory.ECOMMERCE]: '🛒',
    [CredentialCategory.EMAIL]: '📧',
    [CredentialCategory.GAMING]: '🎮',
    [CredentialCategory.CLOUD]: '☁️',
    [CredentialCategory.SOCIAL]: '👥',
    [CredentialCategory.PASSWORD_MANAGER]: '🔐',
    [CredentialCategory.WORK]: '💼',
    [CredentialCategory.DEVELOPER]: '👨‍💻',
    [CredentialCategory.SUBSCRIPTION]: '📺',
    [CredentialCategory.TRAVEL]: '✈️',
    [CredentialCategory.BETTING]: '🎰',
    [CredentialCategory.ADULT]: '🔞',
    [CredentialCategory.LEARNING]: '📚',
    [CredentialCategory.DELIVERY]: '🚚',
    [CredentialCategory.TICKETS]: '🎫',
    [CredentialCategory.VPN]: '🔒',
    [CredentialCategory.OTHER]: '📁'
  }
  return icons[category] || '❓'
}
