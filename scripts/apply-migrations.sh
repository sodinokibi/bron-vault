#!/bin/bash
# Apply Database Migrations for Crypto Enhancements
# Applies migrations 009, 010, and 011 in sequence

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Bron Vault - Database Migration Script  ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo -e "${YELLOW}Please create .env file with database credentials:${NC}"
    echo ""
    echo "MYSQL_HOST=localhost"
    echo "MYSQL_PORT=3306"
    echo "MYSQL_USER=your_user"
    echo "MYSQL_PASSWORD=your_password"
    echo "MYSQL_DATABASE=stealer_logs"
    echo ""
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Set defaults
MYSQL_HOST=${MYSQL_HOST:-localhost}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-stealer_logs}

echo -e "${BLUE}Database Configuration:${NC}"
echo -e "  Host: ${MYSQL_HOST}:${MYSQL_PORT}"
echo -e "  Database: ${MYSQL_DATABASE}"
echo -e "  User: ${MYSQL_USER}"
echo ""

# Test database connection
echo -e "${YELLOW}🔍 Testing database connection...${NC}"
if ! mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" -e "USE ${MYSQL_DATABASE};" 2>/dev/null; then
    echo -e "${RED}❌ Failed to connect to database${NC}"
    echo -e "${YELLOW}Please check your credentials in .env file${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Database connection successful${NC}"
echo ""

# Function to apply migration
apply_migration() {
    local migration_file=$1
    local migration_name=$(basename $migration_file .sql)

    echo -e "${YELLOW}📝 Applying ${migration_name}...${NC}"

    if mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" "${MYSQL_DATABASE}" < "${migration_file}"; then
        echo -e "${GREEN}✅ ${migration_name} applied successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to apply ${migration_name}${NC}"
        return 1
    fi
}

# Apply migrations in order
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Applying Migrations                     ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Migration 009: Enhanced Crypto Wallets
echo -e "${BLUE}[1/3] Migration 009: Enhanced Crypto Wallets${NC}"
echo -e "      Adds: public_key, account_name, network_config, vault_data, extension_id"
apply_migration "scripts/009_enhance_crypto_wallets.sql"
echo ""

# Migration 010: HD Wallet Support
echo -e "${BLUE}[2/3] Migration 010: HD Wallet Support${NC}"
echo -e "      Adds: derivation_path, seed_id, address_index, wallet_software"
apply_migration "scripts/010_add_hd_wallet_support.sql"
echo ""

# Migration 011: Ledger Live Support
echo -e "${BLUE}[3/3] Migration 011: Ledger Live Support${NC}"
echo -e "      Adds: ledger_device_model, ledger_balance_usd, ledger_operations_count"
echo -e "      Modifies: wallet_type to include 'hardware_wallet'"
apply_migration "scripts/011_add_ledger_live_support.sql"
echo ""

echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}  ✅ All migrations applied successfully   ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verify schema
echo -e "${YELLOW}🔍 Verifying schema changes...${NC}"
mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" "${MYSQL_DATABASE}" -e "
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = '${MYSQL_DATABASE}'
  AND TABLE_NAME = 'crypto_wallets'
  AND COLUMN_NAME IN (
    'public_key', 'account_name', 'network_config', 'vault_data', 'extension_id',
    'derivation_path', 'seed_id', 'address_index', 'wallet_software',
    'ledger_device_model', 'ledger_balance_usd', 'ledger_operations_count'
  )
ORDER BY ORDINAL_POSITION;
"

echo ""
echo -e "${GREEN}✅ Database is ready for enhanced crypto analysis!${NC}"
echo ""
echo -e "${BLUE}New Capabilities Enabled:${NC}"
echo -e "  • Enhanced LevelDB parsing (public keys, account names, vault data)"
echo -e "  • HD Wallet analysis (derivation paths, seed correlation, side wallets)"
echo -e "  • Ledger Live detection (hardware wallet intelligence, portfolio tracking)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Upload stealer logs to test new detection"
echo -e "  2. Check 'HD Wallets' tab for side wallet analysis"
echo -e "  3. Look for Ledger Live detections (high-value targets)"
echo ""
