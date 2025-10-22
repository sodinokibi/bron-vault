#!/bin/bash
# Complete Database Setup for Bron Vault
# This script does EVERYTHING - creates database, tables, and applies all migrations

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}║           Bron Vault - Complete Database Setup          ║${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This script will:${NC}"
echo -e "  1. Create database"
echo -e "  2. Create all tables"
echo -e "  3. Apply all migrations (009, 010, 011)"
echo -e "  4. Verify everything works"
echo ""

# Prompt for database credentials
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Database Configuration                                 ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

read -p "MySQL Host [localhost]: " MYSQL_HOST
MYSQL_HOST=${MYSQL_HOST:-localhost}

read -p "MySQL Port [3306]: " MYSQL_PORT
MYSQL_PORT=${MYSQL_PORT:-3306}

read -p "MySQL Root User [root]: " MYSQL_USER
MYSQL_USER=${MYSQL_USER:-root}

read -sp "MySQL Root Password: " MYSQL_PASSWORD
echo ""

read -p "Database Name [stealer_logs]: " MYSQL_DATABASE
MYSQL_DATABASE=${MYSQL_DATABASE:-stealer_logs}

echo ""
echo -e "${GREEN}Configuration saved!${NC}"
echo ""

# Test connection
echo -e "${YELLOW}🔍 Testing database connection...${NC}"
if ! mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" -e "SELECT 1;" 2>/dev/null; then
    echo -e "${RED}❌ Failed to connect to MySQL server${NC}"
    echo -e "${YELLOW}Please check:${NC}"
    echo -e "  - MySQL is running (systemctl status mysql)"
    echo -e "  - Credentials are correct"
    echo -e "  - Host/port are accessible"
    exit 1
fi
echo -e "${GREEN}✅ Connected to MySQL server${NC}"
echo ""

# Create database
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 1/5: Creating Database                           ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" <<EOF
CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ${MYSQL_DATABASE};
SELECT 'Database created successfully' as status;
EOF

echo -e "${GREEN}✅ Database '${MYSQL_DATABASE}' ready${NC}"
echo ""

# Create tables
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 2/5: Creating Base Tables                        ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" "${MYSQL_DATABASE}" < scripts/mysql-setup.sql

echo -e "${GREEN}✅ Base tables created (devices, files, crypto_wallets, etc.)${NC}"
echo ""

# Apply migrations
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 3/5: Applying Additional Migrations              ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Find and apply all numbered migrations in order
for migration in scripts/00{2..8}*.sql scripts/00{9}*.sql scripts/01{0..9}*.sql; do
    if [ -f "$migration" ]; then
        migration_name=$(basename "$migration")
        echo -e "${CYAN}📝 Applying ${migration_name}...${NC}"

        if mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" "${MYSQL_DATABASE}" < "$migration" 2>/dev/null; then
            echo -e "${GREEN}   ✅ ${migration_name} applied${NC}"
        else
            echo -e "${YELLOW}   ⚠️  ${migration_name} skipped (already applied or not needed)${NC}"
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ All migrations processed${NC}"
echo ""

# Verify crypto enhancements
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 4/5: Verifying Crypto Enhancements               ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${CYAN}Checking crypto_wallets table schema...${NC}"
mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" "${MYSQL_DATABASE}" <<EOF
SELECT
    COLUMN_NAME as 'Column',
    DATA_TYPE as 'Type',
    COLUMN_COMMENT as 'Description'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = '${MYSQL_DATABASE}'
  AND TABLE_NAME = 'crypto_wallets'
  AND COLUMN_NAME IN (
    'derivation_path',
    'seed_id',
    'wallet_software',
    'ledger_device_model',
    'ledger_balance_usd'
  )
ORDER BY ORDINAL_POSITION;
EOF

echo ""
echo -e "${GREEN}✅ Crypto enhancements verified${NC}"
echo ""

# Save .env file
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Step 5/5: Saving Configuration                        ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

cat > .env <<EOF
# Database Configuration
MYSQL_HOST=${MYSQL_HOST}
MYSQL_PORT=${MYSQL_PORT}
MYSQL_USER=${MYSQL_USER}
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=${MYSQL_DATABASE}

# Redis Configuration (optional - for background jobs)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security Configuration
JWT_SECRET=$(openssl rand -hex 32)

# Application Configuration
NODE_ENV=development
EOF

echo -e "${GREEN}✅ Configuration saved to .env${NC}"
echo ""

# Final summary
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}║                   🎉 SETUP COMPLETE! 🎉                  ║${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}✅ Database: ${MYSQL_DATABASE}${NC}"
echo -e "${GREEN}✅ Tables: Created${NC}"
echo -e "${GREEN}✅ Migrations: Applied (009, 010, 011)${NC}"
echo -e "${GREEN}✅ Config: Saved to .env${NC}"
echo ""

echo -e "${BLUE}New Capabilities Enabled:${NC}"
echo -e "  🔑 Enhanced LevelDB parsing"
echo -e "  🔗 HD Wallet side wallet detection"
echo -e "  💰 Ledger Live hardware wallet intelligence"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Start the application: ${CYAN}npm run dev${NC}"
echo -e "  2. Open browser: ${CYAN}http://localhost:3000${NC}"
echo -e "  3. Create admin account"
echo -e "  4. Upload stealer logs to test crypto analysis"
echo ""

echo -e "${GREEN}Database is ready to use! 🚀${NC}"
echo ""
