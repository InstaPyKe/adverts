# Almai Ads (https://almai.co.ke)

**Almai Ads** is a high-performance WhatsApp Status vehicle advertising platform connecting Kenyan car showrooms and dealerships with verified status publishers across Nairobi and Kenya.

---

## Architecture & Technology Stack

- **Single Main Interface**: Complete responsive web app in [`index.html`](file:///c:/Users/SOOQ%20ELASER/Desktop/adverts/index.html) (100% inline SVG icons, zero external emoji dependencies, zero bloat).
- **No Backend Folder Required**:
  - Leverages **Cloudflare Pages Advanced Worker** via [`_worker.js`](file:///c:/Users/SOOQ%20ELASER/Desktop/adverts/_worker.js) located directly at the project root.
  - Native **Cloudflare D1 Database** integration via `env.DB` prepared statements.
  - Automatic fallback to local storage for offline and local testing.
- **Database Schema**: Pre-built [`schema.sql`](file:///c:/Users/SOOQ%20ELASER/Desktop/adverts/schema.sql) with tables for authentic users, vehicle advertisements, M-Pesa package payments, WhatsApp proof submissions, and wallet ledger.
- **Configuration**: [`wrangler.toml`](file:///c:/Users/SOOQ%20ELASER/Desktop/adverts/wrangler.toml) ready for one-command Cloudflare deployment.

---

## Authentic User Flow & Verification

1. **Strict Registration**:
   - Authentic full name required (first and last name, e.g., Grace Mwangi).
   - Valid Kenyan mobile number required (`07...` or `01...`).
   - Duplicate phone prevention.
   - Secure password (minimum 6 characters).
2. **Device & Account Authorization**:
   - Upon registration, publishers are redirected to the Sign-In authorization portal.
   - User must authorize their credentials before gaining dashboard access.
   - Explicit feedback is provided immediately if authorization fails.
3. **No Free Package**:
   - Publishers activate a paid plan:
     - **Starter Vehicle Tier**: KSh 500 fee • KSh 25.00/view (Budget cars up to KSh 2.5M).
     - **Growth SUV & Sedan Tier**: KSh 1,500 fee • KSh 60.00/view (Mid-size SUVs KSh 2.5M - 5M).
     - **Premium Executive Tier**: KSh 3,500 fee • KSh 120.00/view (Luxury 4x4s & Executive cars).
4. **Manual Safaricom M-Pesa Activation**:
   - Paybill: `522522`
   - Account Number: `AL-[Publisher Phone]` (e.g. `AL-0712345678`)
   - Administrator reviews transaction code and activates tier.
5. **Authorized Creative Downloads**:
   - In-browser HTML5 Canvas generation of 1080x1920 high-res PNG WhatsApp Status flyers with live showroom pricing.
6. **Live Wallet Calculations**:
   - Earnings calculated immediately upon reporting views.
   - Wallet counters start clean at 0.00 with magnified typography.
   - Direct M-Pesa withdrawal requests (minimum KSh 500.00).

---

## Secret Administrator Control Centre

- **Access Method**: Click the copyright text in the footer **6 times** (`#admin-secret-trigger`).
- **Admin Email**: `admin@almai.co.ke` (or `admin@calcare.co.ke`)
- **6-Digit PIN**: `456123`
- **Capabilities**:
  - Post new showroom vehicles with price, specs, photos, and tier eligibility.
  - Review and approve package activation M-Pesa payments.
  - Review and approve WhatsApp Status view screenshot proofs.
  - Batch process M-Pesa withdrawal payouts.

---

## Cloudflare Pages Deployment & D1 Setup

### 1. Initialize Cloudflare D1 Database
```bash
# Create D1 database
npx wrangler d1 create almai-ads-db

# Execute database schema and seed live Kenyan vehicles
npx wrangler d1 execute almai-ads-db --file=./schema.sql
```

### 2. Bind D1 in Cloudflare Pages
- In the Cloudflare Dashboard:
  - Go to **Workers & Pages** > Your Pages Project > **Settings** > **Functions**.
  - Under **D1 database bindings**, click **Add binding**:
    - Variable name: `DB`
    - D1 database: select `almai-ads-db`

### 3. Deploy
```bash
# Preview locally with Cloudflare Pages & D1 simulation
npx wrangler pages dev .

# Deploy directly to Cloudflare Pages
npx wrangler pages deploy .
```

---

## License & Intellectual Property
© 2026 Almai Ads Kenya. All rights reserved. Registered in Nairobi, Kenya.
