# 🚀 QUICK START - Complete Setup in 5 Minutes

**Your database is empty? No problem!** This will set up EVERYTHING automatically.

---

## ⚡ One Command Setup (Easiest)

```bash
cd /home/user/bron-vault
./scripts/setup-database.sh
```

**What it does:**
- ✅ Creates database
- ✅ Creates all tables
- ✅ Applies all crypto migrations
- ✅ Saves configuration to `.env`
- ✅ Ready to use!

**You'll be asked:**
- MySQL host (just press Enter for `localhost`)
- MySQL port (just press Enter for `3306`)
- MySQL user (just press Enter for `root`)
- MySQL password (type your MySQL password)
- Database name (just press Enter for `stealer_logs`)

**That's it!** Script does everything else automatically.

---

## 📋 What You Need Before Running

### 1. MySQL/MariaDB Installed

**Check if installed:**
```bash
mysql --version
```

**If not installed:**

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
```

**macOS:**
```bash
brew install mysql
brew services start mysql
```

**Windows:**
Download from: https://dev.mysql.com/downloads/installer/

### 2. MySQL Running

**Check status:**
```bash
# Linux
sudo systemctl status mysql

# macOS
brew services list | grep mysql

# Or try connecting
mysql -u root -p
```

**If not running:**
```bash
# Linux
sudo systemctl start mysql

# macOS
brew services start mysql
```

---

## 🎯 After Setup

### Start the Application

```bash
npm install  # First time only
npm run dev
```

### Open in Browser

```
http://localhost:3000
```

### Create Admin Account

1. App will detect no users exist
2. Create your first admin account
3. Log in
4. Upload stealer logs
5. Enjoy crypto analysis!

---

## 🔍 Verify Setup Worked

### Check Database

```bash
mysql -u root -p stealer_logs
```

```sql
SHOW TABLES;
-- Should show: devices, files, crypto_wallets, etc.

DESCRIBE crypto_wallets;
-- Should show columns including:
-- derivation_path, seed_id, ledger_device_model, etc.
```

### Check Config

```bash
cat .env
# Should show your database credentials
```

---

## 🐛 Troubleshooting

### Problem: "MySQL command not found"

**Solution:** MySQL not installed. See "What You Need" section above.

### Problem: "Access denied for user 'root'"

**Solution 1:** Try with sudo
```bash
sudo mysql
```

**Solution 2:** Reset MySQL root password
```bash
# Ubuntu/Debian
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_new_password';
FLUSH PRIVILEGES;
exit;
```

### Problem: "Can't connect to MySQL server"

**Solution:** MySQL not running
```bash
sudo systemctl start mysql    # Linux
brew services start mysql     # macOS
```

### Problem: Script fails midway

**Solution:** Run again - it's safe! Already created items will be skipped.

### Problem: Port 3000 already in use

**Solution:** Kill the process or use different port
```bash
# Find what's using port 3000
lsof -i :3000
kill -9 [PID]

# Or use different port
PORT=3001 npm run dev
```

---

## 🎓 What Gets Installed

### Database: `stealer_logs`
Created automatically

### Tables:
- `devices` - Uploaded devices
- `files` - File contents
- `crypto_wallets` - **Enhanced with:**
  - ✅ HD Wallet support (side wallet detection)
  - ✅ Ledger Live support (hardware wallet intelligence)
  - ✅ Enhanced LevelDB parsing
- `discord_tokens` - Discord accounts
- `browser_history` - Browser data
- `cookie_sessions` - Authenticated sessions
- And more...

### Migrations Applied:
- 002-008: Base features
- **009: Enhanced crypto wallet parsing**
- **010: HD wallet side wallet detection**
- **011: Ledger Live hardware wallet support**

---

## ✅ Success Checklist

- [ ] MySQL installed and running
- [ ] Ran `./scripts/setup-database.sh`
- [ ] Saw "SETUP COMPLETE!" message
- [ ] `.env` file exists with database config
- [ ] Ran `npm run dev`
- [ ] Opened `http://localhost:3000`
- [ ] Created admin account
- [ ] Ready to upload logs!

---

## 🆘 Still Stuck?

### Quick Diagnostics

```bash
# Check MySQL is running
sudo systemctl status mysql

# Check database exists
mysql -u root -p -e "SHOW DATABASES LIKE 'stealer_logs';"

# Check tables exist
mysql -u root -p stealer_logs -e "SHOW TABLES;"

# Check .env file
cat .env | grep MYSQL
```

### Manual Setup (Last Resort)

If automated script fails, follow manual steps in `MIGRATION_GUIDE.md`:

```bash
# 1. Create database
mysql -u root -p -e "CREATE DATABASE stealer_logs;"

# 2. Create tables
mysql -u root -p stealer_logs < scripts/mysql-setup.sql

# 3. Apply migrations
mysql -u root -p stealer_logs < scripts/009_enhance_crypto_wallets.sql
mysql -u root -p stealer_logs < scripts/010_add_hd_wallet_support.sql
mysql -u root -p stealer_logs < scripts/011_add_ledger_live_support.sql

# 4. Copy .env.example to .env and edit
cp .env.example .env
nano .env  # Edit with your credentials
```

---

## 🎉 You're Done!

Once you see "SETUP COMPLETE!" - you're ready to use Bron Vault with full crypto analysis capabilities including:

- 🔐 HD Wallet side wallet detection
- 💰 Ledger Live hardware wallet intelligence
- 🔑 Enhanced wallet data extraction

Upload stealer logs and watch the magic happen!
