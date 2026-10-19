/**
 * Almai Ads - Cloudflare Pages Advanced Mode Serverless Worker
 * Hosts Almai Ads on Cloudflare Pages with native Cloudflare D1 Database integration.
 * NO backend folder required.
 *
 * Direct D1 binding: env.DB
 * Static asset fetch: env.ASSETS.fetch(request)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Standard CORS Headers for API calls
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only process /api/* routes in worker; all other routes are passed to Cloudflare Pages static assets
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    }

    const endpoint = url.pathname.replace(/^\/api/, '');

    // Helper: Return JSON response
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: corsHeaders
      });
    };

    // Helper: Return JSON error
    const errorResponse = (message, status = 400) => {
      return jsonResponse({ success: false, error: message }, status);
    };

    // Helper: Safely parse JSON body
    const parseBody = async () => {
      try {
        return await request.json();
      } catch (e) {
        return null;
      }
    };

    // Helper: Normalize Kenyan phone numbers
    const normalizePhone = (phoneStr) => {
      if (!phoneStr) return '';
      let clean = String(phoneStr).replace(/[^0-9]/g, '');
      if (clean.startsWith('254') && clean.length === 12) {
        clean = '0' + clean.substring(3);
      }
      return clean;
    };

    // Check D1 Database Availability
    const db = env.DB;

    try {
      /* =======================================================================
         1. HEALTH CHECK & DIAGNOSTICS
         ======================================================================= */
      if (endpoint === '/health' && request.method === 'GET') {
        let d1Ok = false;
        if (db) {
          try {
            await db.prepare('SELECT 1').first();
            d1Ok = true;
          } catch (e) {
            d1Ok = false;
          }
        }
        return jsonResponse({
          status: 'online',
          platform: 'Almai Ads',
          d1Binding: !!db,
          d1Connected: d1Ok,
          timestamp: new Date().toISOString()
        });
      }

      /* =======================================================================
         2. AUTHENTICATION: REGISTER AUTHENTIC USER
         POST /api/auth/register
         ======================================================================= */
      if (endpoint === '/auth/register' && request.method === 'POST') {
        const body = await parseBody();
        if (!body) return errorResponse('Missing request payload');

        const { name, phone, password } = body;
        const cleanName = (name || '').trim();
        const cleanPhone = normalizePhone(phone);

        // Strict Authentic Name Validation (first & last name)
        const nameParts = cleanName.split(/\s+/).filter(Boolean);
        if (nameParts.length < 2 || cleanName.length < 5) {
          return errorResponse('Authentic full name required with at least two names (e.g. Grace Mwangi)');
        }

        // Strict Kenyan Mobile Phone Validation
        if (!/^(07|01)\d{8}$/.test(cleanPhone)) {
          return errorResponse('Please provide a valid 10-digit Kenyan mobile number starting with 07 or 01');
        }

        // Password Validation
        if (!password || password.length < 6) {
          return errorResponse('Password must be at least 6 characters');
        }

        if (db) {
          // Check for duplicate registered phone
          const existing = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(cleanPhone).first();
          if (existing) {
            return errorResponse(`Phone number ${cleanPhone} is already registered on Almai Ads. Please sign in.`, 409);
          }

          const userId = 'USR-' + Date.now();
          const nowIso = new Date().toISOString();

          await db.prepare(
            `INSERT INTO users (id, name, phone, password, active_package, package_status, package_payment_status, available_balance, pending_rewards, lifetime_earnings, created_at)
             VALUES (?, ?, ?, ?, NULL, 'inactive', 'none', 0.00, 0.00, 0.00, ?)`
          ).bind(userId, cleanName, cleanPhone, password, nowIso).run();

          return jsonResponse({
            success: true,
            message: 'Authentic user registered successfully. Please authorize your account.',
            user: {
              id: userId,
              name: cleanName,
              phone: cleanPhone,
              activePackage: null,
              packageStatus: 'inactive'
            }
          }, 201);
        } else {
          // In-memory fallback if D1 not yet bound
          return jsonResponse({
            success: true,
            message: 'Registration accepted (local storage persistence active).',
            user: { name: cleanName, phone: cleanPhone, activePackage: null }
          }, 201);
        }
      }

      /* =======================================================================
         3. AUTHENTICATION: AUTHORIZE / LOGIN USER
         POST /api/auth/login
         ======================================================================= */
      if (endpoint === '/auth/login' && request.method === 'POST') {
        const body = await parseBody();
        if (!body) return errorResponse('Missing credentials');

        const cleanPhone = normalizePhone(body.phone);
        const password = body.password;

        if (!cleanPhone || !password) {
          return errorResponse('Phone number and password are required');
        }

        if (db) {
          const user = await db.prepare(
            `SELECT id, name, phone, active_package, package_status, package_payment_status, pending_package,
                    available_balance, pending_rewards, lifetime_earnings, created_at
             FROM users WHERE phone = ? AND password = ?`
          ).bind(cleanPhone, password).first();

          if (!user) {
            return errorResponse('Authorization failed: Invalid phone number or password. Check credentials or register.', 401);
          }

          return jsonResponse({
            success: true,
            authorized: true,
            user: {
              id: user.id,
              name: user.name,
              phone: user.phone,
              activePackage: user.active_package,
              packageStatus: user.package_status || 'inactive',
              packagePaymentStatus: user.package_payment_status || 'none',
              pendingPackage: user.pending_package,
              availableBalance: user.available_balance || 0.00,
              pendingRewards: user.pending_rewards || 0.00,
              lifetimeEarnings: user.lifetime_earnings || 0.00,
              createdAt: user.created_at
            }
          });
        } else {
          // If D1 not yet configured, return note for client fallback
          return errorResponse('D1 database initializing. Falling back to local storage auth.', 401);
        }
      }

      /* =======================================================================
         4. VEHICLES & ADVERTS
         GET /api/vehicles - List active vehicle advertisements
         POST /api/vehicles - Admin post vehicle advert
         ======================================================================= */
      if (endpoint === '/vehicles' && request.method === 'GET') {
        if (db) {
          const { results } = await db.prepare(
            `SELECT * FROM vehicles WHERE status = 'Active' ORDER BY id ASC`
          ).all();
          return jsonResponse({ success: true, vehicles: results });
        }
        return jsonResponse({ success: true, vehicles: [] });
      }

      if (endpoint === '/vehicles' && request.method === 'POST') {
        const body = await parseBody();
        if (!body || !body.title || !body.price) {
          return errorResponse('Vehicle title, price, and specs are required');
        }

        const vehId = body.id || ('VEH-' + Math.floor(100 + Math.random() * 900));

        if (db) {
          await db.prepare(
            `INSERT INTO vehicles (id, title, advertiser, category, price, year, specs, reward_rate, budget, remaining_budget, target_audience, status, eligible_package, theme, offer, phone, caption, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          ).bind(
            vehId,
            body.title,
            body.advertiser || 'Almai Showroom Motors',
            body.category || 'Showroom Vehicle',
            body.price,
            body.year || '2019',
            body.specs || '',
            body.rewardRate || 25,
            body.budget || 50000,
            body.remainingBudget || body.budget || 50000,
            body.targetAudience || 'Nairobi & Nationwide',
            body.status || 'Active',
            body.eligiblePackage || 'STARTER',
            body.theme || 'gold',
            body.offer || 'DUTY PAID • READY LOGBOOK',
            body.phone || '0722 100 200',
            body.caption || ''
          ).run();
        }

        return jsonResponse({ success: true, id: vehId, message: 'Vehicle advert created successfully' }, 201);
      }

      /* =======================================================================
         5. PACKAGE PAYMENTS & ACTIVATIONS
         POST /api/packages/payment - User submits M-Pesa payment proof
         GET /api/packages/requests - Admin lists pending package payments
         POST /api/packages/approve - Admin approves package payment & activates tier
         ======================================================================= */
      if (endpoint === '/packages/payment' && request.method === 'POST') {
        const body = await parseBody();
        if (!body || !body.mpesaCode || !body.phone) {
          return errorResponse('M-Pesa transaction code and phone number are required');
        }

        const reqId = body.id || ('PAY-' + Math.floor(1000 + Math.random() * 9000));
        const cleanPhone = normalizePhone(body.phone);

        if (db) {
          await db.prepare(
            `INSERT INTO package_payments (id, user_name, phone, package_tier, package_name, amount, mpesa_code, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Admin Review', datetime('now'))`
          ).bind(
            reqId,
            body.user || 'Publisher',
            cleanPhone,
            body.packageTier || 'STARTER',
            body.packageName || 'Starter Package',
            Number(body.amount) || 500,
            body.mpesaCode.toUpperCase()
          ).run();

          await db.prepare(
            `UPDATE users
             SET pending_package = ?, package_payment_status = 'pending_review', package_mpesa_code = ?
             WHERE phone = ?`
          ).bind(body.packageTier || 'STARTER', body.mpesaCode.toUpperCase(), cleanPhone).run();
        }

        return jsonResponse({ success: true, id: reqId, message: 'Payment proof queued for admin review' });
      }

      if (endpoint === '/packages/requests' && request.method === 'GET') {
        if (db) {
          const { results } = await db.prepare(
            `SELECT * FROM package_payments ORDER BY created_at DESC`
          ).all();
          return jsonResponse({ success: true, requests: results });
        }
        return jsonResponse({ success: true, requests: [] });
      }

      if (endpoint === '/packages/approve' && request.method === 'POST') {
        const body = await parseBody();
        if (!body || !body.id) return errorResponse('Missing request ID');

        if (db) {
          const req = await db.prepare('SELECT * FROM package_payments WHERE id = ?').bind(body.id).first();
          if (!req) return errorResponse('Package payment request not found', 404);

          await db.prepare(`UPDATE package_payments SET status = 'Approved' WHERE id = ?`).bind(body.id).run();

          await db.prepare(
            `UPDATE users
             SET active_package = ?, package_status = 'active', package_payment_status = 'approved', pending_package = NULL
             WHERE phone = ?`
          ).bind(req.package_tier, req.phone).run();

          return jsonResponse({ success: true, message: `Package ${req.package_tier} activated for user ${req.phone}` });
        }

        return jsonResponse({ success: true, message: 'Package approved' });
      }

      /* =======================================================================
         6. AD SUBMISSIONS & EARNINGS
         POST /api/submissions - User submits WhatsApp proof
         GET /api/submissions - List submissions
         POST /api/submissions/approve - Admin approves submission & credits wallet
         ======================================================================= */
      if (endpoint === '/submissions' && request.method === 'POST') {
        const body = await parseBody();
        if (!body || !body.campaignId || !body.reportedViews) {
          return errorResponse('Campaign ID and reported views are required');
        }

        const subId = body.id || ('SUB-2026-' + Math.floor(1000 + Math.random() * 9000));
        const views = Number(body.reportedViews) || 1;
        const rate = Number(body.applicableRate) || 25;
        const reward = views * rate;

        if (db) {
          await db.prepare(
            `INSERT INTO submissions (id, user_name, user_phone, campaign_id, campaign_title, advertiser, reported_views, applicable_rate, proposed_reward, screenshot_name, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Review', datetime('now'))`
          ).bind(
            subId,
            body.user || 'Publisher',
            normalizePhone(body.phone || ''),
            body.campaignId,
            body.campaignTitle || 'Vehicle Advert',
            body.advertiser || 'Almai Showroom',
            views,
            rate,
            reward,
            body.screenshotName || 'whatsapp_status.png'
          ).run();
        }

        return jsonResponse({ success: true, id: subId, proposedReward: reward, message: 'Submission queued for verification' });
      }

      if (endpoint === '/submissions' && request.method === 'GET') {
        if (db) {
          const { results } = await db.prepare(
            `SELECT * FROM submissions ORDER BY created_at DESC LIMIT 100`
          ).all();
          return jsonResponse({ success: true, submissions: results });
        }
        return jsonResponse({ success: true, submissions: [] });
      }

      if (endpoint === '/submissions/approve' && request.method === 'POST') {
        const body = await parseBody();
        if (!body || !body.id) return errorResponse('Missing submission ID');

        if (db) {
          const sub = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(body.id).first();
          if (!sub) return errorResponse('Submission not found', 404);

          await db.prepare(`UPDATE submissions SET status = 'Approved' WHERE id = ?`).bind(body.id).run();

          // Credit user wallet if user_phone is available
          if (sub.user_phone) {
            await db.prepare(
              `UPDATE users
               SET available_balance = available_balance + ?,
                   lifetime_earnings = lifetime_earnings + ?
               WHERE phone = ?`
            ).bind(sub.proposed_reward, sub.proposed_reward, sub.user_phone).run();

            // Insert transaction record
            const txnId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
            await db.prepare(
              `INSERT INTO wallet_transactions (id, user_phone, type, reference, amount, status, created_at)
               VALUES (?, ?, 'Reward Finalized', ?, ?, 'Finalized', datetime('now'))`
            ).bind(txnId, sub.user_phone, sub.id + ' (' + sub.campaign_title + ')', sub.proposed_reward).run();
          }

          return jsonResponse({ success: true, message: `Submission ${body.id} approved and KSh ${sub.proposed_reward} credited` });
        }

        return jsonResponse({ success: true, message: 'Submission approved' });
      }

      /* =======================================================================
         7. WITHDRAWALS
         POST /api/withdrawals - Request M-Pesa payout
         ======================================================================= */
      if (endpoint === '/withdrawals' && request.method === 'POST') {
        const body = await parseBody();
        if (!body || !body.amount || !body.phone) {
          return errorResponse('Withdrawal amount and phone number are required');
        }

        const amount = Number(body.amount);
        const cleanPhone = normalizePhone(body.phone);

        if (amount < 500) {
          return errorResponse('Minimum M-Pesa withdrawal is KSh 500.00');
        }

        const wdrId = body.id || ('WDR-2026-' + Math.floor(100 + Math.random() * 900));

        if (db) {
          const user = await db.prepare('SELECT available_balance FROM users WHERE phone = ?').bind(cleanPhone).first();
          if (!user || user.available_balance < amount) {
            return errorResponse('Insufficient available wallet balance for this withdrawal');
          }

          // Deduct from wallet
          await db.prepare('UPDATE users SET available_balance = available_balance - ? WHERE phone = ?').bind(amount, cleanPhone).run();

          // Insert withdrawal record
          await db.prepare(
            `INSERT INTO withdrawals (id, user_phone, amount, phone, status, mpesa_ref, created_at)
             VALUES (?, ?, ?, ?, 'Requested', 'PENDING_BATCH', datetime('now'))`
          ).bind(wdrId, cleanPhone, amount, cleanPhone).run();

          // Insert transaction log
          const txnId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
          await db.prepare(
            `INSERT INTO wallet_transactions (id, user_phone, type, reference, amount, status, created_at)
             VALUES (?, ?, 'M-Pesa Withdrawal', ?, ?, 'Pending', datetime('now'))`
          ).bind(txnId, cleanPhone, wdrId + ' to ' + cleanPhone, -amount).run();
        }

        return jsonResponse({
          success: true,
          id: wdrId,
          amount: amount,
          message: 'Withdrawal request queued for M-Pesa batch disbursement'
        });
      }

      /* =======================================================================
         8. WALLET OVERVIEW
         GET /api/wallet?phone=07XXXXXXXX
         ======================================================================= */
      if (endpoint.startsWith('/wallet') && request.method === 'GET') {
        const phone = normalizePhone(url.searchParams.get('phone'));
        if (!phone) return errorResponse('User phone query parameter required');

        if (db) {
          const user = await db.prepare(
            `SELECT available_balance, pending_rewards, lifetime_earnings, active_package, package_status FROM users WHERE phone = ?`
          ).bind(phone).first();

          const { results: txns } = await db.prepare(
            `SELECT * FROM wallet_transactions WHERE user_phone = ? ORDER BY created_at DESC LIMIT 20`
          ).bind(phone).all();

          return jsonResponse({
            success: true,
            summary: {
              availableBalance: user ? user.available_balance : 0.00,
              pendingRewards: user ? user.pending_rewards : 0.00,
              lifetimeFinalized: user ? user.lifetime_earnings : 0.00,
              activePackage: user ? user.active_package : null,
              packageStatus: user ? user.package_status : 'inactive',
              minimumWithdrawal: 500.00
            },
            transactions: txns || []
          });
        }

        return jsonResponse({
          success: true,
          summary: { availableBalance: 0.00, pendingRewards: 0.00, lifetimeFinalized: 0.00, minimumWithdrawal: 500.00 },
          transactions: []
        });
      }

      // Default route not found
      return errorResponse(`Route /api${endpoint} not found`, 404);

    } catch (err) {
      console.error('[Almai Worker Error]', err);
      return errorResponse('Internal server error: ' + err.message, 500);
    }
  }
};
