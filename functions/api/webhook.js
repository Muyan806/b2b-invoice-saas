// Cloudflare Pages Functions: /api/webhook
// Stripe Webhook処理 (決済完了によるProプラン自動有効化・解約反映)

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const signature = request.headers.get('stripe-signature');
        const rawBody = await request.text();
        const event = JSON.parse(rawBody);

        // ※ 本番環境では env.STRIPE_WEBHOOK_SECRET を用いて署名検証を実施
        // Stripe SDKまたはWeb Crypto APIで構築

        const eventType = event.type;
        const dataObject = event.data?.object;

        if (!env.DB) {
            return new Response(JSON.stringify({ received: true, note: 'Mock mode without DB' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        switch (eventType) {
            case 'checkout.session.completed': {
                // Payment LinksまたはCheckoutでの決済完了
                const customerEmail = dataObject.customer_details?.email || dataObject.customer_email;
                const customerId = dataObject.customer;
                const subscriptionId = dataObject.subscription;
                const clientReferenceId = dataObject.client_reference_id; // アプリのuserId

                if (clientReferenceId || customerEmail) {
                    await env.DB.prepare(`
                        INSERT INTO users (id, email, plan, stripe_customer_id, stripe_subscription_id, updated_at)
                        VALUES (?, ?, 'pro', ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT(id) DO UPDATE SET
                            plan = 'pro',
                            stripe_customer_id = excluded.stripe_customer_id,
                            stripe_subscription_id = excluded.stripe_subscription_id,
                            updated_at = CURRENT_TIMESTAMP
                    `).bind(
                        clientReferenceId || `user_${customerId}`,
                        customerEmail || 'customer@example.com',
                        customerId || '',
                        subscriptionId || ''
                    ).run();
                }
                break;
            }

            case 'customer.subscription.deleted': {
                // サブスクリプション解約時
                const customerId = dataObject.customer;
                await env.DB.prepare(`
                    UPDATE users 
                    SET plan = 'free', updated_at = CURRENT_TIMESTAMP 
                    WHERE stripe_customer_id = ?
                `).bind(customerId).run();
                break;
            }

            case 'customer.subscription.updated': {
                const status = dataObject.status;
                const customerId = dataObject.customer;
                const plan = (status === 'active' || status === 'trialing') ? 'pro' : 'free';
                await env.DB.prepare(`
                    UPDATE users 
                    SET plan = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE stripe_customer_id = ?
                `).bind(plan, customerId).run();
                break;
            }

            default:
                // 他のイベント
                break;
        }

        return new Response(JSON.stringify({ received: true }), {
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
