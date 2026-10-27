// Cloudflare Pages Functions: /api/portal
// Stripe Customer Portalセッション作成 (セルフサービス解約・カード変更)

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');

    // 既定のStripe Customer Portalの直接URLが環境変数に設定されている場合
    if (env?.STRIPE_PORTAL_URL) {
        return Response.redirect(env.STRIPE_PORTAL_URL, 302);
    }

    // Stripe APIキーがある場合はBilling Portal Sessionを作成
    if (env?.STRIPE_SECRET_KEY && customerId) {
        try {
            const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    customer: customerId,
                    return_url: `${url.origin}/`
                })
            });

            const data = await response.json();
            if (data.url) {
                return Response.redirect(data.url, 302);
            }
        } catch (e) {
            console.error('Failed to create customer portal session:', e);
        }
    }

    // 開発・設定前用フォールバック
    return new Response(JSON.stringify({
        message: 'Stripe Customer Portal',
        setupInstruction: 'Cloudflare Pagesの環境変数に STRIPE_PORTAL_URL または STRIPE_SECRET_KEY を設定してください。',
        defaultUrl: 'https://billing.stripe.com/p/login/test_placeholder'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
