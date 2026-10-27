/**
 * ShoruiFlow (書類フロー) - Core Business Document Logic
 * Fully autonomous Vanilla JavaScript application
 */

// --- Default Document State ---
const DEFAULT_STATE = {
    docType: 'estimate', // 'estimate' | 'order' | 'delivery' | 'invoice'
    docNumber: 'EST-2026-001',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    title: 'Webシステム開発および運用支援の件',
    clientName: '株式会社オープンイノベーション',
    clientHonorific: '御中',
    clientPostal: '〒150-0043',
    clientAddress: '東京都渋谷区道玄坂1-2-3 渋谷マークシティ 14F',
    clientContact: '佐藤 健一 様',
    
    // 自社（発行者）情報
    issuerName: '合同会社ネクストテクノロジー',
    issuerPostal: '〒107-0062',
    issuerAddress: '東京都港区南青山2-5-17',
    issuerTel: '03-6800-1234',
    issuerEmail: 'contact@next-technology.jp',
    invoiceNumber: 'T1234567890123',
    issuerLogo: '',
    issuerSeal: '', // 角印画像 DataURL
    showSeal: true,

    // 振込先情報 (請求書用)
    bankName: '三井住友銀行',
    branchName: '青山支店 (普通)',
    accountNumber: '1234567',
    accountHolder: '合同会社ネクストテクノロジー',

    // 計算設定
    rounding: 'floor', // 'floor' | 'round' | 'ceil'

    // 明細品目
    items: [
        { desc: '業務Webアプリケーション 基本設計・プロトタイプ構築', qty: 1, unit: '式', price: 300000, taxRate: 10 },
        { desc: 'フロントエンド実装 (HTML/Vanilla CSS/JavaScript)', qty: 1, unit: '式', price: 250000, taxRate: 10 },
        { desc: 'サーバーレスAPI連携 & インボイス帳票出力機能', qty: 1, unit: '式', price: 150000, taxRate: 10 },
        { desc: 'システム仕様書およびNotion運用マニュアル作成', qty: 1, unit: '式', price: 50000, taxRate: 10 }
    ],

    notes: '【お支払期日】発行月末締め翌月末払い\n【振込手数料】貴社ご負担にてお願い申し上げます。\n本見積書の有効期限は発行日より30日間となります。'
};

// Document Type Definitions
const DOC_TYPES = {
    estimate: {
        name: '御見積書',
        code: 'EST',
        dateLabel: '見積日',
        dueLabel: '有効期限',
        actionLabel: '見積書',
        notesPlaceholder: '本見積書の有効期限は発行日より30日間となります。'
    },
    order: {
        name: '御注文書',
        code: 'ORD',
        dateLabel: '注文日',
        dueLabel: '希望納期',
        actionLabel: '発注書',
        notesPlaceholder: '上記内容および条件にて正式に発注いたします。'
    },
    delivery: {
        name: '納品書',
        code: 'DLV',
        dateLabel: '納品日',
        dueLabel: '検収期日',
        actionLabel: '納品書',
        notesPlaceholder: '上記の通り納品いたしました。内容をご確認のうえ検収をお願い申し上げます。'
    },
    invoice: {
        name: '御請求書',
        code: 'INV',
        dateLabel: '請求日',
        dueLabel: 'お支払期日',
        actionLabel: '請求書',
        notesPlaceholder: '【お振込期日】当月末締め翌月末払い\n【振込手数料】貴社ご負担にてお願い申し上げます。'
    }
};

// Active State
let currentDoc = JSON.parse(JSON.stringify(DEFAULT_STATE));
let cloudDocs = []; // クラウド/ローカル保存済み書類リスト

// DOM Elements
const docTabs = document.querySelectorAll('.doc-tab');
const itemsListEl = document.getElementById('items-list');
const addItemBtn = document.getElementById('add-item-btn');
const toastContainer = document.getElementById('toast-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadSavedData();
    bindFormEvents();
    renderDocTabs();
    calculateAndRender();
    initModals();
    loadCloudSavedDocs();
    setupInlineValidation();
});

// --- URL Hash and Storage Restoration ---
function loadSavedData() {
    // 1. URLハッシュからの共有データ確認 (#data=...)
    if (window.location.hash.startsWith('#data=')) {
        try {
            const rawBase64 = window.location.hash.replace('#data=', '');
            const decodedJson = decodeURIComponent(escape(atob(rawBase64)));
            const sharedData = JSON.parse(decodedJson);
            currentDoc = { ...DEFAULT_STATE, ...sharedData };
            showToast('共有リンクから書類データを読み込みました', 'info');
            return;
        } catch (e) {
            console.error('Failed to parse URL hash data:', e);
            showToast('共有データの復元に失敗しました。デフォルトを表示します。', 'warning');
        }
    }

    // 2. LocalStorageからの自動復元
    const cached = localStorage.getItem('shorui_current_doc');
    if (cached) {
        try {
            currentDoc = { ...DEFAULT_STATE, ...JSON.parse(cached) };
        } catch (e) {
            console.error('LocalStorage parse error:', e);
        }
    }
}

// Auto-save to LocalStorage
function autoSave() {
    localStorage.setItem('shorui_current_doc', JSON.stringify(currentDoc));
}

// --- Bind Form Inputs to Current Document ---
function bindFormEvents() {
    // Document Meta
    bindInput('form-doc-number', 'docNumber');
    bindInput('form-issue-date', 'issueDate');
    bindInput('form-due-date', 'dueDate');
    bindInput('form-title', 'title');

    // Client
    bindInput('form-client-name', 'clientName');
    bindInput('form-client-honorific', 'clientHonorific');
    bindInput('form-client-postal', 'clientPostal');
    bindInput('form-client-address', 'clientAddress');
    bindInput('form-client-contact', 'clientContact');

    // Issuer
    bindInput('form-issuer-name', 'issuerName');
    bindInput('form-issuer-postal', 'issuerPostal');
    bindInput('form-issuer-address', 'issuerAddress');
    bindInput('form-issuer-tel', 'issuerTel');
    bindInput('form-issuer-email', 'issuerEmail');
    bindInput('form-invoice-number', 'invoiceNumber');

    // Bank
    bindInput('form-bank-name', 'bankName');
    bindInput('form-branch-name', 'branchName');
    bindInput('form-account-number', 'accountNumber');
    bindInput('form-account-holder', 'accountHolder');

    // Calculation & Notes
    bindInput('form-rounding', 'rounding');
    bindInput('form-notes', 'notes');

    // Seal & Logo uploads
    document.getElementById('form-logo-file').addEventListener('change', (e) => handleImageUpload(e, 'issuerLogo'));
    document.getElementById('form-seal-file').addEventListener('change', (e) => handleImageUpload(e, 'issuerSeal'));
    document.getElementById('form-show-seal').addEventListener('change', (e) => {
        currentDoc.showSeal = e.target.checked;
        autoSave();
        calculateAndRender();
    });

    // Add Item Button
    addItemBtn.addEventListener('click', () => {
        currentDoc.items.push({
            desc: '',
            qty: 1,
            unit: '式',
            price: 0,
            taxRate: 10
        });
        autoSave();
        renderItemInputs();
        calculateAndRender();
    });

    // Global Action Buttons
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-share-hash').addEventListener('click', generateShareHashLink);
    document.getElementById('btn-new-doc').addEventListener('click', createNewDoc);
    document.getElementById('btn-cloud-save').addEventListener('click', handleCloudSave);
    document.getElementById('btn-saved-list').addEventListener('click', openSavedDocsModal);
    document.getElementById('btn-notion-bundle').addEventListener('click', () => {
        const modal = document.getElementById('notion-bundle-modal');
        if (modal) modal.classList.add('active');
    });

    // Convert Quick Action Buttons
    document.querySelectorAll('.btn-quick-convert').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetType = e.currentTarget.dataset.targetType;
            if (targetType) convertDocumentTo(targetType);
        });
    });

    syncFormValues();
}

function bindInput(elementId, stateKey) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.addEventListener('input', (e) => {
        currentDoc[stateKey] = e.target.value;
        autoSave();
        calculateAndRender();
    });
}

function syncFormValues() {
    const setValue = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    };

    setValue('form-doc-number', currentDoc.docNumber);
    setValue('form-issue-date', currentDoc.issueDate);
    setValue('form-due-date', currentDoc.dueDate);
    setValue('form-title', currentDoc.title);

    setValue('form-client-name', currentDoc.clientName);
    setValue('form-client-honorific', currentDoc.clientHonorific);
    setValue('form-client-postal', currentDoc.clientPostal);
    setValue('form-client-address', currentDoc.clientAddress);
    setValue('form-client-contact', currentDoc.clientContact);

    setValue('form-issuer-name', currentDoc.issuerName);
    setValue('form-issuer-postal', currentDoc.issuerPostal);
    setValue('form-issuer-address', currentDoc.issuerAddress);
    setValue('form-issuer-tel', currentDoc.issuerTel);
    setValue('form-issuer-email', currentDoc.issuerEmail);
    setValue('form-invoice-number', currentDoc.invoiceNumber);

    setValue('form-bank-name', currentDoc.bankName);
    setValue('form-branch-name', currentDoc.branchName);
    setValue('form-account-number', currentDoc.accountNumber);
    setValue('form-account-holder', currentDoc.accountHolder);

    setValue('form-rounding', currentDoc.rounding);
    setValue('form-notes', currentDoc.notes);

    const sealCheck = document.getElementById('form-show-seal');
    if (sealCheck) sealCheck.checked = currentDoc.showSeal !== false;

    renderItemInputs();
}

// Image upload helper (Logo / Seal)
function handleImageUpload(event, key) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        currentDoc[key] = e.target.result;
        autoSave();
        calculateAndRender();
        showToast('画像を登録しました', 'success');
    };
    reader.readAsDataURL(file);
}

// --- Render Items in Input Panel ---
function renderItemInputs() {
    itemsListEl.innerHTML = '';

    currentDoc.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <div class="item-row-header">
                <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight:600;">#${index + 1}</span>
                ${currentDoc.items.length > 1 ? `<button class="item-delete-btn" data-index="${index}">削除</button>` : ''}
            </div>
            <div class="form-group">
                <input type="text" class="input item-desc" placeholder="品名・品目概要" value="${escapeHtml(item.desc)}" data-index="${index}">
            </div>
            <div class="form-row-3">
                <div class="form-group">
                    <span class="form-label">数量</span>
                    <input type="number" step="any" class="input item-qty" value="${item.qty}" data-index="${index}">
                </div>
                <div class="form-group">
                    <span class="form-label">単位</span>
                    <input type="text" class="input item-unit" placeholder="式 / 個" value="${escapeHtml(item.unit || '式')}" data-index="${index}">
                </div>
                <div class="form-group">
                    <span class="form-label">税率</span>
                    <select class="select item-tax" data-index="${index}">
                        <option value="10" ${item.taxRate === 10 ? 'selected' : ''}>10% (標準)</option>
                        <option value="8" ${item.taxRate === 8 ? 'selected' : ''}>8% (軽減)</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <span class="form-label">単価 (円)</span>
                <input type="number" class="input item-price" value="${item.price}" data-index="${index}">
            </div>
        `;

        itemsListEl.appendChild(row);
    });

    // Bind item row events
    itemsListEl.querySelectorAll('.item-desc').forEach(input => {
        input.addEventListener('input', (e) => {
            currentDoc.items[e.target.dataset.index].desc = e.target.value;
            autoSave();
            calculateAndRender();
        });
    });

    itemsListEl.querySelectorAll('.item-qty').forEach(input => {
        input.addEventListener('input', (e) => {
            currentDoc.items[e.target.dataset.index].qty = parseFloat(e.target.value) || 0;
            autoSave();
            calculateAndRender();
        });
    });

    itemsListEl.querySelectorAll('.item-unit').forEach(input => {
        input.addEventListener('input', (e) => {
            currentDoc.items[e.target.dataset.index].unit = e.target.value;
            autoSave();
            calculateAndRender();
        });
    });

    itemsListEl.querySelectorAll('.item-tax').forEach(select => {
        select.addEventListener('change', (e) => {
            currentDoc.items[e.target.dataset.index].taxRate = parseInt(e.target.value, 10);
            autoSave();
            calculateAndRender();
        });
    });

    itemsListEl.querySelectorAll('.item-price').forEach(input => {
        input.addEventListener('input', (e) => {
            currentDoc.items[e.target.dataset.index].price = parseInt(e.target.value, 10) || 0;
            autoSave();
            calculateAndRender();
        });
    });

    itemsListEl.querySelectorAll('.item-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            currentDoc.items.splice(idx, 1);
            autoSave();
            renderItemInputs();
            calculateAndRender();
        });
    });
}

// --- Document Mode Switching & One-Click Transform ---
function renderDocTabs() {
    docTabs.forEach(tab => {
        const type = tab.dataset.docType;
        if (type === currentDoc.docType) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }

        tab.onclick = () => {
            setDocType(type);
        };
    });

    updateConvertButtons();
}

function setDocType(newType) {
    if (currentDoc.docType === newType) return;
    currentDoc.docType = newType;
    renderDocTabs();
    calculateAndRender();
    autoSave();
    showToast(`書類種別を「${DOC_TYPES[newType].name}」に変更しました`, 'info');
}

// One-Click Document Conversion
function convertDocumentTo(targetType) {
    if (!DOC_TYPES[targetType]) return;

    const oldType = currentDoc.docType;
    currentDoc.docType = targetType;

    // 書類番号を新種別に合わせて自動更新
    const numPart = currentDoc.docNumber.replace(/^[A-Z]+-/, '');
    currentDoc.docNumber = `${DOC_TYPES[targetType].code}-${numPart || '2026-001'}`;

    // 備考欄がデフォルトのままなら新種別のデフォルトに更新
    if (!currentDoc.notes || currentDoc.notes === DOC_TYPES[oldType].notesPlaceholder) {
        currentDoc.notes = DOC_TYPES[targetType].notesPlaceholder;
    }

    // 署名 (Signature Detail): A4用紙の活版捺印マイクロインタラクション
    const sheet = document.getElementById('printable-a4-sheet');
    if (sheet) {
        sheet.classList.remove('paper-stamp-active');
        void sheet.offsetWidth; // reflow to trigger animation
        sheet.classList.add('paper-stamp-active');
    }

    syncFormValues();
    renderDocTabs();
    calculateAndRender();
    autoSave();

    showToast(`入力内容を保持したまま「${DOC_TYPES[targetType].name}」へ変換しました`, 'success');
}

function updateConvertButtons() {
    const container = document.getElementById('quick-convert-container');
    if (!container) return;

    container.innerHTML = '';
    const otherTypes = Object.keys(DOC_TYPES).filter(t => t !== currentDoc.docType);

    otherTypes.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm btn-quick-convert';
        btn.dataset.targetType = t;
        btn.title = `入力内容を保持したまま${DOC_TYPES[t].name}へ変換します`;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg> ${DOC_TYPES[t].actionLabel}へ変換`;
        btn.onclick = () => convertDocumentTo(t);
        container.appendChild(btn);
    });
}

// --- Calculation & Paper Sheet Rendering ---
function calculateAndRender() {
    const config = DOC_TYPES[currentDoc.docType] || DOC_TYPES.estimate;

    // 1. 各品目の計算
    let subtotal10 = 0;
    let subtotal8 = 0;

    const calculatedItems = currentDoc.items.map(item => {
        const lineTotal = Math.round(item.qty * item.price);
        if (item.taxRate === 8) {
            subtotal8 += lineTotal;
        } else {
            subtotal10 += lineTotal;
        }
        return {
            ...item,
            lineTotal
        };
    });

    // 2. 端数処理ロジック
    const roundTax = (amount) => {
        if (currentDoc.rounding === 'ceil') return Math.ceil(amount);
        if (currentDoc.rounding === 'round') return Math.round(amount);
        return Math.floor(amount); // Default: floor (切り捨て)
    };

    const tax10 = roundTax(subtotal10 * 0.10);
    const tax8 = roundTax(subtotal8 * 0.08);
    const totalTax = tax10 + tax8;
    const subtotal = subtotal10 + subtotal8;
    const grandTotal = subtotal + totalTax;

    // 3. A4プレビューへの反映
    // タイトル & メタ
    setText('paper-doc-title', config.name);
    setText('paper-doc-number', currentDoc.docNumber || '-');
    setText('paper-issue-label', config.dateLabel + '：');
    setText('paper-issue-date', formatDate(currentDoc.issueDate));
    setText('paper-due-label', config.dueLabel + '：');
    setText('paper-due-date', formatDate(currentDoc.dueDate));

    // 取引先
    setText('paper-client-name', currentDoc.clientName || '（取引先名未設定）');
    setText('paper-client-honorific', currentDoc.clientHonorific || '御中');
    setText('paper-client-postal', currentDoc.clientPostal || '');
    setText('paper-client-address', currentDoc.clientAddress || '');
    setText('paper-client-contact', currentDoc.clientContact ? `ご担当：${currentDoc.clientContact}` : '');
    setText('paper-subject', currentDoc.title ? `件名：${currentDoc.title}` : '');

    // 発行者
    setText('paper-issuer-name', currentDoc.issuerName || '');
    setText('paper-issuer-postal', currentDoc.issuerPostal || '');
    setText('paper-issuer-address', currentDoc.issuerAddress || '');
    setText('paper-issuer-tel', currentDoc.issuerTel ? `TEL: ${currentDoc.issuerTel}` : '');
    setText('paper-issuer-email', currentDoc.issuerEmail ? `Email: ${currentDoc.issuerEmail}` : '');

    // インボイス登録番号
    const invoiceBox = document.getElementById('paper-invoice-box');
    if (currentDoc.invoiceNumber) {
        invoiceBox.style.display = 'block';
        setText('paper-invoice-number', currentDoc.invoiceNumber);
    } else {
        invoiceBox.style.display = 'none';
    }

    // 自社ロゴ & 角印
    const logoImg = document.getElementById('paper-issuer-logo');
    if (currentDoc.issuerLogo) {
        logoImg.src = currentDoc.issuerLogo;
        logoImg.style.display = 'block';
    } else {
        logoImg.style.display = 'none';
    }

    const sealContainer = document.getElementById('paper-seal-container');
    const sealImg = document.getElementById('paper-issuer-seal');
    if (currentDoc.showSeal && currentDoc.issuerSeal) {
        sealImg.src = currentDoc.issuerSeal;
        sealContainer.style.display = 'block';
    } else {
        sealContainer.style.display = 'none';
    }

    // 合計金額表示
    setText('paper-grand-total', formatCurrency(grandTotal));
    setText('paper-subtotal-val', formatCurrency(subtotal));
    setText('paper-tax-val', formatCurrency(totalTax));
    setText('paper-bottom-grand-total', formatCurrency(grandTotal));

    // インボイス税率別内訳
    setText('paper-tax10-target', formatCurrency(subtotal10));
    setText('paper-tax10-amount', formatCurrency(tax10));
    setText('paper-tax8-target', formatCurrency(subtotal8));
    setText('paper-tax8-amount', formatCurrency(tax8));

    // 品目テーブルの描画
    renderPaperItems(calculatedItems);

    // 振込先口座 (請求書モードのみ、または情報がある場合)
    const bankBox = document.getElementById('paper-bank-box');
    const bankEl = document.getElementById('paper-bank-detail');
    if (currentDoc.docType === 'invoice' && currentDoc.bankName) {
        bankBox.style.display = 'block';
        if (bankEl) {
            bankEl.innerHTML = `
                <span class="bank-info-item"><strong>金融機関:</strong> ${escapeHtml(currentDoc.bankName)} ${escapeHtml(currentDoc.branchName || '')}</span>
                <span class="bank-info-item"><strong>口座番号:</strong> ${escapeHtml(currentDoc.accountNumber || '')}</span>
                <span class="bank-info-item"><strong>口座名義:</strong> ${escapeHtml(currentDoc.accountHolder || '')}</span>
            `;
        }
    } else {
        bankBox.style.display = 'none';
    }

    // 備考欄
    const notesBox = document.getElementById('paper-notes-box');
    if (currentDoc.notes) {
        notesBox.style.display = 'block';
        setText('paper-notes', currentDoc.notes);
    } else {
        notesBox.style.display = 'none';
    }

    // 状態を保持
    currentDoc._calculated = {
        subtotal,
        totalTax,
        grandTotal,
        subtotal10,
        tax10,
        subtotal8,
        tax8
    };
}

function renderPaperItems(items) {
    const tbody = document.getElementById('paper-items-tbody');
    tbody.innerHTML = '';

    items.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-idx text-center">${idx + 1}</td>
            <td class="col-desc"><strong>${escapeHtml(item.desc || '')}</strong></td>
            <td class="col-qty text-right">${item.qty}</td>
            <td class="col-unit text-center">${escapeHtml(item.unit || '')}</td>
            <td class="col-price text-right">${formatNumber(item.price)}</td>
            <td class="col-tax text-center">${item.taxRate}%</td>
            <td class="col-amt text-right">${formatNumber(item.lineTotal)}</td>
        `;
        tbody.appendChild(tr);
    });

    // A4レイアウトを安定させるため最低4行の空行を補完
    if (items.length < 5) {
        const emptyRowsNeeded = 5 - items.length;
        for (let i = 0; i < emptyRowsNeeded; i++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-idx text-center">&nbsp;</td>
                <td class="col-desc">&nbsp;</td>
                <td class="col-qty">&nbsp;</td>
                <td class="col-unit">&nbsp;</td>
                <td class="col-price">&nbsp;</td>
                <td class="col-tax">&nbsp;</td>
                <td class="col-amt">&nbsp;</td>
            `;
            tbody.appendChild(tr);
        }
    }
}

// --- URL Hash Sharing ---
function generateShareHashLink() {
    try {
        const exportObj = { ...currentDoc };
        delete exportObj._calculated;

        const jsonStr = JSON.stringify(exportObj);
        const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
        const fullUrl = `${window.location.origin}${window.location.pathname}#data=${encoded}`;

        navigator.clipboard.writeText(fullUrl).then(() => {
            showToast('共有リンクを発行し、クリップボードにコピーしました！', 'success');
        }).catch(() => {
            prompt('以下の共有URLをコピーして相手に送付してください：', fullUrl);
        });
    } catch (e) {
        console.error('Failed to create share hash:', e);
        showToast('共有リンクの発行に失敗しました', 'warning');
    }
}

// --- Cloud / Local Documents Storage & Pro Tier Limitation ---
function loadCloudSavedDocs() {
    const stored = localStorage.getItem('shorui_cloud_mock_docs');
    if (stored) {
        try {
            cloudDocs = JSON.parse(stored);
        } catch (e) {
            cloudDocs = [];
        }
    }
}

function handleCloudSave() {
    const btn = document.getElementById('btn-cloud-save');
    const originalHtml = btn ? btn.innerHTML : '';

    // 即時フィードバック (INP < 200ms): Disabled化と進行表示
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> 保存中...`;
    }

    setTimeout(() => {
        // 無料プランは最大5件まで保存可能
        const isPro = localStorage.getItem('shorui_is_pro') === 'true';

        if (!isPro && cloudDocs.length >= 5) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
            // 6件目保存時にアップセルモーダルを起動！
            openUpgradeModal();
            return;
        }

        // 保存処理
        const docId = `doc_${Date.now()}`;
        const newRecord = {
            id: docId,
            docType: currentDoc.docType,
            docNumber: currentDoc.docNumber,
            title: currentDoc.title,
            clientName: currentDoc.clientName,
            totalAmount: currentDoc._calculated?.grandTotal || 0,
            updatedAt: new Date().toLocaleString('ja-JP'),
            data: JSON.parse(JSON.stringify(currentDoc))
        };

        cloudDocs.unshift(newRecord);
        localStorage.setItem('shorui_cloud_mock_docs', JSON.stringify(cloudDocs));

        // 成功フィードバック
        if (btn) {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-state-success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 保存完了`;
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }, 1200);
        }

        showToast(`書類「${currentDoc.docNumber}」をクラウドに保存しました（${cloudDocs.length}/5件）`, 'success');
    }, 150);
}

function openSavedDocsModal() {
    loadCloudSavedDocs();
    const modal = document.getElementById('saved-docs-modal');
    const listEl = document.getElementById('saved-docs-list');
    const countBadge = document.getElementById('saved-docs-count');

    countBadge.textContent = `${cloudDocs.length} 件保存中 (無料上限: 5件)`;
    listEl.innerHTML = '';

    if (cloudDocs.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1.5rem; background: #080c14; border: 1px dashed var(--color-workbench-border); border-radius: var(--radius-sm);">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📂</div>
                <div style="font-weight: 600; font-size: var(--font-size-base); color: var(--color-text-primary); margin-bottom: 0.25rem;">
                    保存された書類はまだありません
                </div>
                <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); max-width: 380px; margin: 0 auto 1.25rem; line-height: 1.5;">
                    作成した見積書や請求書は、画面右上の「クラウドに保存」をクリックするとここに保管され、いつでもワンクリックで再呼出できます。
                </p>
                <button class="btn btn-primary btn-sm" id="btn-empty-save-now">
                    現在の書類をクラウドに保存する
                </button>
            </div>
        `;
        const emptySaveBtn = document.getElementById('btn-empty-save-now');
        if (emptySaveBtn) {
            emptySaveBtn.onclick = () => {
                handleCloudSave();
                openSavedDocsModal();
            };
        }
    } else {
        cloudDocs.forEach((doc, idx) => {
            const item = document.createElement('div');
            item.className = 'saved-doc-card';
            item.style.cssText = 'background: #0d131f; border: 1px solid var(--color-workbench-border); border-radius: var(--radius-sm); padding: 0.75rem 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;';
            item.innerHTML = `
                <div>
                    <div style="font-weight:600; font-size: var(--font-size-sm); color: var(--color-text-primary);">
                        ${escapeHtml(doc.title || doc.docNumber)} 
                        <span style="font-size: var(--font-size-xs); background: #162032; color: #818cf8; padding: 1px 6px; border-radius: 2px; border: 1px solid #233044;">
                            ${DOC_TYPES[doc.docType]?.name || doc.docType}
                        </span>
                    </div>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 2px;">
                        宛先: ${escapeHtml(doc.clientName || '-')} | 金額: ${formatCurrency(doc.totalAmount)} | ${doc.updatedAt}
                    </div>
                </div>
                <div style="display: flex; gap: 0.4rem;">
                    <button class="btn btn-primary btn-sm btn-load-saved" data-id="${doc.id}">読込</button>
                    <button class="btn btn-secondary btn-sm btn-delete-saved" data-id="${doc.id}" style="color: #ef4444;">削除</button>
                </div>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll('.btn-load-saved').forEach(btn => {
            btn.onclick = (e) => {
                const doc = cloudDocs.find(d => d.id === e.target.dataset.id);
                if (doc) {
                    currentDoc = JSON.parse(JSON.stringify(doc.data));
                    syncFormValues();
                    renderDocTabs();
                    calculateAndRender();
                    autoSave();
                    modal.classList.remove('active');
                    showToast(`書類「${doc.docNumber}」を読み込みました`, 'success');
                }
            };
        });

        listEl.querySelectorAll('.btn-delete-saved').forEach(btn => {
            btn.onclick = (e) => {
                const docId = e.target.dataset.id;
                cloudDocs = cloudDocs.filter(d => d.id !== docId);
                localStorage.setItem('shorui_cloud_mock_docs', JSON.stringify(cloudDocs));
                openSavedDocsModal(); // Refresh modal
                showToast('書類を削除しました', 'info');
            };
        });
    }

    modal.classList.add('active');
}

// --- Pro Upgrade Modal Logic ---
function openUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    modal.classList.add('active');
}

function initModals() {
    document.querySelectorAll('.modal-close-trigger').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    });

    // Close on overlay background click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Pro Upgrade button in header
    const proBtn = document.getElementById('btn-header-pro');
    if (proBtn) proBtn.addEventListener('click', openUpgradeModal);

    // Stripe Checkout redirect trigger
    const stripePayBtn = document.getElementById('btn-stripe-checkout');
    if (stripePayBtn) {
        stripePayBtn.addEventListener('click', () => {
            // Stripe Payment Links (ユーザー指定の本番/テスト用Stripe Checkout URL)
            const stripeUrl = stripePayBtn.dataset.url || 'https://buy.stripe.com/test_5kQfZg21R0Sd5jA3PSao801';
            window.open(stripeUrl, '_blank');
            showToast('Stripe決済ページへ移動します', 'info');
        });
    }

    // Legal Modals (特定商取引法・利用規約・プライバシーポリシー)
    const tokushoBtn = document.getElementById('btn-footer-tokusho');
    if (tokushoBtn) {
        tokushoBtn.addEventListener('click', () => {
            const m = document.getElementById('modal-tokusho');
            if (m) m.classList.add('active');
        });
    }

    const termsBtn = document.getElementById('btn-footer-terms');
    if (termsBtn) {
        termsBtn.addEventListener('click', () => {
            const m = document.getElementById('modal-terms');
            if (m) m.classList.add('active');
        });
    }

    const privacyBtn = document.getElementById('btn-footer-privacy');
    if (privacyBtn) {
        privacyBtn.addEventListener('click', () => {
            const m = document.getElementById('modal-privacy');
            if (m) m.classList.add('active');
        });
    }

    // Pro Demo Simulation Toggle (テスト用)
    const toggleProBtn = document.getElementById('btn-simulate-pro');
    if (toggleProBtn) {
        toggleProBtn.addEventListener('click', () => {
            const isCurrentlyPro = localStorage.getItem('shorui_is_pro') === 'true';
            localStorage.setItem('shorui_is_pro', (!isCurrentlyPro).toString());
            showToast(`Proプラン状態を ${!isCurrentlyPro ? '有効(Pro)' : '無効(Free)'} に切り替えました`, 'success');
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    }
}

// Reset / New Document
function createNewDoc() {
    if (confirm('現在入力中の内容をクリアして、新しい書類の作成を開始しますか？\n（※クラウドに保存していない変更は破棄されます）')) {
        currentDoc = JSON.parse(JSON.stringify(DEFAULT_STATE));
        currentDoc.docNumber = `EST-${Date.now().toString().slice(-6)}`;
        window.location.hash = '';
        syncFormValues();
        renderDocTabs();
        calculateAndRender();
        autoSave();
        showToast('入力内容をクリアし、新規書類の作成を開始しました', 'info');
    }
}

// --- Utilities ---
function formatCurrency(amount) {
    return '¥' + (amount || 0).toLocaleString('ja-JP');
}

function formatNumber(num) {
    return (num || 0).toLocaleString('ja-JP');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    }
    return dateStr;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    if (type === 'success') {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'warning') {
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    }

    toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- Inline Error Validation (Smooth Recovery Assistance) ---
function setupInlineValidation() {
    const bindValidation = (inputId, errorId, validateFn, errorMessage) => {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        if (!input || !error) return;

        input.addEventListener('blur', () => {
            if (validateFn(input.value)) {
                error.textContent = errorMessage;
                error.style.display = 'block';
                input.style.borderColor = 'var(--color-state-error)';
            } else {
                error.style.display = 'none';
                input.style.borderColor = '';
            }
        });

        input.addEventListener('input', () => {
            if (!validateFn(input.value)) {
                error.style.display = 'none';
                input.style.borderColor = '';
            }
        });
    };

    bindValidation(
        'form-doc-number',
        'error-doc-number',
        val => !val || !val.trim(),
        '書類番号が入力されていません。例: EST-2026-001 のように形式を指定してください。'
    );

    bindValidation(
        'form-client-name',
        'error-client-name',
        val => !val || !val.trim(),
        '取引先名（宛名）が入力されていません。請求先または発注先の企業名・屋号を入力してください。'
    );
}

// --- Theme Management (Soft Modern Slate Ergonomics & Dark Mode Toggle) ---
function initTheme() {
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeLabel = document.getElementById('theme-label');

    const getPreferredTheme = () => {
        const saved = localStorage.getItem('shorui_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        // デフォルトは目に優しいSoft Modern Slate (Light)
        return 'light';
    };

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeIcon) themeIcon.textContent = '☀️';
            if (themeLabel) themeLabel.textContent = 'ライト';
            if (themeToggleBtn) themeToggleBtn.title = 'ライトモードに切り替え（目に優しいソフトスレート）';
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (themeIcon) themeIcon.textContent = '🌙';
            if (themeLabel) themeLabel.textContent = 'ダーク';
            if (themeToggleBtn) themeToggleBtn.title = 'ダークモードに切り替え';
        }
        localStorage.setItem('shorui_theme', theme);
    };

    // 初期テーマ適用
    const currentTheme = getPreferredTheme();
    applyTheme(currentTheme);

    // イベントバインド
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const nextTheme = isDark ? 'light' : 'dark';
            applyTheme(nextTheme);
            showToast(nextTheme === 'dark' ? 'ダークモードに切り替えました' : 'ライトモード（ソフトスレート）に切り替えました', 'info');
        });
    }
}

