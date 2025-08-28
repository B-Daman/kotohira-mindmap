// UI制御モジュール

import { Utils } from './utils.js';

export class UIController {
    constructor(mindmap, dataManager) {
        this.mindmap = mindmap;
        this.dataManager = dataManager;
        this.infoPanel = document.getElementById('info-panel');
        this.tooltip = document.getElementById('tooltip');
        this.searchInput = document.getElementById('search-input');
        this.filterSelect = document.getElementById('filter-select');
        
        this.setupEventListeners();
    }

    // イベントリスナー設定
    setupEventListeners() {
        // 検索機能
        const searchBtn = document.getElementById('search-btn');
        searchBtn.addEventListener('click', () => this.handleSearch());
        
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch();
            }
        });

        // デバウンス検索
        this.searchInput.addEventListener('input', 
            Utils.debounce(() => this.handleSearch(), 300)
        );

        // フィルター機能
        this.filterSelect.addEventListener('change', () => this.handleFilter());

        // コントロールボタン
        document.getElementById('reset-zoom').addEventListener('click', () => {
            this.mindmap.resetZoom();
        });

        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            Utils.fullscreen.toggle(document.getElementById('mindmap-container'));
        });

        // 情報パネルの閉じるボタン
        document.getElementById('close-panel').addEventListener('click', () => {
            this.hideInfoPanel();
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // ウィンドウリサイズ
        window.addEventListener('resize', 
            Utils.throttle(() => this.mindmap.handleResize(), 100)
        );
    }

    // 検索処理
    handleSearch() {
        const keyword = this.searchInput.value.trim();
        if (!keyword) {
            this.mindmap.clearHighlight();
            return;
        }

        const results = this.dataManager.searchNodes(keyword);
        this.mindmap.highlightNodes(results.map(n => n.id));
        
        if (results.length > 0) {
            this.showSearchResults(results);
            // 最初の結果にフォーカス
            this.mindmap.focusNode(results[0].id);
        } else {
            this.showMessage('検索結果が見つかりませんでした', 'warning');
        }
    }

    // フィルター処理
    handleFilter() {
        const filterType = this.filterSelect.value;
        if (!filterType) {
            this.mindmap.showAllNodes();
        } else {
            const filtered = this.dataManager.filterByType(filterType);
            this.mindmap.filterNodes(filtered.map(n => n.id));
        }
    }

    // キーボードショートカット
    handleKeyboard(e) {
        // Ctrl/Cmd + F: 検索フォーカス
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.searchInput.focus();
        }

        // Escape: 検索クリア、パネル閉じる
        if (e.key === 'Escape') {
            if (this.searchInput.value) {
                this.searchInput.value = '';
                this.handleSearch();
            }
            this.hideInfoPanel();
        }

        // Ctrl/Cmd + 0: ズームリセット
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            this.mindmap.resetZoom();
        }
    }

    // 情報パネル表示
    showInfoPanel(nodeData) {
        // パネル内容更新
        document.getElementById('panel-title').textContent = nodeData.title;
        document.getElementById('panel-type').textContent = this.getTypeLabel(nodeData.type);
        // アンダースコアをハイフンに変換
        const typeClass = nodeData.type.replace(/_/g, '-');
        document.getElementById('panel-type').className = `node-type ${typeClass}`;
        
        const description = document.getElementById('panel-description');
        description.textContent = nodeData.description || '説明がありません';

        // 画像セクション
        this.updateImageSection(nodeData);

        // データセクション
        this.updateDataSection(nodeData);

        // URLセクション（拡張版）
        this.updateUrlsSection(nodeData);

        // パネル表示
        this.infoPanel.classList.remove('hidden');
    }

    // 画像セクション更新
    updateImageSection(nodeData) {
        const container = document.getElementById('panel-image');
        if (!container) {
            // 画像コンテナが存在しない場合は作成
            const panelContent = document.getElementById('panel-content');
            const imageDiv = document.createElement('div');
            imageDiv.id = 'panel-image';
            // panel-descriptionの後に挿入
            const description = document.getElementById('panel-description');
            description.parentNode.insertBefore(imageDiv, description.nextSibling);
        }
        
        const imageContainer = document.getElementById('panel-image');
        imageContainer.innerHTML = '';
        
        // 新しい imageUrl フィールドをサポート
        if (nodeData.imageUrl || (nodeData.image && nodeData.image.url)) {
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'image-wrapper';
            
            const img = document.createElement('img');
            img.src = nodeData.imageUrl || nodeData.image.url;
            img.alt = nodeData.title;
            img.className = 'panel-image';
            
            // クリックで新しいタブで開く
            img.addEventListener('click', () => {
                window.open(img.src, '_blank');
            });
            
            if (nodeData.image && nodeData.image.caption) {
                const caption = document.createElement('p');
                caption.className = 'image-caption';
                caption.textContent = nodeData.image.caption;
                imageWrapper.appendChild(img);
                imageWrapper.appendChild(caption);
            } else {
                imageWrapper.appendChild(img);
            }
            
            imageContainer.appendChild(imageWrapper);
        }
    }

    // データセクション更新
    updateDataSection(nodeData) {
        const dataContainer = document.getElementById('panel-data');
        dataContainer.innerHTML = '';

        if (nodeData.data) {
            const card = this.createCard('詳細データ', () => {
                const list = document.createElement('ul');
                list.className = 'list-group';

                Object.entries(nodeData.data).forEach(([key, value]) => {
                    if (key !== 'url') {
                        const item = document.createElement('li');
                        item.className = 'list-item';
                        item.innerHTML = `<strong>${this.formatDataKey(key)}:</strong> ${value}`;
                        list.appendChild(item);
                    }
                });

                return list;
            });
            dataContainer.appendChild(card);
        }
    }


    // URLセクション更新（拡張版）
    updateUrlsSection(nodeData) {
        const container = document.getElementById('panel-links');
        container.innerHTML = '';

        const urls = [];
        
        // 単一のURLフィールド（後方互換性）
        if (nodeData.url) {
            urls.push({ label: '詳細情報', url: nodeData.url });
        }
        
        // URLリスト（新機能）
        if (nodeData.urls && Array.isArray(nodeData.urls)) {
            nodeData.urls.forEach(urlItem => {
                if (typeof urlItem === 'string') {
                    urls.push({ label: 'リンク', url: urlItem });
                } else if (urlItem.url) {
                    urls.push({ 
                        label: urlItem.label || urlItem.title || 'リンク', 
                        url: urlItem.url,
                        description: urlItem.description
                    });
                }
            });
        }
        
        // dataオブジェクト内のURL（後方互換性）
        if (nodeData.data && nodeData.data.url) {
            urls.push({ label: '参考資料', url: nodeData.data.url });
        }
        
        // 参考資料ノードのURL（既存データ用）
        if (nodeData.references && Array.isArray(nodeData.references)) {
            nodeData.references.forEach(ref => {
                if (ref.url) {
                    urls.push({
                        label: ref.title || '参考資料',
                        url: ref.url,
                        description: ref.description
                    });
                }
            });
        }

        if (urls.length > 0) {
            const card = this.createCard(`関連リンク (${urls.length}件)`, () => {
                const list = document.createElement('ul');
                list.className = 'list-group';

                urls.forEach(({ label, url, description }, index) => {
                    const item = document.createElement('li');
                    item.className = 'list-item';
                    
                    let content = `<div class="url-item">`;
                    content += `<span class="url-number">${index + 1}.</span> `;
                    content += `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
                    if (description) {
                        content += `<div class="url-description">${description}</div>`;
                    }
                    content += `</div>`;
                    
                    item.innerHTML = content;
                    list.appendChild(item);
                });

                return list;
            });
            container.appendChild(card);
        }
    }

    // カード作成
    createCard(title, contentBuilder) {
        const card = document.createElement('div');
        card.className = 'card';

        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `<h3 class="card-title">${title}</h3>`;
        card.appendChild(header);

        const body = document.createElement('div');
        body.className = 'card-body';
        body.appendChild(contentBuilder());
        card.appendChild(body);

        return card;
    }

    // 情報パネル非表示
    hideInfoPanel() {
        this.infoPanel.classList.add('hidden');
    }

    // ツールチップ表示
    showTooltip(x, y, content) {
        this.tooltip.textContent = content;
        this.tooltip.style.left = x + 'px';
        this.tooltip.style.top = y + 'px';
        this.tooltip.classList.remove('hidden');
    }

    // ツールチップ非表示
    hideTooltip() {
        this.tooltip.classList.add('hidden');
    }

    // 検索結果表示
    showSearchResults(results) {
        const message = `${results.length}件の検索結果が見つかりました`;
        this.showMessage(message, 'info');
    }

    // メッセージ表示
    showMessage(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fade-in`;
        alert.textContent = message;

        const container = document.querySelector('main');
        container.appendChild(alert);

        setTimeout(() => {
            alert.remove();
        }, 3000);
    }

    // ヘルパー関数
    getTypeLabel(type) {
        const labels = {
            'root': '中心テーマ',
            'major_issue': '主要課題',
            'issue': '課題',
            'solution': '対策',
            'current_effort': '現在の取り組み',
            'future_effort': '将来的な取り組み',
            'success': '成功事例'
        };
        return labels[type] || type;
    }

    getStatusLabel(status) {
        const labels = {
            'critical': '重要',
            'active': '実施中',
            'planned': '計画中',
            'completed': '完了'
        };
        return labels[status] || status;
    }

    getStatusClass(status) {
        const classes = {
            'critical': 'critical',
            'active': 'info',
            'planned': 'warning',
            'completed': 'success'
        };
        return classes[status] || 'info';
    }

    formatDataKey(key) {
        const labels = {
            'currentStatus': '現在の状況',
            'evidence': '根拠資料',
            'targetValue': '目標値',
            'deadline': '期限'
        };
        return labels[key] || key;
    }

    // ローディング表示
    showLoading() {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.innerHTML = '<div class="spinner"></div><p>データを読み込んでいます...</p>';
        document.getElementById('mindmap-container').appendChild(loading);
    }

    hideLoading() {
        const loading = document.querySelector('.loading');
        if (loading) loading.remove();
    }
}