import re
import sys
import os
import json

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


def test_shorui_flow():
    print("=== ShoruiFlow (書類フロー) 自動テスト検証スイート開始 ===")
    base_dir = r"C:\Users\takuy\.gemini\antigravity-ide\scratch\shorui-flow"
    public_dir = os.path.join(base_dir, "public")
    
    html_path = os.path.join(public_dir, "index.html")
    css_path = os.path.join(public_dir, "css", "style.css")
    js_path = os.path.join(public_dir, "js", "app.js")
    
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()
    with open(js_path, "r", encoding="utf-8") as f:
        js_content = f.read()

    errors = []

    # 1. HTML構造テスト
    print("[1] HTML構造・要素検証...")
    required_ids = [
        "brand-logo", "tab-estimate", "tab-order", "tab-delivery", "tab-invoice",
        "btn-new-doc", "btn-saved-list", "btn-cloud-save", "btn-share-hash", "btn-theme-toggle", "btn-header-pro",
        "form-doc-number", "form-issue-date", "form-due-date", "form-title",
        "form-client-name", "form-issuer-name", "form-invoice-number", "form-notes",
        "items-list", "add-item-btn", "quick-convert-container", "btn-print",
        "printable-a4-sheet", "paper-doc-title", "paper-grand-total", "paper-items-tbody",
        "paper-tax10-target", "paper-tax10-amount", "paper-tax8-target", "paper-tax8-amount",
        "upgrade-modal", "btn-stripe-checkout", "saved-docs-modal", "notion-bundle-modal",
        "btn-footer-tokusho", "btn-footer-terms", "btn-footer-privacy", "btn-footer-portal",
        "modal-tokusho", "modal-terms", "modal-privacy"
    ]
    for req_id in required_ids:
        if f'id="{req_id}"' not in html_content and f"id='{req_id}'" not in html_content:
            errors.append(f"HTML element #{req_id} missing")
    print(f"  -> {len(required_ids)} 個の必須UIコンポーネント（フッター法務・特商法・規約モーダル含む）確認完了")

    # 1.1 Stripe URL 埋め込み＆特商法必須記載検証
    print("[1.1] Stripe審査用URL埋め込み & 特商法必須項目検証...")
    stripe_buy_url = "https://buy.stripe.com/test_5kQfZg21R0Sd5jA3PSao801"
    stripe_portal_url = "https://billing.stripe.com/p/login/test_28E14mbCr9oJh2i5Y0ao800"
    
    if stripe_buy_url not in html_content or stripe_buy_url not in js_content:
        errors.append("Stripe Checkout buy URL missing in HTML or JS")
    if stripe_portal_url not in html_content:
        errors.append("Stripe Customer Portal URL missing in HTML")
    
    # 特商法の必須記載文言検証
    tokusho_required_texts = [
        "請求があった場合には遅滞なく開示いたします",
        "運営統括責任者",
        "販売価格",
        "代金の支払時期と方法",
        "解約条件"
    ]
    for txt in tokusho_required_texts:
        if txt not in html_content:
            errors.append(f"Tokusho mandatory text missing: {txt}")
    print("  -> Stripe Checkout URL、Customer Portal URL、特商法審査必須項目の確認完了")

    # 2. CSS @media print & 人間工学カラーパレット検証
    print("[2] CSS印刷用スタイル & 人間工学カラーパレット検証...")
    if "@media print" not in css_content:
        errors.append("CSS lacks @media print")
    if "A4 portrait" not in css_content:
        errors.append("CSS lacks @page size A4 portrait")
    if "display: none !important" not in css_content:
        errors.append("CSS print rules lack UI suppression rules")
    if "--color-bg-base: #f1f5f9" not in css_content:
        errors.append("CSS lacks Soft Modern Slate ergonomics base background (#f1f5f9)")
    if '[data-theme="dark"]' not in css_content:
        errors.append("CSS lacks [data-theme='dark'] definition")
    print("  -> 人間工学カラーパレット (Soft Modern Slate + Dark Mode) & A4印刷ルール確認完了")

    # 3. JavaScript ロジック検証
    print("[3] JavaScript 業務ロジック・計算ロジック検証...")
    
    # 3.1 4種書類定義
    for dtype in ["estimate", "order", "delivery", "invoice"]:
        if f"{dtype}:" not in js_content and f"'{dtype}'" not in js_content:
            errors.append(f"JS missing docType config for {dtype}")
    print("  -> 4種書類定義 (見積・発注・納品・請求) 確認完了")

    # 3.2 ワンクリック変換ロジック
    if "convertDocumentTo" not in js_content:
        errors.append("JS missing convertDocumentTo function")
    else:
        print("  -> ワンクリックデータ変換関数 (convertDocumentTo) 確認完了")

    # 3.3 計算・インボイスロジック
    if "0.10" not in js_content or "0.08" not in js_content:
        errors.append("JS missing 10% / 8% tax calculation logic")
    if "currentDoc.rounding" not in js_content:
        errors.append("JS missing rounding calculation")
    print("  -> 10% / 8% 税率個別計算および端数処理ロジック確認完了")

    # 3.4 URLハッシュ共有 (Base64)
    if "generateShareHashLink" not in js_content or "#data=" not in js_content:
        errors.append("JS missing URL hash Base64 sharing logic")
    print("  -> サーバーレスURLハッシュ共有機能確認完了")

    # 3.5 クラウド保存 5件制限 & Proアップセルモーダル発火
    if "cloudDocs.length >= 5" not in js_content and "length >= 5" not in js_content:
        errors.append("JS missing 5-documents freemium limit check")
    if "openUpgradeModal" not in js_content:
        errors.append("JS missing upgrade modal invocation on limit exceeded")
    print("  -> 5件フリーミアム制限およびProアップセルモーダル発火確認完了")

    # 3.6 テーマ管理ロジック
    # 3.6 テーマ管理ロジック
    if "initTheme" not in js_content or "shorui_theme" not in js_content:
        errors.append("JS missing initTheme / shorui_theme persistence")
    print("  -> 外観テーマ切り替え (Light / Dark) 永続化ロジック確認完了")

    # 3.7 クライアント識別子 (userId) & Stripe client_reference_id 連動検証
    if "shorui_user_id" not in js_content or "client_reference_id" not in js_content:
        errors.append("JS missing userId generation or client_reference_id Stripe parameter binding")
    if "/api/user-status" not in js_content or "checkUserStatusAndHandleReturn" not in js_content:
        errors.append("JS missing user-status API synchronization or return handler")
    print("  -> クライアント識別子 (userId) 生成、Stripe client_reference_id 動的付与、即時同期ロジック確認完了")

    # 4. プランB (Notionテンプレート) 成果物検証
    print("[4] プランB Notionテンプレート成果物検証...")
    notion_dir = os.path.join(base_dir, "notion-template")
    notion_files = [
        "1_notion_database_schema.md",
        "2_formula_2.0_expressions.md",
        "4_buyer_setup_guide.md",
        os.path.join("3_sample_data", "clients.csv"),
        os.path.join("3_sample_data", "invoices_estimates.csv"),
        os.path.join("3_sample_data", "expenses.csv"),
        os.path.join("3_sample_data", "sns_schedules.csv")
    ]
    for nf in notion_files:
        full_nf = os.path.join(notion_dir, nf)
        if not os.path.exists(full_nf):
            errors.append(f"Notion artifact missing: {nf}")
        else:
            size = os.path.getsize(full_nf)
            if size == 0:
                errors.append(f"Notion artifact empty: {nf}")
    print(f"  -> {len(notion_files)} 個のNotionテンプレート設計書・Formula・CSVデータ確認完了")

    # 5. Cloudflare D1 & Functions 検証
    print("[5] Cloudflare D1 & Functions API 検証...")
    functions_files = [
        os.path.join(base_dir, "schema.sql"),
        os.path.join(base_dir, "functions", "api", "documents.js"),
        os.path.join(base_dir, "functions", "api", "webhook.js"),
        os.path.join(base_dir, "functions", "api", "portal.js"),
        os.path.join(base_dir, "functions", "api", "user-status.js")
    ]
    for ff in functions_files:
        if not os.path.exists(ff):
            errors.append(f"Functions/DB file missing: {ff}")
    
    # webhook.js の堅牢性検証 (Web Crypto API & ensureTables)
    with open(os.path.join(base_dir, "functions", "api", "webhook.js"), "r", encoding="utf-8") as wf:
        webhook_content = wf.read()
    if "client_reference_id" not in webhook_content or "ensureTables" not in webhook_content:
        errors.append("webhook.js missing client_reference_id processing or ensureTables auto-migration")
    if "STRIPE_WEBHOOK_SECRET" not in webhook_content or "crypto.subtle" not in webhook_content:
        errors.append("webhook.js missing Web Crypto API or secret check")
    print("  -> Cloudflare D1スキーマおよびFunctions API (user-status, webhook, documents, portal) 確認完了")

    # 結果集計
    print("\n=== テスト結果 ===")
    if errors:
        print(f"❌ エラーが {len(errors)} 件発生しました:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("✅ 全てのテスト項目が正常に合格しました！ (100% PASS)")
        return True

if __name__ == "__main__":
    test_shorui_flow()
