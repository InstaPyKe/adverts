-- =============================================================================
-- ALMAI ADS - CLOUDFLARE D1 DATABASE SCHEMA
-- Platform: Almai Ads (https://almai.co.ke)
-- Database Engine: SQLite (Cloudflare D1)
-- Execution: npx wrangler d1 execute <DATABASE_NAME> --file=./schema.sql
-- =============================================================================

-- 1. AUTHENTIC USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  active_package TEXT DEFAULT NULL,
  package_status TEXT DEFAULT 'inactive',
  package_payment_status TEXT DEFAULT 'none',
  pending_package TEXT DEFAULT NULL,
  package_mpesa_code TEXT DEFAULT NULL,
  available_balance REAL DEFAULT 0.00,
  pending_rewards REAL DEFAULT 0.00,
  lifetime_earnings REAL DEFAULT 0.00,
  created_at TEXT NOT NULL
);

-- Index for instant phone number lookups on login and verification
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 2. VEHICLE ADVERTISEMENTS TABLE
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  advertiser TEXT NOT NULL,
  category TEXT NOT NULL,
  price TEXT NOT NULL,
  year TEXT DEFAULT '2019',
  specs TEXT,
  reward_rate INTEGER DEFAULT 25,
  budget REAL DEFAULT 50000,
  remaining_budget REAL DEFAULT 50000,
  target_audience TEXT,
  status TEXT DEFAULT 'Active',
  eligible_package TEXT DEFAULT 'STARTER',
  theme TEXT DEFAULT 'gold',
  offer TEXT DEFAULT 'DUTY PAID • READY LOGBOOK',
  phone TEXT DEFAULT '0722 100 200',
  caption TEXT,
  created_at TEXT NOT NULL
);

-- Index for package tier filtering
CREATE INDEX IF NOT EXISTS idx_vehicles_package ON vehicles(eligible_package, status);

-- 3. PACKAGE PAYMENTS TABLE (MANUAL M-PESA ACTIVATION)
CREATE TABLE IF NOT EXISTS package_payments (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  package_tier TEXT NOT NULL,
  package_name TEXT NOT NULL,
  amount REAL NOT NULL,
  mpesa_code TEXT NOT NULL,
  status TEXT DEFAULT 'Pending Admin Review',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_package_payments_phone ON package_payments(phone);
CREATE INDEX IF NOT EXISTS idx_package_payments_status ON package_payments(status);

-- 4. AD SUBMISSIONS TABLE (WHATSAPP STATUS VERIFICATION)
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_title TEXT NOT NULL,
  advertiser TEXT NOT NULL,
  reported_views INTEGER NOT NULL,
  applicable_rate REAL NOT NULL,
  proposed_reward REAL NOT NULL,
  screenshot_name TEXT,
  status TEXT DEFAULT 'Pending Review',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_phone ON submissions(user_phone);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- 5. WITHDRAWALS TABLE (M-PESA PAYOUTS)
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  user_phone TEXT NOT NULL,
  amount REAL NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'Requested',
  mpesa_ref TEXT DEFAULT 'PENDING_BATCH',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_phone ON withdrawals(user_phone);

-- 6. WALLET LEDGER TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  user_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  reference TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL DEFAULT 0.00,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_txns_phone ON wallet_transactions(user_phone);

-- =============================================================================
-- SEED DATA: LIVE KENYAN VEHICLE LISTINGS WITH SHOWROOM PRICES
-- =============================================================================
INSERT OR IGNORE INTO vehicles (id, title, advertiser, category, price, year, specs, reward_rate, budget, remaining_budget, target_audience, status, eligible_package, theme, offer, phone, caption, created_at)
VALUES
  (
    'VEH-001',
    'Toyota Land Cruiser Prado TXL 2.8L',
    'Kiambu Road Prestige Motors',
    'Luxury SUV 4x4',
    'KSh 6,450,000',
    '2018',
    '48,000 km • 2800cc Diesel 4WD • Sunroof • 7-Seater Leather • Modelista Bodykit',
    120,
    60000,
    54000,
    'Nairobi, Kiambu & Nationwide',
    'Active',
    'PREMIUM',
    'gold',
    'DUTY PAID • READY LOGBOOK',
    '0722 100 200',
    'Toyota Land Cruiser Prado TXL 2018 Clean Unregistered Direct Import. 2800cc Turbo Diesel, 7-seater full leather, Modelista aero package. Price: KSh 6.45M negotiable. Call/WhatsApp 0722 100 200.',
    datetime('now')
  ),
  (
    'VEH-002',
    'Mazda CX-5 2.2L XD L-Package',
    'Karen Executive Showrooms',
    'Mid-Size SUV',
    'KSh 3,250,000',
    '2019',
    '52,000 km • 2200cc SkyActiv-D • Bose Sound • Heads-Up Display • White Leather',
    60,
    45000,
    38000,
    'Nairobi, Karen, Westlands',
    'Active',
    'GROWTH',
    'ruby',
    'DUTY PAID • SHOWROOM MINT',
    '0711 300 400',
    'Mazda CX-5 XD L-Package 2019. Mint condition, fuel-efficient SkyActiv-D, premium Bose sound, heated leather memory seats. Price: KSh 3.25M. Call 0711 300 400 for viewing in Karen.',
    datetime('now')
  ),
  (
    'VEH-003',
    'Toyota Premio F-EX 1.5L',
    'Mombasa Road Autohaus',
    'Executive Sedan',
    'KSh 2,150,000',
    '2017',
    '64,000 km • 1500cc Valvematic • Push Start • Wood Finish • Reverse Camera',
    25,
    35000,
    30000,
    'Nairobi, Machakos, Mombasa',
    'Active',
    'STARTER',
    'blue',
    'ONE KENYAN OWNER • SERVICE LOGBOOK',
    '0733 500 600',
    'Toyota Premio 1.5 F-EX Package 2017. Immaculate executive daily driver, ultra reliable, brand new tyres, genuine low mileage. Price: KSh 2.15M. Inquire now: 0733 500 600.',
    datetime('now')
  ),
  (
    'VEH-004',
    'Toyota Land Cruiser LC300 GR Sport',
    'Westlands Motor Gallery',
    'Super Luxury 4x4',
    'KSh 24,500,000',
    '2022',
    '14,000 km • 3.3L Twin-Turbo V6 Diesel • E-KDSS • JBL 14-Speaker Sound • 360 Camera',
    120,
    100000,
    92000,
    'High Net Worth • Nairobi, Runda & Muthaiga',
    'Active',
    'PREMIUM',
    'gold',
    'ZERO ACCIDENT • DIPLOMAT OWNED',
    '0722 888 999',
    'Land Cruiser LC300 GR-Sport 2022 V6 3.3L Twin-Turbo Diesel. Ultimate luxury flagship with GR dynamic suspension, heads-up display and refrigerated coolbox. KSh 24.5M. Contact 0722 888 999.',
    datetime('now')
  ),
  (
    'VEH-005',
    'Subaru Outback Limited Eyesight',
    'Ngong Road Motor World',
    'Crossover Wagon 4WD',
    'KSh 3,850,000',
    '2018',
    '59,000 km • 2500cc Boxer • Symmetrical AWD • Harman Kardon • Power Tailgate',
    60,
    40000,
    36000,
    'Nairobi, Nakuru, Eldoret',
    'Active',
    'GROWTH',
    'ruby',
    'READY LOGBOOK • BANK FINANCING OK',
    '0700 777 666',
    'Subaru Outback Limited 2.5L 2018 with EyeSight safety technology, adaptive cruise control, leather interior, Harman Kardon sound. KSh 3.85M. Call 0700 777 666.',
    datetime('now')
  ),
  (
    'VEH-006',
    'Toyota Fielder 1.5G WxB Aero',
    'Thika Road Car Hub',
    'Station Wagon',
    'KSh 1,980,000',
    '2018',
    '72,000 km • 1500cc Petrol • WxB Sport Interior • Dark Chrome Grill • Alloy Rims',
    25,
    30000,
    27500,
    'Thika, Nairobi & Central',
    'Active',
    'STARTER',
    'blue',
    'CLEAN CAR • BUY AND DRIVE',
    '0790 444 333',
    'Toyota Corolla Fielder 1.5G WxB Aero 2018. Economical family or Uber XL favorite, pristine black interior, steering controls. KSh 1.98M cash. Call 0790 444 333 today.',
    datetime('now')
  );
