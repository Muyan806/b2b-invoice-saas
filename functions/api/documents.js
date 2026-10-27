// Cloudflare Pages Functions: /api/documents
// D1データベースと連携した書類の保存・取得・削除および5件制限チェック

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'guest_user';

    try {
        if (!env.DB) {
            return new Response(JSON.stringify({ 
                error: 'D1 database not bound (local mock mode)', 
                documents: [], 
                count: 0,
                plan: 'free',
                limit: 5
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ユーザーのプラン確認
        const user = await env.DB.prepare(
            'SELECT * FROM users WHERE id = ?'
        ).bind(userId).first();

        const plan = user?.plan || 'free';

        // 書類一覧取得
        const { results } = await env.DB.prepare(
            'SELECT id, doc_type, doc_number, title, client_name, issue_date, due_date, total_amount, updated_at FROM documents WHERE user_id = ? ORDER BY updated_at DESC'
        ).bind(userId).all();

        return new Response(JSON.stringify({
            success: true,
            documents: results || [],
            count: results ? results.length : 0,
            plan: plan,
            limit: plan === 'pro' ? 999999 : 5
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const {
            userId = 'guest_user',
            id,
            docType,
            docNumber,
            title,
            clientName,
            issueDate,
            dueDate,
            totalAmount,
            taxAmount,
            data
        } = body;

        if (!env.DB) {
            // ローカル/DB未設定環境用レスポンス
            return new Response(JSON.stringify({
                success: true,
                message: 'Local fallback: Saved successfully (DB mock)',
                id: id || `doc_${Date.now()}`
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ユーザー取得または初期登録
        let user = await env.DB.prepare(
            'SELECT * FROM users WHERE id = ?'
        ).bind(userId).first();

        if (!user) {
            await env.DB.prepare(
                'INSERT INTO users (id, email, plan) VALUES (?, ?, ?)'
            ).bind(userId, `${userId}@example.com`, 'free').run();
            user = { id: userId, plan: 'free' };
        }

        // 無料プランの保存上限（5件）チェック
        if (user.plan !== 'pro') {
            const countResult = await env.DB.prepare(
                'SELECT COUNT(*) as count FROM documents WHERE user_id = ? AND id != ?'
            ).bind(userId, id || '').first();

            const currentCount = countResult?.count || 0;
            if (currentCount >= 5) {
                return new Response(JSON.stringify({
                    success: false,
                    requiresPro: true,
                    code: 'PLAN_LIMIT_EXCEEDED',
                    message: '無料プランの上限（5件）に達しました。無制限保存にはProプランへのアップグレードが必要です。',
                    upgradeUrl: 'https://buy.stripe.com/test_placeholder_link'
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const jsonString = JSON.stringify(data || {});

        // 既存更新または新規挿入 (UPSERT)
        await env.DB.prepare(`
            INSERT INTO documents (
                id, user_id, doc_type, doc_number, title, client_name, issue_date, due_date, total_amount, tax_amount, data_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                doc_type = excluded.doc_type,
                doc_number = excluded.doc_number,
                title = excluded.title,
                client_name = excluded.client_name,
                issue_date = excluded.issue_date,
                due_date = excluded.due_date,
                total_amount = excluded.total_amount,
                tax_amount = excluded.tax_amount,
                data_json = excluded.data_json,
                updated_at = CURRENT_TIMESTAMP
        `).bind(
            docId, userId, docType || 'estimate', docNumber || '', title || '', clientName || '',
            issueDate || '', dueDate || '', totalAmount || 0, taxAmount || 0, jsonString
        ).run();

        return new Response(JSON.stringify({
            success: true,
            message: '書類が正常に保存されました',
            id: docId
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const docId = url.searchParams.get('id');
    const userId = url.searchParams.get('userId') || 'guest_user';

    if (!docId) {
        return new Response(JSON.stringify({ success: false, error: 'Document ID required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        if (env.DB) {
            await env.DB.prepare(
                'DELETE FROM documents WHERE id = ? AND user_id = ?'
            ).bind(docId, userId).run();
        }

        return new Response(JSON.stringify({ success: true, message: '削除しました' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
