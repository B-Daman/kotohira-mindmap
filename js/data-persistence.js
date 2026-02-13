// データ永続化機能

export class DataPersistence {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.init();
    }

    init() {
        // エクスポート/インポートボタンを追加
        this.addPersistenceControls();
    }

    addPersistenceControls() {
        const controls = document.querySelector('.controls');
        if (!controls) return;

        // エクスポートボタン
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-btn';
        exportBtn.title = 'データをエクスポート';
        exportBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        exportBtn.addEventListener('click', () => this.exportData());

        // インポートボタン
        const importBtn = document.createElement('button');
        importBtn.id = 'import-btn';
        importBtn.title = 'データをインポート';
        importBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        `;
        importBtn.addEventListener('click', () => this.importData());

        controls.appendChild(exportBtn);
        controls.appendChild(importBtn);

        // 隠しファイル入力を追加
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.id = 'import-file-input';
        fileInput.addEventListener('change', (e) => this.handleFileImport(e));
        document.body.appendChild(fileInput);
    }

    exportData() {
        try {
            // 現在のデータを取得（シンプルな形式）
            const exportData = {
                centerNode: this.dataManager.data.centerNode,
                nodes: this.reconstructHierarchy()
            };

            // JSON文字列に変換
            const jsonString = JSON.stringify(exportData, null, 2);

            // ダウンロード用のBlob作成
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // ダウンロードリンクを作成
            const a = document.createElement('a');
            a.href = url;
            a.download = `kotohira-mindmap-${this.getDateString()}.json`;
            a.click();

            // メモリクリーンアップ
            URL.revokeObjectURL(url);

            this.showMessage('データをエクスポートしました', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showMessage('エクスポートに失敗しました', 'error');
        }
    }

    reconstructHierarchy() {
        // データの整合性チェック
        if (!this.dataManager.data || !this.dataManager.data.nodes) {
            console.error('No nodes data available for hierarchy reconstruction');
            return [];
        }

        const nodes = this.dataManager.data.nodes;

        // ネスト構造（children がオブジェクト配列）かどうかを判定
        const isNestedStructure = nodes.length > 0 &&
            nodes[0].children !== undefined &&
            Array.isArray(nodes[0].children) &&
            nodes[0].children.length > 0 &&
            typeof nodes[0].children[0] === 'object' &&
            nodes[0].children[0] !== null &&
            nodes[0].children[0].id !== undefined;

        if (isNestedStructure) {
            // 既にネスト構造の場合はそのまま返す
            return nodes;
        }

        // フラット構造の場合は親子関係を再構築
        const nodeMap = new Map();
        const rootChildren = [];

        // すべてのノードをマップに追加
        nodes.forEach(node => {
            nodeMap.set(node.id, {
                ...node,
                children: []
            });
        });

        // 親子関係を再構築
        nodes.forEach(node => {
            if (node.parentId === 'root') {
                const nodeData = nodeMap.get(node.id);
                if (nodeData) {
                    rootChildren.push(nodeData);
                }
            } else if (node.parentId && nodeMap.has(node.parentId)) {
                const parent = nodeMap.get(node.parentId);
                const child = nodeMap.get(node.id);
                if (parent && child) {
                    parent.children.push(child);
                }
            }
        });

        return rootChildren;
    }

    importData() {
        // ファイル選択ダイアログを開く
        document.getElementById('import-file-input').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // データの検証
                if (!this.validateImportData(importedData)) {
                    throw new Error('無効なデータ形式です');
                }

                // 確認ダイアログ
                if (confirm('現在のデータは上書きされます。インポートを続行しますか？')) {
                    // データをインポート（エクスポート形式と通常形式の両方に対応）
                    let processedData;
                    if (importedData.mindmapData) {
                        // 旧エクスポート形式
                        processedData = {
                            centerNode: importedData.mindmapData.centerNode,
                            nodes: importedData.mindmapData.nodes
                        };
                    } else {
                        // 新しいシンプルな形式
                        processedData = {
                            centerNode: importedData.centerNode,
                            nodes: importedData.nodes
                        };
                    }

                    const success = this.dataManager.importData(JSON.stringify(processedData));
                    
                    if (success) {
                        // マインドマップを再描画
                        const mindmapEvent = new Event('dataImported');
                        document.dispatchEvent(mindmapEvent);
                        
                        this.showMessage('データをインポートしました', 'success');
                    } else {
                        throw new Error('インポートに失敗しました');
                    }
                }
            } catch (error) {
                console.error('Import error:', error);
                this.showMessage('インポートに失敗しました: ' + error.message, 'error');
            }
        };

        reader.readAsText(file);
        
        // ファイル入力をリセット
        event.target.value = '';
    }

    validateImportData(data) {
        // 基本的な構造チェック
        if (!data || typeof data !== 'object') return false;
        
        // 新しいシンプルな形式をチェック
        if (data.centerNode && data.nodes) {
            return data.centerNode.id && data.centerNode.title;
        }
        
        // 旧エクスポート形式をチェック（後方互換性のため）
        if (data.mindmapData) {
            return data.mindmapData.centerNode && 
                   data.mindmapData.nodes && 
                   data.mindmapData.centerNode.id && 
                   data.mindmapData.centerNode.title;
        }
        
        return false;
    }

    getDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    showMessage(message, type = 'info') {
        const event = new CustomEvent('showMessage', { 
            detail: { message, type }
        });
        document.dispatchEvent(event);
    }
}