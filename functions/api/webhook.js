// Cloudflare Pages Functions: /api/webhook
// Stripe Webhook処理 (決済完了によるProプラン自動有効化・解約反映)
// Web Crypto APIによる署名検証 & D1自動マイグレーション完全対応

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const rawBody = await request.text();
        const signature = request.headers.get('stripe-signature');

        // 1. 署名検証 (Web Crypto API)
        // STRIPE_WEBHOOK_SECRET が設定されている場合のみ検証し、未設定の場合は検証テストを容易にするためスキップ
        if (env.STRIPE_WEBHOOK_SECRET) {
            const isValid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
            if (!isValid) {
                return new Response(JSON.stringify({ error: 'Invalid Stripe signature' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } else {
            console.warn('[Webhook] STRIPE_WEBHOOK_SECRET not set, proceeding without signature verification (Test/Fallback mode)');
        }

        const event = JSON.parse(rawBody);
        const eventType = event.type;
        const dataObject = event.data?.object;

        if (!env.DB) {
            return new Response(JSON.stringify({ 
                received: true, 
                note: 'Mock mode without DB',
                event: eventType 
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. テーブル存在保証 (CREATE TABLE IF NOT EXISTS)
        await ensureTables(env.DB);

        // 3. イベント処理
        switch (eventType) {
            case 'checkout.session.completed': {
                // Payment LinksまたはStripe Checkoutでの決済完了
                const clientReferenceId = dataObject.client_reference_id; // フロントエンドから渡されたuserId
                const customerEmail = dataObject.customer_details?.email || dataObject.customer_email || '';
                const customerId = dataObject.customer || '';
                const subscriptionId = dataObject.subscription || '';

                // 対象ユーザーIDの解決 (client_reference_id を最優先)
                const targetUserId = clientReferenceId || (customerId ? `user_${customerId}` : (customerEmail || `user_anon_${Date.now()}`));

                // D1対象ユーザーを確実に 'pro' に UPSERT
                await env.DB.prepare(`
                    INSERT INTO users (id, email, plan, stripe_customer_id, stripe_subscription_id, updated_at)
                    VALUES (?, ?, 'pro', ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(id) DO UPDATE SET
                        plan = 'pro',
                        email = CASE WHEN excluded.email != '' THEN excluded.email ELSE users.email END,
                        stripe_customer_id = CASE WHEN excluded.stripe_customer_id != '' THEN excluded.stripe_customer_id ELSE users.stripe_customer_id END,
                        stripe_subscription_id = CASE WHEN excluded.stripe_subscription_id != '' THEN excluded.stripe_subscription_id ELSE users.stripe_subscription_id END,
                        updated_at = CURRENT_TIMESTAMP
                `).bind(
                    targetUserId,
                    customerEmail,
                    customerId,
                    subscriptionId
                ).run();

                // 同一メールアドレスの別レコードが存在する場合も同期
                if (customerEmail) {
                    await env.DB.prepare(`
                        UPDATE users SET plan = 'pro', updated_at = CURRENT_TIMESTAMP WHERE email = ?
                    `).bind(customerEmail).run();
                }
                break;
            }

            case 'customer.subscription.deleted': {
                // サブスクリプション解約時
                const customerId = dataObject.customer;
                if (customerId) {
                    await env.DB.prepare(`
                        UPDATE users 
                        SET plan = 'free', updated_at = CURRENT_TIMESTAMP 
                        WHERE stripe_customer_id = ?
                    `).bind(customerId).run();
                }
                break;
            }

            case 'customer.subscription.updated': {
                // サブスクリプション更新時 (アクティブ/支払い猶予/一時停止等)
                const status = dataObject.status;
                const customerId = dataObject.customer;
                const plan = (status === 'active' || status === 'trialing') ? 'pro' : 'free';
                if (customerId) {
                    await env.DB.prepare(`
                        UPDATE users 
                        SET plan = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE stripe_customer_id = ?
                    `).bind(plan, customerId).run();
                }
                break;
            }

            default:
                break;
        }

        return new Response(JSON.stringify({ 
            received: true,
            eventType: eventType
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Web Crypto APIによるStripe Webhook署名検証
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;
    try {
        const parts = signatureHeader.split(',');
        let timestamp = null;
        const signatures = [];
        for (const part of parts) {
            const [k, v] = part.split('=');
            if (k && v) {
                if (k.trim() === 't') timestamp = v.trim();
                if (k.trim() === 'v1') signatures.push(v.trim());
            }
        }
        if (!timestamp || signatures.length === 0) return false;

        const encoder = new TextEncoder();
        const payloadToSign = `${timestamp}.${rawBody}`;
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadToSign));
        const hashArray = Array.from(new Uint8Array(mac));
        const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return signatures.some(sig => sig === expectedSignature);
    } catch (e) {
        console.error('[Webhook] Signature verification error:', e);
        return false;
    }
}

// D1テーブル自動作成 (テーブル未作成エラー完全防止)
async function ensureTables(db) {
    try {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT,
                plan TEXT NOT NULL DEFAULT 'free',
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                doc_number TEXT NOT NULL,
                title TEXT NOT NULL,
                client_name TEXT NOT NULL,
                issue_date TEXT NOT NULL,
                due_date TEXT,
                total_amount INTEGER NOT NULL DEFAULT 0,
                tax_amount INTEGER NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'JPY',
                data_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
    } catch (e) {
        // すでに存在している場合等は無視
    }
}
