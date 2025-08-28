// コンテキストメニュー機能

export class ContextMenu {
    constructor(dataManager, mindmap) {
        this.dataManager = dataManager;
        this.mindmap = mindmap;
        this.menu = null;
        this.currentNode = null;
        this.init();
    }

    init() {
        // コンテキストメニューを作成
        this.menu = document.createElement('div');
        this.menu.id = 'context-menu';
        this.menu.className = 'context-menu hidden';
        document.body.appendChild(this.menu);

        // グローバルクリックイベントでメニューを閉じる
        document.addEventListener('click', () => this.hide());
        
        // メニュー自体のクリックイベントは伝播を停止
        this.menu.addEventListener('click', (e) => e.stopPropagation());
    }

    show(x, y, node) {
        this.currentNode = node;
        this.menu.innerHTML = '';

        // メニュー項目を作成
        const items = this.getMenuItems(node);
        
        items.forEach(item => {
            if (item === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                this.menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-item';
                if (item.disabled) {
                    menuItem.classList.add('disabled');
                }
                
                menuItem.innerHTML = `
                    <span class="menu-icon">${item.icon}</span>
                    <span class="menu-label">${item.label}</span>
                    ${item.shortcut ? `<span class="menu-shortcut">${item.shortcut}</span>` : ''}
                `;
                
                if (!item.disabled) {
                    menuItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        item.action();
                        this.hide();
                    });
                }
                
                this.menu.appendChild(menuItem);
            }
        });

        // 位置を設定
        this.positionMenu(x, y);
        
        // 表示
        this.menu.classList.remove('hidden');
    }

    getMenuItems(node) {
        const items = [];

        // 詳細表示
        items.push({
            icon: '📋',
            label: '詳細を表示',
            action: () => {
                const event = new CustomEvent('nodeRightClick', { 
                    detail: { node }
                });
                document.dispatchEvent(event);
            }
        });

        items.push('separator');

        // 子ノードを追加
        if (node.type !== 'success') {
            items.push({
                icon: '➕',
                label: '子ノードを追加',
                action: () => this.showAddNodeDialog(node)
            });
        }

        // テキスト編集（簡易）
        items.push({
            icon: '✏️',
            label: 'テキストを編集',
            shortcut: 'ダブルクリック',
            action: () => {
                // ダブルクリックイベントをシミュレート
                const event = new MouseEvent('dblclick', {
                    bubbles: true,
                    cancelable: true
                });
                const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
                if (nodeElement) {
                    nodeElement.dispatchEvent(event);
                }
            }
        });

        // 詳細編集
        items.push({
            icon: '⚙️',
            label: 'ノードを編集',
            action: () => this.showEditNodeDialog(node)
        });

        items.push('separator');

        // ノードを削除（ルートノードは削除不可）
        if (node.id !== 'root') {
            items.push({
                icon: '🗑️',
                label: 'ノードを削除',
                action: () => this.confirmDelete(node)
            });
        }

        items.push('separator');

        // 展開/折りたたみ
        if (node.children && node.children.length > 0) {
            const isCollapsed = this.mindmap.collapsedNodes.has(node.id);
            items.push({
                icon: isCollapsed ? '📁' : '📂',
                label: isCollapsed ? '展開する' : '折りたたむ',
                action: () => {
                    if (isCollapsed) {
                        this.mindmap.expandNode(node.id);
                    } else {
                        this.mindmap.collapseNode(node.id);
                    }
                }
            });
        }

        // フォーカス
        items.push({
            icon: '🎯',
            label: 'このノードにフォーカス',
            action: () => this.mindmap.focusNode(node.id)
        });

        // 担当者設定（対策系のノードのみ）
        if (['solution', 'current_effort', 'future_effort', 'success'].includes(node.type)) {
            items.push('separator');
            
            const isMyTask = node.assignee === '自分';
            items.push({
                icon: isMyTask ? '✅' : '👤',
                label: isMyTask ? '自分の担当から外す' : '自分の担当にする',
                action: () => this.toggleAssignee(node)
            });
        }

        return items;
    }

    showAddNodeDialog(parentNode) {
        // ダイアログを作成
        const dialog = document.createElement('div');
        dialog.className = 'add-node-dialog';
        dialog.innerHTML = `
            <div class="dialog-backdrop"></div>
            <div class="dialog-content">
                <h3>新しいノードを追加</h3>
                <form id="add-node-form">
                    <div class="form-group">
                        <label for="node-title">タイトル*</label>
                        <input type="text" id="node-title" required autofocus>
                    </div>
                    <div class="form-group">
                        <label for="node-type">タイプ*</label>
                        <select id="node-type" required>
                            ${this.getNodeTypeOptions(parentNode)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="node-description">説明</label>
                        <textarea id="node-description" rows="3" style="resize: vertical;"></textarea>
                    </div>
                    <div class="form-group">
                        <label style="cursor: pointer; user-select: none;">
                            <span id="urls-toggle" style="margin-right: 4px;">▶</span>
                            関連URL（最大5件）
                        </label>
                        <div id="urls-section" style="display: none; margin-top: 8px;">
                            <div id="urls-container" style="max-height: 300px; overflow-y: auto;">
                                ${this.getUrlFieldsHtml([])}
                            </div>
                            <button type="button" class="btn btn-sm btn-secondary" id="add-url-btn" style="margin-top: 8px;">
                                ➕ URLを追加
                            </button>
                            <small class="form-text">関連するWebページのURLを最大5件まで登録できます</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="node-image">画像URL（オプション）</label>
                        <input type="url" id="node-image" placeholder="https://example.com/image.jpg">
                        <small class="form-text">画像のURLを入力すると、ノードに画像が表示されます</small>
                    </div>
                    <div class="dialog-buttons">
                        <button type="button" class="btn btn-secondary" id="cancel-btn">キャンセル</button>
                        <button type="submit" class="btn btn-primary">追加</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(dialog);

        // イベントリスナー
        const form = dialog.querySelector('#add-node-form');
        const cancelBtn = dialog.querySelector('#cancel-btn');
        const backdrop = dialog.querySelector('.dialog-backdrop');

        // URLフィールドのハンドラーを設定
        this.setupUrlFieldHandlers(dialog);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nodeData = {
                title: form.querySelector('#node-title').value,
                type: form.querySelector('#node-type').value,
                description: form.querySelector('#node-description').value
            };
            
            // URLデータを収集
            const urlData = this.collectUrlData(form);
            if (urlData) {
                nodeData.urls = urlData;
            }
            
            // 画像URLフィールドの値を取得
            const imageValue = form.querySelector('#node-image').value;
            if (imageValue) {
                nodeData.imageUrl = imageValue;
            }
            
            this.addNode(parentNode, nodeData);
            dialog.remove();
        });

        cancelBtn.addEventListener('click', () => dialog.remove());
        backdrop.addEventListener('click', () => dialog.remove());

        // フォーカス
        setTimeout(() => {
            form.querySelector('#node-title').focus();
        }, 100);
    }

    getNodeTypeOptions(parentNode) {
        // 親ノードのタイプに応じて適切な子ノードタイプを提案
        const typeHierarchy = {
            'root': ['major_issue'],
            'major_issue': ['issue'],
            'issue': ['solution'],
            'solution': ['current_effort', 'future_effort'],
            'current_effort': ['success'],
            'future_effort': [],
            'success': []
        };

        const allowedTypes = typeHierarchy[parentNode.type] || [];
        
        // 汎用的に全タイプも選択可能にする
        const allTypes = {
            'major_issue': '主要課題',
            'issue': '課題',
            'solution': '対策',
            'current_effort': '現在の取り組み',
            'future_effort': '将来的な取り組み',
            'success': '成功事例'
        };

        let options = '';
        
        // 推奨タイプ
        if (allowedTypes.length > 0) {
            options += '<optgroup label="推奨">';
            allowedTypes.forEach(type => {
                options += `<option value="${type}">${allTypes[type]}</option>`;
            });
            options += '</optgroup>';
        }

        // その他のタイプ
        options += '<optgroup label="その他">';
        Object.entries(allTypes).forEach(([type, label]) => {
            if (!allowedTypes.includes(type)) {
                options += `<option value="${type}">${label}</option>`;
            }
        });
        options += '</optgroup>';

        return options;
    }

    addNode(parentNode, nodeData) {
        const newNode = {
            title: nodeData.title,
            type: nodeData.type,
            description: nodeData.description,
            children: []
        };
        
        // URLsがある場合は追加
        if (nodeData.urls) {
            newNode.urls = nodeData.urls;
        }
        
        // 画像URLがある場合は追加
        if (nodeData.imageUrl) {
            newNode.imageUrl = nodeData.imageUrl;
        }

        // データマネージャーで追加
        const addedNode = this.dataManager.addNode(parentNode.id, newNode);
        
        if (addedNode) {
            // マインドマップを再描画
            this.mindmap.render(this.dataManager.data);
            
            // 新しいノードにフォーカス
            setTimeout(() => {
                this.mindmap.focusNode(addedNode.id);
            }, 300);
            
            // 成功メッセージ
            this.showMessage('ノードを追加しました', 'success');
        }
    }

    confirmDelete(node) {
        console.log('confirmDelete called for node:', node.id, node.title);
        
        const hasChildren = node.children && node.children.length > 0;
        const message = hasChildren 
            ? `「${node.title}」とその子ノードをすべて削除しますか？`
            : `「${node.title}」を削除しますか？`;

        if (confirm(message)) {
            console.log('User confirmed deletion');
            const success = this.dataManager.removeNode(node.id);
            
            if (success) {
                console.log('Node deleted successfully');
                // マインドマップを再描画
                this.mindmap.render(this.dataManager.data);
                
                // 成功メッセージ
                this.showMessage('ノードを削除しました', 'info');
            } else {
                console.log('Failed to delete node');
            }
        } else {
            console.log('User cancelled deletion');
        }
    }

    positionMenu(x, y) {
        const rect = this.menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 右側に表示（画面外にはみ出す場合は左側）
        let left = x;
        if (left + rect.width > viewportWidth) {
            left = x - rect.width;
        }
        
        // 下側に表示（画面外にはみ出す場合は上側）
        let top = y;
        if (top + rect.height > viewportHeight) {
            top = y - rect.height;
        }
        
        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
    }

    hide() {
        this.menu.classList.add('hidden');
        this.currentNode = null;
    }

    showEditNodeDialog(node) {
        // 編集ダイアログを作成
        const dialog = document.createElement('div');
        dialog.className = 'add-node-dialog';
        dialog.innerHTML = `
            <div class="dialog-backdrop"></div>
            <div class="dialog-content">
                <h3>ノードを編集</h3>
                <form id="edit-node-form">
                    <div class="form-group">
                        <label for="node-title">タイトル*</label>
                        <input type="text" id="node-title" value="${this.escapeHtml(node.title)}" required autofocus>
                    </div>
                    <div class="form-group">
                        <label for="node-type">タイプ*</label>
                        <select id="node-type" required>
                            ${this.getAllNodeTypeOptions(node.type)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="node-description">説明</label>
                        <textarea id="node-description" rows="3" style="resize: vertical;">${this.escapeHtml(node.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label style="cursor: pointer; user-select: none;">
                            <span id="urls-toggle" style="margin-right: 4px;">▼</span>
                            関連URL（最大5件）
                        </label>
                        <div id="urls-section" style="margin-top: 8px;">
                            <div id="urls-container" style="max-height: 300px; overflow-y: auto;">
                                ${this.getUrlFieldsHtml(node.urls)}
                            </div>
                            <button type="button" class="btn btn-sm btn-secondary" id="add-url-btn" style="margin-top: 8px;">
                                ➕ URLを追加
                            </button>
                            <small class="form-text">関連するWebページのURLを最大5件まで登録できます</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="node-image">画像URL（オプション）</label>
                        <input type="url" id="node-image" value="${this.escapeHtml(node.imageUrl || '')}" placeholder="https://example.com/image.jpg">
                        <small class="form-text">画像のURLを入力すると、ノードに画像が表示されます</small>
                    </div>
                    ${this.getStatusFieldHtml(node)}
                    ${this.getAssigneeFieldHtml(node)}
                    <div class="dialog-buttons">
                        <button type="button" class="btn btn-secondary" id="cancel-btn">キャンセル</button>
                        <button type="submit" class="btn btn-primary">更新</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(dialog);

        // イベントリスナー
        const form = dialog.querySelector('#edit-node-form');
        const cancelBtn = dialog.querySelector('#cancel-btn');
        const backdrop = dialog.querySelector('.dialog-backdrop');

        // URLフィールドのハンドラーを設定
        this.setupUrlFieldHandlers(dialog);
        
        // 担当者選択の変更を監視（対策系ノードの場合のみ）
        const assigneeSelect = form.querySelector('#node-assignee');
        const assigneeStatusGroup = form.querySelector('#assignee-status-group');
        if (assigneeSelect && assigneeStatusGroup) {
            assigneeSelect.addEventListener('change', (e) => {
                assigneeStatusGroup.style.display = e.target.value === '自分' ? 'block' : 'none';
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const updates = {
                title: form.querySelector('#node-title').value,
                type: form.querySelector('#node-type').value,
                description: form.querySelector('#node-description').value
            };
            
            // URLデータを収集
            const urlData = this.collectUrlData(form);
            if (urlData) {
                updates.urls = urlData;
            } else {
                updates.urls = undefined; // 空の場合は削除
            }
            
            // 画像URLフィールドの値を取得
            const imageValue = form.querySelector('#node-image').value;
            if (imageValue) {
                updates.imageUrl = imageValue;
            } else {
                updates.imageUrl = undefined; // 空の場合は削除
            }
            
            // ステータスフィールドが存在する場合のみ値を取得
            const statusField = form.querySelector('#node-status');
            if (statusField) {
                updates.status = statusField.value || undefined;
            }
            
            // 担当者フィールドが存在する場合のみ値を取得
            const assigneeField = form.querySelector('#node-assignee');
            if (assigneeField) {
                updates.assignee = assigneeField.value || undefined;
            }
            
            this.updateNode(node, updates);
            dialog.remove();
        });

        cancelBtn.addEventListener('click', () => dialog.remove());
        backdrop.addEventListener('click', () => dialog.remove());

        // フォーカス
        setTimeout(() => {
            form.querySelector('#node-title').focus();
            form.querySelector('#node-title').select();
        }, 100);
    }

    getAllNodeTypeOptions(currentType) {
        const allTypes = {
            'major_issue': '主要課題',
            'issue': '課題',
            'solution': '対策',
            'current_effort': '現在の取り組み',
            'future_effort': '将来的な取り組み',
            'success': '成功事例'
        };

        let options = '';
        Object.entries(allTypes).forEach(([type, label]) => {
            const selected = type === currentType ? 'selected' : '';
            options += `<option value="${type}" ${selected}>${label}</option>`;
        });

        return options;
    }

    updateNode(node, updates) {
        // タイトルとタイプは必須
        if (!updates.title || !updates.type) {
            this.showMessage('タイトルとタイプは必須です', 'error');
            return;
        }

        // データマネージャーで更新
        const success = this.dataManager.updateNode(node.id, updates);
        
        if (success) {
            // マインドマップを再描画
            this.mindmap.render(this.dataManager.data);
            
            // 成功メッセージ
            this.showMessage('ノードを更新しました', 'success');
        } else {
            this.showMessage('ノードの更新に失敗しました', 'error');
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    toggleAssignee(node) {
        const updates = {};
        
        if (node.assignee === '自分') {
            // 担当から外す
            updates.assignee = undefined;
            updates.status = undefined;
            this.showMessage('担当から外しました', 'info');
        } else {
            // 自分の担当にする
            updates.assignee = '自分';
            updates.status = 'planned'; // デフォルトは「計画中」
            this.showMessage('自分の担当に設定しました', 'success');
        }
        
        // データマネージャーで更新
        const success = this.dataManager.updateNode(node.id, updates);
        
        if (success) {
            // マインドマップを再描画
            this.mindmap.render(this.dataManager.data);
        }
    }

    getStatusFieldHtml(node) {
        // 主要課題と課題の場合のみステータスフィールドを表示
        if (['major_issue', 'issue'].includes(node.type)) {
            return `
                <div class="form-group">
                    <label for="node-status">ステータス</label>
                    <select id="node-status">
                        <option value="">なし</option>
                        <option value="critical" ${node.status === 'critical' ? 'selected' : ''}>重要</option>
                        <option value="active" ${node.status === 'active' ? 'selected' : ''}>対応中</option>
                        <option value="resolved" ${node.status === 'resolved' ? 'selected' : ''}>解決済み</option>
                    </select>
                </div>
            `;
        }
        return '';
    }

    getAssigneeFieldHtml(node) {
        // 対策系のノードの場合のみ担当者フィールドを表示
        if (['solution', 'current_effort', 'future_effort', 'success'].includes(node.type)) {
            return `
                <div class="form-group">
                    <label for="node-assignee">担当者</label>
                    <select id="node-assignee">
                        <option value="">未設定</option>
                        <option value="自分" ${node.assignee === '自分' ? 'selected' : ''}>自分</option>
                    </select>
                </div>
                <div class="form-group" id="assignee-status-group" style="display: ${node.assignee === '自分' ? 'block' : 'none'}">
                    <label for="node-status">進捗状況</label>
                    <select id="node-status">
                        <option value="planned" ${node.status === 'planned' ? 'selected' : ''}>計画中</option>
                        <option value="active" ${node.status === 'active' ? 'selected' : ''}>実施中</option>
                        <option value="completed" ${node.status === 'completed' ? 'selected' : ''}>完了</option>
                    </select>
                </div>
            `;
        }
        return '';
    }

    showMessage(message, type = 'info') {
        const event = new CustomEvent('showMessage', { 
            detail: { message, type }
        });
        document.dispatchEvent(event);
    }

    // 複数URLフィールドのHTMLを生成
    getUrlFieldsHtml(urls) {
        let html = '';
        const urlList = urls || [];
        
        // 最低1つのフィールドは表示
        const fieldsToShow = Math.max(1, urlList.length);
        
        for (let i = 0; i < fieldsToShow && i < 5; i++) {
            const url = urlList[i] || {};
            html += this.createUrlFieldHtml(i, url);
        }
        
        return html;
    }

    // 個別のURLフィールドHTML生成
    createUrlFieldHtml(index, urlData = {}) {
        return `
            <div class="url-field-group" data-index="${index}" style="margin-bottom: 8px; padding: 8px; background-color: #f8f9fa; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <strong style="font-size: 0.9rem;">URL ${index + 1}</strong>
                    ${index > 0 ? `<button type="button" class="btn btn-sm btn-danger remove-url-btn" data-index="${index}" style="padding: 2px 6px; font-size: 11px;">✕</button>` : ''}
                </div>
                <div style="margin-bottom: 6px;">
                    <input type="text" class="url-label" placeholder="リンクの表示名" value="${this.escapeHtml(urlData.label || '')}" style="width: 100%; padding: 4px 8px; font-size: 13px;">
                </div>
                <div style="margin-bottom: 6px;">
                    <input type="url" class="url-value" placeholder="https://example.com" value="${this.escapeHtml(urlData.url || '')}" style="width: 100%; padding: 4px 8px; font-size: 13px;">
                </div>
                <div>
                    <input type="text" class="url-description" placeholder="リンクの説明（省略可）" value="${this.escapeHtml(urlData.description || '')}" style="width: 100%; padding: 4px 8px; font-size: 13px;">
                </div>
            </div>
        `;
    }

    // URL追加・削除のイベントハンドラーを設定
    setupUrlFieldHandlers(dialog) {
        const container = dialog.querySelector('#urls-container');
        const addBtn = dialog.querySelector('#add-url-btn');
        const toggleIcon = dialog.querySelector('#urls-toggle');
        const urlsSection = dialog.querySelector('#urls-section');
        const label = toggleIcon.parentElement;
        
        // 折りたたみトグル
        label.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const isOpen = urlsSection.style.display !== 'none';
                urlsSection.style.display = isOpen ? 'none' : 'block';
                toggleIcon.textContent = isOpen ? '▶' : '▼';
            }
        });
        
        // URL追加ボタン
        addBtn.addEventListener('click', () => {
            const currentFields = container.querySelectorAll('.url-field-group').length;
            if (currentFields < 5) {
                const newFieldHtml = this.createUrlFieldHtml(currentFields);
                container.insertAdjacentHTML('beforeend', newFieldHtml);
                this.attachRemoveHandler(container);
                
                // 5件に達したら追加ボタンを無効化
                if (currentFields + 1 >= 5) {
                    addBtn.disabled = true;
                    addBtn.textContent = '最大5件まで';
                }
            }
        });
        
        // 削除ボタンのハンドラー
        this.attachRemoveHandler(container);
    }

    // 削除ボタンのハンドラーをアタッチ
    attachRemoveHandler(container) {
        container.querySelectorAll('.remove-url-btn').forEach(btn => {
            btn.removeEventListener('click', this.handleRemoveUrl);
            btn.addEventListener('click', this.handleRemoveUrl.bind(this));
        });
    }

    // URL削除処理
    handleRemoveUrl(e) {
        const fieldGroup = e.target.closest('.url-field-group');
        fieldGroup.remove();
        
        // インデックスを再割り当て
        const container = document.querySelector('#urls-container');
        container.querySelectorAll('.url-field-group').forEach((group, index) => {
            group.dataset.index = index;
            group.querySelector('strong').textContent = `URL ${index + 1}`;
            const removeBtn = group.querySelector('.remove-url-btn');
            if (removeBtn) {
                removeBtn.dataset.index = index;
            }
        });
        
        // 追加ボタンを有効化
        const addBtn = document.querySelector('#add-url-btn');
        if (addBtn && container.querySelectorAll('.url-field-group').length < 5) {
            addBtn.disabled = false;
            addBtn.textContent = '➕ URLを追加';
        }
    }

    // URLデータを収集
    collectUrlData(form) {
        const urls = [];
        form.querySelectorAll('.url-field-group').forEach(group => {
            const label = group.querySelector('.url-label').value.trim();
            const url = group.querySelector('.url-value').value.trim();
            const description = group.querySelector('.url-description').value.trim();
            
            if (url) { // URLが入力されている場合のみ追加
                urls.push({
                    label: label || 'リンク',
                    url: url,
                    description: description || undefined
                });
            }
        });
        
        return urls.length > 0 ? urls : undefined;
    }
}