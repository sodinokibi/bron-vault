/**
 * Category Detection and Risk Scoring
 *
 * Comprehensive expansion with 25 categories and 850+ keywords for global coverage.
 * Based on logSniper's classification system with major enhancements.
 *
 * Automatically tags credentials, cookies, and browser history by category during parsing.
 * Implements tiered risk scoring (0-100) for high-value target identification.
 *
 * STATISTICS:
 * - 25 Total Categories (19 original + 6 new)
 * - 850+ Total Keywords (up from 350)
 * - Global Coverage: US, EU, Asia, LATAM platforms
 * - 6 Risk Tiers: CRITICAL (90-100), HIGH (70-89), MEDIUM-HIGH (60-69),
 *                 MEDIUM (40-59), LOW-MEDIUM (30-39), LOW (0-29)
 *
 * NEW CATEGORIES (v2.0):
 * - Healthcare (85 risk) - Patient portals, HIPAA data, pharmacies
 * - Government (95 risk) - IRS, SSA, ID.me, official documents
 * - Remote Access (95 risk) - TeamViewer, RDP, system access
 * - Domain/Hosting (75 risk) - DNS control, web hosting, cPanel
 * - File Hosting (60 risk) - WeTransfer, file lockers, cloud storage
 * - Crypto Tools (90 risk) - Block explorers, portfolio trackers, analytics
 *
 * EXPANDED CATEGORIES:
 * - Crypto: 100+ keywords (exchanges, wallets, DeFi, NFT, staking, L2s)
 * - Banking: 100+ keywords (global banks, neobanks, investment, remittance)
 * - Gaming: 60+ keywords (platforms, games, marketplaces, mobile)
 * - Developer: 70+ keywords (repos, CI/CD, monitoring, registries)
 * - And 15+ more comprehensively expanded categories
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
  HEALTHCARE = 'healthcare',
  GOVERNMENT = 'government',
  REMOTE_ACCESS = 'remote_access',
  DOMAIN_HOSTING = 'domain_hosting',
  FILE_HOSTING = 'file_hosting',
  CRYPTO_TOOLS = 'crypto_tools',
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
 * Comprehensively expanded with 500+ keywords covering global platforms
 * Updated: 2025-10 - Major expansion with regional coverage
 */
const CATEGORY_KEYWORDS: Record<CredentialCategory, string[]> = {
  [CredentialCategory.CRYPTO]: [
    // Major Exchanges (Global)
    'binance', 'coinbase', 'kraken', 'bitfinex', 'bitstamp', 'gemini', 'crypto.com',
    'kucoin', 'bybit', 'okx', 'gate.io', 'huobi', 'bittrex', 'poloniex', 'ftx',
    'bitmart', 'mexc', 'bitget', 'coinex', 'bitmex', 'phemex', 'deribit',
    // Regional Exchanges
    'bitso', 'mercadobitcoin', 'luno', 'paxful', 'localbitcoins', 'btcmarkets',
    'independent reserve', 'coinspot', 'swyftx', 'coinsquare', 'ndax',
    'wazirx', 'coindcx', 'zebpay', 'upbit', 'bithumb', 'coinone',
    // Wallets (Software)
    'blockchain.com', 'wallet', 'metamask', 'phantom', 'trust', 'exodus', 'atomic',
    'myetherwallet', 'mycrypto', 'electrum', 'jaxx', 'coinomi', 'guarda',
    'safepal', 'coin98', 'mathwallet', 'tokenpocket', 'imtoken', 'argent',
    'rainbow', 'zengo', 'edge', 'bread', 'brd', 'bitcoin.com',
    // Hardware Wallets (Web Interfaces)
    'ledger', 'trezor', 'keepkey', 'coldcard', 'bitbox',
    // DeFi Platforms
    'uniswap', 'pancakeswap', 'sushiswap', 'curve', 'aave', 'compound', 'makerdao',
    'yearn', '1inch', 'balancer', 'convex', 'stargate', 'gmx', 'traderjoe',
    'quickswap', 'velodrome', 'camelot', 'dodo', 'kyberswap', 'bancor',
    // Staking Platforms
    'lido', 'rocketpool', 'stakewise', 'frax', 'ankr', 'staked', 'figment',
    // NFT Marketplaces
    'opensea', 'rarible', 'blur', 'looksrare', 'magiceden', 'x2y2', 'foundation',
    'superrare', 'nifty', 'known origin', 'async', 'manifold',
    // Layer 2 / Chain Explorers
    'arbitrum', 'optimism', 'zksync', 'polygon', 'avalanche', 'fantom', 'harmony',
    // Mining Pools
    'nicehash', 'ethermine', 'f2pool', 'antpool', 'slushpool', 'poolin',
    'mining', 'minerstat', 'hiveos', 'awesome miner'
  ],

  [CredentialCategory.BANKING]: [
    // US Major Banks
    'chase', 'wellsfargo', 'bankofamerica', 'citi', 'usbank', 'pnc', 'truist',
    'capitalone', 'td', 'schwab', 'fidelity', 'vanguard', 'ally', 'marcus',
    'discover', 'navyfederal', 'usaa', 'regions', 'fifth third', 'citizens',
    'suntrust', 'key bank', 'huntington', 'santander bank', 'mufg',
    // US Credit Unions
    'navy federal', 'state employees', 'penfed', 'schools first', 'golden 1',
    // Payment Processors
    'paypal', 'venmo', 'cashapp', 'zelle', 'stripe', 'square', 'braintree',
    'worldpay', 'adyen', 'klarna', 'afterpay', 'affirm', 'sezzle', 'zip',
    'quadpay', 'splitit', 'payoneer', 'skrill', 'neteller', 'payza',
    // International Banks (Europe)
    'hsbc', 'barclays', 'santander', 'bnpparibas', 'bnp paribas', 'deutschebank',
    'deutsche bank', 'ing', 'commerzbank', 'credit agricole', 'intesa sanpaolo',
    'unicredit', 'societe generale', 'nordea', 'danske bank', 'swedbank',
    'handelsbanken', 'rabobank', 'abn amro', 'lloyds', 'nationwide', 'natwest',
    // International Banks (Asia)
    'dbs', 'ocbc', 'uob', 'maybank', 'cimb', 'icici', 'hdfc', 'axis', 'sbi',
    'kotak', 'yes bank', 'bank of china', 'icbc', 'ccb', 'abc', 'boc',
    'mitsubishi', 'sumitomo', 'mizuho',
    // Neobanks/Digital Banks
    'revolut', 'n26', 'wise', 'transferwise', 'monzo', 'starling', 'chime',
    'current', 'varo', 'dave', 'aspiration', 'sofi', 'marcus', 'simple',
    'atom bank', 'tandem', 'bunq', 'qonto', 'shine',
    // Investment Platforms
    'robinhood', 'etrade', 'webull', 'interactive', 'interactivebrokers', 'trading212',
    'degiro', 'freetrade', 'stake', 'public', 'moomoo', 'tastytrade', 'thinkorswim',
    'merrillEdge', 'ameritrade', 'tdameritrade',
    // Remittance
    'westernunion', 'moneygram', 'remitly', 'worldremit', 'xoom', 'azimo', 'instarem',
    'currencyfair', 'ofx', 'xe', 'ria', 'small world'
  ],

  [CredentialCategory.ECOMMERCE]: [
    // Major Platforms
    'amazon', 'ebay', 'etsy', 'shopify', 'walmart', 'target', 'bestbuy',
    'aliexpress', 'alibaba', 'wish', 'mercadolibre', 'rakuten', 'zalando',
    'asos', 'wayfair', 'overstock', 'newegg', 'gearbest', 'banggood',
    // US Retailers
    'macys', 'kohls', 'jcpenney', 'nordstrom', 'saks', 'bloomingdales',
    'sephora', 'ulta', 'home depot', 'lowes', 'staples', 'office depot',
    // Fashion
    'zara', 'h&m', 'gap', 'old navy', 'forever21', 'shein', 'yesstyle',
    'fashionnova', 'prettylittlething', 'boohoo', 'missguided',
    // Asian E-commerce
    'taobao', 'tmall', 'jd.com', 'pinduoduo', 'lazada', 'shopee', 'tokopedia',
    'bukalapak', 'flipkart', 'snapdeal', 'myntra', 'paytm mall',
    // Others
    'costco', 'sams club', 'ikea', 'wayfair', 'houzz', 'crate and barrel'
  ],

  [CredentialCategory.EMAIL]: [
    // Major Providers
    'gmail', 'outlook', 'yahoo', 'protonmail', 'icloud', 'aol', 'zoho',
    'yandex', 'mail.ru', 'gmx', 'fastmail', 'tutanota', 'mailbox',
    'mail.com', 'inbox', 'proton', 'live.com', 'hotmail', 'msn',
    // Privacy-Focused
    'mailfence', 'posteo', 'runbox', 'mailbox.org', 'startmail', 'countermail',
    'hushmail', 'lavabit', 'safe-mail',
    // Business Email
    'rackspace', 'intermedia', 'mimecast', 'proofpoint', 'barracuda',
    'google workspace', 'microsoft 365', 'workspace', 'exchange'
  ],

  [CredentialCategory.GAMING]: [
    // Platforms & Launchers
    'steam', 'epicgames', 'epic games', 'origin', 'uplay', 'ubisoft connect', 'battlenet',
    'battle.net', 'gog', 'rockstar', 'rockstar games', 'bethesda', 'ea app', 'ea play',
    'xbox', 'playstation', 'nintendo', 'riot', 'riot games', 'riot client',
    // Streaming
    'twitch', 'discord', 'youtube gaming', 'facebook gaming', 'mixer',
    // PC Games
    'roblox', 'minecraft', 'fortnite', 'valorant', 'leagueoflegends', 'league of legends',
    'dota', 'dota2', 'csgo', 'cs:go', 'counter-strike', 'pubg', 'apex', 'apex legends',
    'warzone', 'overwatch', 'hearthstone', 'worldofwarcraft', 'world of warcraft',
    'destiny', 'runescape', 'oldschool runescape', 'osrs', 'final fantasy xiv', 'ff14',
    'black desert', 'guildwars', 'guild wars', 'elder scrolls', 'fallout',
    // Mobile Games
    'mobilelegends', 'mobile legends', 'pubg mobile', 'free fire', 'clash of clans',
    'clash royale', 'brawl stars', 'pokemon go', 'pokemon', 'genshin', 'genshin impact',
    'honkai', 'raid shadow legends', 'candy crush',
    // Marketplaces
    'g2a', 'kinguin', 'cdkeys', 'humblebundle', 'humble', 'fanatical', 'greenmangaming',
    'gmg', 'instant gaming', 'gamivo',
    // Trading/Selling
    'playerauctions', 'g2g', 'eldorado.gg', 'odealo', 'igvault', 'mmobux'
  ],

  [CredentialCategory.CLOUD]: [
    // Cloud Storage
    'dropbox', 'google drive', 'drive.google', 'onedrive', 'icloud', 'box', 'mega',
    'sync.com', 'pcloud', 'tresorit', 'nextcloud', 'owncloud', 'backblaze', 'b2',
    'wasabi', 'filebase', 'storj', 'idrive', 'carbonite', 'crashplan', 'spideroak',
    // Cloud Platforms (IaaS/PaaS)
    'aws', 'amazon.com/aws', 'console.aws', 'azure', 'portal.azure', 'gcp',
    'google.com/cloud', 'console.cloud.google', 'digitalocean', 'linode', 'vultr',
    'heroku', 'netlify', 'vercel', 'cloudflare', 'oracle cloud', 'ibm cloud',
    'alibaba cloud', 'aliyun', 'ovh', 'scaleway', 'hetzner',
    // Collaboration Platforms
    'notion', 'coda', 'airtable', 'monday.com', 'clickup', 'smartsheet', 'asana',
    'trello', 'basecamp', 'wrike', 'podio'
  ],

  [CredentialCategory.SOCIAL]: [
    // Western Social Networks
    'facebook', 'instagram', 'twitter', 'x.com', 'linkedin', 'tiktok', 'snapchat',
    'reddit', 'pinterest', 'tumblr', 'myspace', 'friendster', 'bebo',
    // Asian Social Networks
    'vk', 'vkontakte', 'telegram', 'whatsapp', 'signal', 'wechat', 'weixin',
    'line', 'viber', 'kakao', 'kakaotalk', 'naver', 'weibo', 'qq', 'douyin',
    // Professional
    'xing', 'angellist', 'wellfound', 'meetup', 'eventbrite',
    // Messaging/Communication
    'messenger', 'discord', 'slack', 'teams', 'microsoft teams', 'zoom',
    'skype', 'meet.google', 'google meet', 'webex', 'gotomeeting', 'bluejeans',
    // Forums
    'quora', 'medium', 'substack', 'patreon', 'ko-fi', 'buymeacoffee'
  ],

  [CredentialCategory.PASSWORD_MANAGER]: [
    '1password', 'lastpass', 'bitwarden', 'dashlane', 'keeper', 'nordpass',
    'roboform', 'passwordboss', 'true key', 'sticky password', 'enpass',
    'myki', 'zoho vault', 'password safe', 'keepass', 'keepassxc',
    'passwordsafe', 'encryptr', 'blur', 'password boss'
  ],

  [CredentialCategory.WORK]: [
    // Productivity Suites
    'office365', 'microsoft365', 'sharepoint', 'onedrive', 'outlook',
    'google workspace', 'gsuite', 'g suite', 'docs.google', 'sheets.google',
    // Project Management
    'slack', 'asana', 'trello', 'jira', 'confluence', 'notion', 'monday.com',
    'clickup', 'basecamp', 'wrike', 'teamwork', 'smartsheet', 'airtable',
    'linear', 'height', 'shortcut', 'clubhouse',
    // HR/Payroll
    'adp', 'paychex', 'gusto', 'bamboohr', 'workday', 'namely', 'rippling',
    'zenefits', 'justworks', 'trinet', 'insperity', 'paylocity', 'ultipro',
    // Enterprise/CRM
    'salesforce', 'hubspot', 'zendesk', 'servicenow', 'sap', 'oracle',
    'zoho crm', 'pipedrive', 'freshworks', 'freshdesk', 'intercom', 'drift',
    'dynamics', 'netsuite', 'quickbooks', 'xero', 'sage'
  ],

  [CredentialCategory.DEVELOPER]: [
    // Code Hosting & Version Control
    'github', 'gitlab', 'bitbucket', 'sourceforge', 'codeberg', 'gitea', 'gogs',
    'launchpad', 'savannah', 'gitee',
    // CI/CD & DevOps
    'jenkins', 'travis', 'travis-ci', 'circleci', 'gitlab-ci', 'github actions',
    'azure devops', 'teamcity', 'bamboo', 'drone', 'codeship', 'semaphore',
    'ansible', 'puppet', 'chef', 'salt', 'terraform', 'vagrant', 'rancher',
    // Package Managers & Registries
    'npmjs', 'npm', 'pypi', 'nuget', 'rubygems', 'packagist', 'crates.io',
    'dockerhub', 'docker hub', 'quay.io', 'harbor', 'jfrog', 'artifactory', 'nexus',
    // Monitoring & Observability
    'datadog', 'newrelic', 'new relic', 'grafana', 'prometheus', 'sentry',
    'bugsnag', 'rollbar', 'loggly', 'splunk', 'elastic', 'elasticsearch',
    // API & Development Tools
    'postman', 'insomnia', 'rapidapi', 'swagger', 'readme.io',
    // Communities
    'stackoverflow', 'stack overflow', 'stackoverflow.com', 'stackexchange',
    // Cloud Native
    'docker', 'kubernetes', 'k8s', 'openshift', 'nomad', 'consul',
    // IDEs & Tools
    'jetbrains', 'intellij', 'pycharm', 'webstorm', 'phpstorm', 'rider',
    'visual studio', 'vscode', 'sublime', 'atom',
    // Atlassian Suite
    'atlassian', 'jira', 'confluence', 'bitbucket', 'trello'
  ],

  [CredentialCategory.SUBSCRIPTION]: [
    // Video Streaming
    'netflix', 'hulu', 'disney', 'disney+', 'disneyplus', 'hbo', 'hbo max', 'max',
    'prime video', 'amazon prime', 'paramount', 'paramount+', 'peacock',
    'apple tv', 'appletv', 'youtube premium', 'youtube tv', 'crunchyroll', 'funimation',
    'showtime', 'starz', 'cinemax', 'espn+', 'dazn', 'viki', 'viu',
    // Music Streaming
    'spotify', 'apple music', 'tidal', 'deezer', 'soundcloud', 'pandora',
    'amazon music', 'youtube music', 'qobuz', 'audiomack', 'napster',
    // News & Publications
    'nytimes', 'new york times', 'wsj', 'wall street journal', 'washington post',
    'medium', 'substack', 'economist', 'financial times', 'bloomberg', 'reuters',
    'atlantic', 'new yorker', 'wired', 'techcrunch',
    // Design & Creative Software
    'adobe', 'creative cloud', 'canva', 'figma', 'sketch', 'autodesk', 'affinity',
    'invision', 'framer', 'webflow', 'squarespace', 'wix'
  ],

  [CredentialCategory.TRAVEL]: [
    // Booking Platforms
    'expedia', 'booking', 'booking.com', 'airbnb', 'hotels.com', 'priceline', 'kayak',
    'tripadvisor', 'vrbo', 'homeaway', 'agoda', 'hostelworld', 'trivago', 'hotwire',
    // Ride Sharing
    'uber', 'lyft', 'grab', 'didi', 'bolt', 'ola', 'gett', 'via', 'curb',
    // Airlines
    'delta', 'american airlines', 'united', 'southwest', 'jetblue', 'alaska',
    'lufthansa', 'british airways', 'air france', 'klm', 'emirates', 'qatar',
    'singapore airlines', 'cathay pacific', 'qantas', 'ana', 'jal', 'ryanair', 'easyjet',
    // Hotels & Loyalty
    'marriott', 'hilton', 'hyatt', 'ihg', 'choice', 'wyndham', 'accor', 'best western',
    // Car Rentals
    'hertz', 'enterprise', 'avis', 'budget', 'national', 'alamo', 'sixt', 'thrifty', 'dollar'
  ],

  [CredentialCategory.BETTING]: [
    // US Sportsbooks
    'draftkings', 'fanduel', 'betmgm', 'caesars', 'caesars sportsbook', 'barstool',
    'pointsbet', 'foxbet', 'wynn', 'betrivers', 'sugarhouse',
    // International Betting
    'bet365', 'unibet', 'pokerstars', 'stake', 'bwin', 'pinnacle', 'bovada',
    'betonline', '888', '888sport', 'william hill', 'ladbrokes', 'paddypower',
    'betway', 'betfred', 'coral', 'skybet', 'betfair', 'smarkets', 'matchbook',
    // Poker & Casino
    'partypoker', 'ggpoker', 'winamax', 'poker.com', '888poker',
    // Fantasy Sports
    'draftkings', 'fanduel', 'yahoo fantasy', 'espn fantasy'
  ],

  [CredentialCategory.ADULT]: [
    'onlyfans', 'pornhub', 'xvideos', 'xnxx', 'redtube', 'brazzers',
    'chaturbate', 'stripchat', 'cam4', 'livejasmin', 'myfreecams',
    'admireme', 'fansly', 'manyvids', 'clips4sale', 'iwantclips',
    'modelhub', 'camster', 'camsoda', 'bongacams', 'flirt4free'
  ],

  [CredentialCategory.LEARNING]: [
    // Online Courses
    'coursera', 'udemy', 'edx', 'linkedin learning', 'skillshare', 'pluralsight',
    'codecademy', 'datacamp', 'khan academy', 'brilliant', 'masterclass',
    'udacity', 'treehouse', 'lynda', 'futurelearn', 'domestika',
    // Language Learning
    'duolingo', 'babbel', 'rosetta stone', 'busuu', 'memrise', 'italki',
    'preply', 'verbling', 'lingoda',
    // Academic
    'chegg', 'course hero', 'scribd', 'quizlet', 'studyblue', 'brainly',
    // Technical Training
    'a cloud guru', 'linux academy', 'cybrary', 'itprotv', 'cbtnuggets'
  ],

  [CredentialCategory.DELIVERY]: [
    // US Food Delivery
    'uber eats', 'ubereats', 'doordash', 'grubhub', 'postmates', 'seamless',
    'caviar', 'gopuff', 'instacart', 'shipt', 'freshdirect', 'amazon fresh',
    // International Food Delivery
    'deliveroo', 'just eat', 'justeat', 'takeaway', 'foodpanda', 'swiggy',
    'zomato', 'rappi', 'ifood', 'glovo', 'wolt', 'lieferando',
    // Grocery Delivery
    'instacart', 'shipt', 'peapod', 'freshdirect', 'thrive market'
  ],

  [CredentialCategory.TICKETS]: [
    'ticketmaster', 'stubhub', 'seatgeek', 'vivid seats', 'eventbrite',
    'tickpick', 'gametime', 'axs', 'viagogo', 'ticketnetwork', 'razorgator',
    'ticketcity', 'tiqets', 'headout', 'getyourguide', 'klook'
  ],

  [CredentialCategory.VPN]: [
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'ipvanish',
    'private internet access', 'pia', 'purevpn', 'hotspot shield',
    'tunnelbear', 'windscribe', 'protonvpn', 'mullvad', 'vyprvpn',
    'torguard', 'perfect privacy', 'airvpn', 'hide.me', 'zenmate',
    'privatevpn', 'trust.zone', 'ivacy'
  ],

  // NEW CATEGORIES

  [CredentialCategory.HEALTHCARE]: [
    // Patient Portals
    'mychart', 'epic', 'cerner', 'athenahealth', 'athena', 'nextgen', 'eclinicalworks',
    'allscripts', 'meditech', 'practice fusion', 'kareo',
    // Health Services
    'zocdoc', 'teladoc', 'doctor on demand', 'amwell', 'mdlive', 'hims', 'hers',
    'ro', 'nurx', 'lemonaid', 'plushcare', 'k health',
    // Pharmacy
    'cvs', 'walgreens', 'rite aid', 'walmart pharmacy', 'kroger pharmacy',
    'express scripts', 'optum', 'caremark',
    // Health Apps
    'goodrx', 'healthgrades', 'webmd', 'mayo clinic', 'fitbit', 'myfitnesspal',
    // Insurance
    'unitedhealthcare', 'anthem', 'aetna', 'cigna', 'humana', 'blue cross',
    'kaiser', 'healthcare.gov', 'covered california'
  ],

  [CredentialCategory.GOVERNMENT]: [
    // US Federal
    'irs.gov', 'ssa.gov', 'usa.gov', 'login.gov', 'id.me', 'usajobs', 'usps.com',
    'benefits.gov', 'healthcare.gov', 'studentaid.gov', 'fafsa',
    // State/Local
    'dmv', 'mvd', 'dol', 'edd', 'unemployment',
    // Verification Services
    'id.me', 'login.gov', 'max.gov',
    // International
    'gov.uk', 'service.gov.uk', 'canada.ca', 'mygov.au', 'ird.govt.nz'
  ],

  [CredentialCategory.REMOTE_ACCESS]: [
    // Remote Desktop
    'teamviewer', 'anydesk', 'rustdesk', 'chrome remote desktop', 'remotedesktop.google',
    'logmein', 'logmein pro', 'gotoassist', 'gotomypc', 'splashtop', 'parsec',
    'nomachine', 'realvnc', 'tightvnc', 'ultravnc', 'vnc viewer', 'vnc connect',
    'remotely', 'ammyy', 'supremo', 'dwservice', 'screens', 'jump desktop',
    // Enterprise Remote Access
    'citrix', 'vmware horizon', 'microsoft remote desktop', 'rdp', 'windows virtual desktop',
    'amazon workspaces', 'parallels'
  ],

  [CredentialCategory.DOMAIN_HOSTING]: [
    // Domain Registrars
    'godaddy', 'namecheap', 'google domains', 'domains.google', 'cloudflare',
    'name.com', 'dynadot', 'gandi', 'hover', 'enom', 'tucows', 'network solutions',
    'domain.com', '1&1', 'ionos', 'namesilo', 'porkbun',
    // Web Hosting
    'bluehost', 'hostgator', 'siteground', 'dreamhost', 'a2hosting', 'a2 hosting',
    'inmotion', 'hostinger', 'greengeeks', 'hostpapa', 'wpengine', 'wp engine',
    'kinsta', 'flywheel', 'liquid web', 'media temple',
    // cPanel/Control Panels
    'cpanel', 'whm', 'plesk', 'directadmin', 'webmin', 'virtualmin'
  ],

  [CredentialCategory.FILE_HOSTING]: [
    // Temporary File Sharing
    'wetransfer', 'sendanywhere', 'send anywhere', 'filemail', 'smash', 'send.firefox',
    'transfernow', 'transfer now', 'gofile', 'anonfiles', 'file.io',
    // File Lockers
    'mediafire', 'zippyshare', 'rapidgator', 'uploaded', 'turbobit', 'nitroflare',
    '4shared', 'sendspace', 'depositfiles', 'filejoker',
    // Enterprise File Sharing
    'sharefile', 'citrix sharefile', 'egnyte', 'box', 'sync.com'
  ],

  [CredentialCategory.CRYPTO_TOOLS]: [
    // Block Explorers
    'etherscan', 'etherscan.io', 'bscscan', 'bscscan.com', 'polygonscan', 'arbiscan',
    'optimistic.etherscan', 'ftmscan', 'snowtrace', 'solscan', 'solana.fm',
    'blockchain.com', 'blockchair', 'btc.com', 'explorer.btc',
    // Analytics & Data
    'dune', 'dune analytics', 'nansen', 'glassnode', 'defi llama', 'defillama',
    'dappradar', 'coinmarketcap', 'coingecko', 'cryptocompare', 'messari',
    'santiment', 'intotheblock', 'tokenterminal', 'token terminal',
    // Portfolio Trackers
    'delta', 'blockfolio', 'cointracker', 'koinly', 'cryptotaxcalculator',
    'accointing', 'cointracking', 'rotki', 'zapper', 'zerion', 'debank',
    // DEX Aggregators
    'matcha', '1inch', 'paraswap', 'cowswap', 'jupiter', 'openocean'
  ],

  [CredentialCategory.OTHER]: []
}

/**
 * Risk scores by category (0-100)
 * Updated with 6 new high-risk categories
 */
const CATEGORY_RISK_SCORES: Record<CredentialCategory, number> = {
  // CRITICAL TIER (90-100)
  [CredentialCategory.CRYPTO]: 100,           // Direct financial access - cryptocurrency
  [CredentialCategory.GOVERNMENT]: 95,        // Government IDs, SSN, tax records, benefits
  [CredentialCategory.REMOTE_ACCESS]: 95,     // Full system access, RDP, TeamViewer
  [CredentialCategory.BANKING]: 95,           // Direct financial access - traditional banking
  [CredentialCategory.PASSWORD_MANAGER]: 90,  // Master key to all other accounts
  [CredentialCategory.CRYPTO_TOOLS]: 90,      // Crypto analytics, portfolio trackers with API keys

  // HIGH TIER (70-89)
  [CredentialCategory.HEALTHCARE]: 85,        // HIPAA protected health data, prescriptions
  [CredentialCategory.CLOUD]: 80,             // Cloud infrastructure, data access
  [CredentialCategory.DOMAIN_HOSTING]: 75,    // Website/domain control, DNS hijacking
  [CredentialCategory.DEVELOPER]: 75,         // Code repos, CI/CD, package managers
  [CredentialCategory.WORK]: 70,              // Corporate access, CRM, productivity tools

  // MEDIUM-HIGH TIER (60-69)
  [CredentialCategory.EMAIL]: 65,             // Password reset access, 2FA bypass
  [CredentialCategory.FILE_HOSTING]: 60,      // Data exfiltration, file sharing

  // MEDIUM TIER (40-59)
  [CredentialCategory.SOCIAL]: 50,            // Social engineering, reputation damage
  [CredentialCategory.ECOMMERCE]: 45,         // Stored payment methods
  [CredentialCategory.GAMING]: 40,            // Valuable accounts, in-game items

  // LOW-MEDIUM TIER (30-39)
  [CredentialCategory.SUBSCRIPTION]: 35,      // Netflix, Spotify, etc.
  [CredentialCategory.BETTING]: 35,           // Gambling accounts with funds
  [CredentialCategory.VPN]: 30,               // Privacy tools

  // LOW TIER (0-29)
  [CredentialCategory.TRAVEL]: 25,            // Loyalty points, flight bookings
  [CredentialCategory.LEARNING]: 20,          // Educational platforms
  [CredentialCategory.DELIVERY]: 20,          // Food delivery
  [CredentialCategory.TICKETS]: 15,           // Event tickets
  [CredentialCategory.ADULT]: 10,             // Blackmail/extortion potential
  [CredentialCategory.OTHER]: 5               // Unknown/uncategorized
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
    [CredentialCategory.HEALTHCARE]: 'Healthcare & Medical',
    [CredentialCategory.GOVERNMENT]: 'Government Services',
    [CredentialCategory.REMOTE_ACCESS]: 'Remote Access',
    [CredentialCategory.DOMAIN_HOSTING]: 'Domain & Hosting',
    [CredentialCategory.FILE_HOSTING]: 'File Hosting',
    [CredentialCategory.CRYPTO_TOOLS]: 'Crypto Tools & Analytics',
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
    [CredentialCategory.HEALTHCARE]: '🏥',
    [CredentialCategory.GOVERNMENT]: '🏛️',
    [CredentialCategory.REMOTE_ACCESS]: '🖥️',
    [CredentialCategory.DOMAIN_HOSTING]: '🌐',
    [CredentialCategory.FILE_HOSTING]: '📤',
    [CredentialCategory.CRYPTO_TOOLS]: '📊',
    [CredentialCategory.OTHER]: '📁'
  }
  return icons[category] || '❓'
}
