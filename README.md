# ShoruiFlow (書類フロー)
## B2B業務書類作成＆ワンクリック変換マイクロSaaS ＆ Notion業務管理テンプレート

Google Drive上の仕様書（SPEC）に基づき完全実装された、**完全固定費ゼロ円**で運用可能なB2B特化型マイクロSaaSと、副産物展開用Notion業務管理テンプレートパッケージです。

---

## 📂 プロジェクト構成

```
shorui-flow/
├── public/                       # フロントエンド（完全Vanilla構成）
│   ├── index.html                # 洗練されたUI、A4用紙リアルタイムプレビュー
│   ├── css/
│   │   └── style.css             # グラスモーフィズム＆@media print(A4完全最適化)
│   └── js/
│       └── app.js                # 4種書類連動・計算・LocalStorage・URL共有
├── functions/                    # Cloudflare Pages Functions (サーバーレスAPI)
│   └── api/
│       ├── documents.js          # D1クラウド保存・取得・5件上限チェック
│       ├── webhook.js            # Stripe Webhook決済完了連携(Pro昇格)
│       └── portal.js             # Stripe Customer Portal連携(解約・カード変更)
├── schema.sql                    # Cloudflare D1データベース定義
├── notion-template/              # 【プランB】副産物Notionテンプレート
│   ├── 1_notion_database_schema.md    # 4大DB定義・リレーション設計書
│   ├── 2_formula_2.0_expressions.md   # Formula 2.0 高度数式集(請求漏れアラート等)
│   ├── 3_sample_data/                 # インポート用即戦力ダミーCSV (4種)
│   │   ├── clients.csv
│   │   ├── invoices_estimates.csv
│   │   ├── expenses.csv
│   │   └── sns_schedules.csv
│   └── 4_buyer_setup_guide.md         # 購入者向けセットアップ・出品運用マニュアル
├── test_suite.py                 # 全自動テスト・検証スイート (100% PASS)
├── SPEC.md                       # 元仕様書ドキュメント
└── README.md                     # 本ドキュメント
```

---

## 🚀 主な機能・実装要件（プランA: マイクロSaaS）

1. **4種書類の連動作成＆ワンクリック自動変換**
   - 「御見積書」「御注文書」「納品書」「御請求書」の4種類に対応。
   - 入力した明細や取引先データを保持したまま、ボタン1つで別書類へレイアウト・書類番号・期日を即時変換。
2. **リアルタイム自動計算＆インボイス制度対応**
   - 品目ごとの数量×単価、標準税率10% / 軽減税率8%の個別税率集計。
   - インボイス制度で定められた「税率ごとに1回の端数処理（切り捨て/四捨五入/切り上げ）」を正確に実行。
   - 適格請求書発行事業者番号（T+13桁）表示。
3. **自社ロゴ・角印（社判）スタンプ機能**
   - 画像ファイルをアップロードするだけで、プレビュー上に印鑑やロゴを正確に配置。
4. **LocalStorage自動保存＆復元**
   - 入力データはブラウザのLocalStorageに即時自動保存。リロードや誤操作でもデータが失われません。
5. **URLハッシュによるサーバーレス共有（自然拡散メカニズム）**
   - 書類データをBase64エンコードしてURLハッシュ（`#data=...`）に格納。
   - サーバーを介さずセキュアに取引先へ共有可能。リンクを受け取った側にも無料作成導線を表示。
6. **A4印刷最適化（`@media print`）**
   - 印刷時・PDF保存時は余計なUI（操作パネル、ヘッダー、ボタン類）を完全非表示。
   - 日本のビジネスマナーに即したA4縦1枚にレイアウト崩れなく綺麗に収まります。
7. **フリーミアム制限＆Stripe決済モーダル**
   - 無料プランはクラウド保存最大5件まで。6件目の保存アクションでProプラン（月額980円 / 年額5,000円）へのアップセルモーダルが起動。
   - Stripe Payment LinksおよびStripe Customer Portal（セルフサービス解約）に対応。

---

## 💎 プランB: 副産物展開用 Notion業務管理テンプレート

ShoruiFlowのデータ構造と直結した、BOOTHやGumroadで買い切り販売（1,980円〜3,480円推奨）可能なパッケージです。
- **4大データベース構造:** 案件・クライアントDB、見積・請求ステータスDB、外注費・経費DB、SNS投稿スケジュールDB
- **Formula 2.0 数式:** 請求書発行漏れアラート、納期カウントダウン、粗利益・粗利率自動計算
- **ダミーCSV:** インポートするだけですぐに運用開始できるサンプルデータ

---

## 🛠️ ローカルでの起動・確認方法

```bash
# shorui-flow/public ディレクトリでローカルHTTPサーバーを起動
cd shorui-flow/public
python -m http.server 8787
```
ブラウザで `http://localhost:8787/` にアクセスしてください。

---

## 🌐 Cloudflareへのゼロコスト本番デプロイ手順

1. **Cloudflare Pagesにリポジトリを接続**
   - Build command: （なし、空欄でOK）
   - Build output directory: `public`
2. **Cloudflare D1 データベースの作成**
   ```bash
   npx wrangler d1 create shorui-db
   npx wrangler d1 execute shorui-db --file=./schema.sql
   ```
   - Cloudflare Pagesの設定「Settings > Functions > D1 Database Bindings」で、変数名を `DB` としてバインドします。
3. **Stripe連携**
   - StripeダッシュボードでPayment Linkを作成し、モーダルのURLに設定。
   - Pagesの環境変数に `STRIPE_PORTAL_URL` を設定すると、Customer Portalによる解約・カード変更が自動化されます。
