-- Cloudflare D1 データベーススキーマ定義
-- ShoruiFlow (書類フロー) - B2B業務書類マイクロSaaS

-- ユーザーテーブル (Proプラン認証・契約管理)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- ユーザーUUIDまたはStripe Customer ID (client_reference_id)
    email TEXT,
    plan TEXT NOT NULL DEFAULT 'free',         -- 'free' | 'pro'
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- クラウド保存ドキュメントテーブル (フリープランは最大5件、Proは無制限)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,                       -- ドキュメントUUID
    user_id TEXT NOT NULL,                     -- users.id への外部キー
    doc_type TEXT NOT NULL,                    -- 'estimate' | 'order' | 'delivery' | 'invoice'
    doc_number TEXT NOT NULL,                  -- 書類番号 (例: EST-2026-001, INV-2026-001)
    title TEXT NOT NULL,                       -- 件名
    client_name TEXT NOT NULL,                 -- 取引先名
    issue_date TEXT NOT NULL,                  -- 発行日 (YYYY-MM-DD)
    due_date TEXT,                             -- 支払期日/有効期限
    total_amount INTEGER NOT NULL DEFAULT 0,   -- 合計金額 (税込)
    tax_amount INTEGER NOT NULL DEFAULT 0,     -- 消費税額
    currency TEXT NOT NULL DEFAULT 'JPY',
    data_json TEXT NOT NULL,                   -- 明細や自社情報を含む完全なJSONデータ
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 事業所・自社プロファイル情報テーブル (Proプランの複数事業所切り替え用)
CREATE TABLE IF NOT EXISTS business_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    profile_name TEXT NOT NULL,                -- 例: 「本社」「開発スタジオ」
    company_name TEXT NOT NULL,
    postal_code TEXT,
    address TEXT,
    tel TEXT,
    email TEXT,
    invoice_number TEXT,                       -- 適格請求書発行事業者番号 (T+13桁)
    bank_info TEXT,                            -- 振込先銀行口座情報
    logo_data_url TEXT,                        -- Base64ロゴ画像 (Pro限定固定)
    seal_data_url TEXT,                        -- Base64角印画像 (Pro限定固定)
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
