// Cloudflare Pages Functions: /api/user-status
// ユーザー識別子 (userId / client_reference_id) に基づく最新プランおよび契約状態照会API

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return new Response(JSON.stringify({ success: false, error: 'userId is required' }), {
            status: 400,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    try {
        if (!env.DB) {
            return new Response(JSON.stringify({
                success: true,
                userId,
                plan: 'free',
                isPro: false,
                note: 'Mock mode without DB'
            }), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // テーブルが存在しない場合に備えて自動作成 (堅牢性確保)
        await ensureTables(env.DB);

        // 対象ユーザーの最新情報を取得
        const user = await env.DB.prepare(
            'SELECT id, email, plan, stripe_customer_id, updated_at FROM users WHERE id = ?'
        ).bind(userId).first();

        const plan = user?.plan || 'free';
        const isPro = plan === 'pro';

        return new Response(JSON.stringify({
            success: true,
            userId,
            plan,
            isPro,
            stripeCustomerId: user?.stripe_customer_id || null,
            updatedAt: user?.updated_at || null
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

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
        `);
    } catch (e) {
        // すでに存在している場合等は無視
    }
}
