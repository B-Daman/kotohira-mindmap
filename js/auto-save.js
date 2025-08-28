// 自動保存機能

export class AutoSave {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.storageKey = 'kotohira-mindmap-autosave';
        this.saveInterval = null;
        this.isEnabled = false;  // デフォルトで無効
        this.hasUnsavedChanges = false;
        
        this.init();
    }

    init() {
        // データ変更リスナーを設定
        this.dataManager.addListener((event, data) => {
            if (event === 'nodeUpdated' || event === 'nodeAdded' || event === 'nodeRemoved') {
                this.hasUnsavedChanges = true;
                this.saveToLocalStorage();
            }
        });

        // ページ離脱時の警告
        this.beforeUnloadHandler = (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        
        // 定期的な自動保存（30秒ごと）
        this.startAutoSave();
        
        // UIインジケーターを追加
        this.addSaveIndicator();
    }

    // ローカルストレージに保存
    saveToLocalStorage() {
        if (!this.isEnabled) return;
        
        try {
            const timestamp = new Date().toISOString();
            
            // データの整合性を確認
            if (!this.dataManager.data || !this.dataManager.data.centerNode) {
                console.error('Invalid data structure for saving');
                this.updateSaveIndicator('error');
                return;
            }
            
            // フラットな構造で保存（階層構造は保存時に再構築される）
            const saveData = {
                version: '1.2',  // バージョンを更新
                timestamp: timestamp,
                dataHash: this.generateDataHash(),  // データのハッシュ値を追加
                data: {
                    centerNode: this.dataManager.data.centerNode,
                    nodes: this.dataManager.data.nodes || []
                }
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(saveData));
            this.updateSaveIndicator('saved');
            this.hasUnsavedChanges = false;
            
            // 最後の保存時刻とハッシュを記録
            localStorage.setItem(this.storageKey + '-lastSave', timestamp);
            localStorage.setItem(this.storageKey + '-lastHash', saveData.dataHash);
            
            // 現在のデータのタイムスタンプを更新
            this.updateCurrentDataTimestamp();
            
        } catch (error) {
            console.error('Auto-save failed:', error);
            this.updateSaveIndicator('error');
            
            // ストレージ容量エラーの場合
            if (error.name === 'QuotaExceededError') {
                this.showMessage('ストレージ容量が不足しています。古いデータを削除してください。', 'error');
            }
        }
    }
    
    // データのハッシュ値を生成（簡易版）
    generateDataHash() {
        const dataString = JSON.stringify({
            centerNode: this.dataManager.data.centerNode,
            nodes: this.dataManager.data.nodes
        });
        
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    // 保存データが存在するかチェック
    hasSavedData() {
        const savedData = localStorage.getItem(this.storageKey);
        return savedData !== null;
    }
    
    // 最新の自動保存データを読み込む
    async loadLatestData() {
        const savedData = localStorage.getItem(this.storageKey);
        if (!savedData) return false;
        
        try {
            const parsed = JSON.parse(savedData);
            const lastSave = new Date(parsed.timestamp);
            const now = new Date();
            const hoursDiff = (now - lastSave) / (1000 * 60 * 60);
            
            // 24時間以内のデータであれば自動的に読み込む
            if (hoursDiff < 24) {
                console.log('Auto-save data structure:', parsed.data);
                
                // データ構造の検証
                if (!parsed.data || !parsed.data.centerNode) {
                    console.error('Invalid auto-save data: missing centerNode');
                    this.clearSavedDataSilently();
                    return false;
                }
                
                const success = this.dataManager.importData(JSON.stringify(parsed.data));
                
                if (success) {
                    // マインドマップを再描画
                    const event = new Event('dataImported');
                    document.dispatchEvent(event);
                    
                    const timeAgo = this.getTimeAgo(lastSave);
                    this.showMessage(`${timeAgo}の自動保存データを読み込みました`, 'info');
                    this.hasUnsavedChanges = false;
                    this.updateCurrentDataTimestamp();
                    return true;
                }
            } else {
                // 24時間以上古いデータの場合、確認を求める
                const timeAgo = this.getTimeAgo(lastSave);
                if (confirm(`${timeAgo}の自動保存データがあります。\n\n古いデータですが、読み込みますか？`)) {
                    return this.restoreFromLocalStorage();
                } else {
                    // 古いデータを削除
                    this.clearSavedDataSilently();
                    this.showMessage('古い自動保存データを削除しました', 'info');
                    return false;
                }
            }
        } catch (error) {
            console.error('Failed to load saved data:', error);
            return false;
        }
    }
    
    // 現在のデータのタイムスタンプを取得
    getCurrentDataTimestamp() {
        return localStorage.getItem(this.storageKey + '-currentTimestamp');
    }
    
    // 現在のデータのタイムスタンプを更新
    updateCurrentDataTimestamp() {
        localStorage.setItem(this.storageKey + '-currentTimestamp', new Date().toISOString());
    }

    // ローカルストレージから復元
    restoreFromLocalStorage() {
        const savedData = localStorage.getItem(this.storageKey);
        if (!savedData) return false;
        
        try {
            const parsed = JSON.parse(savedData);
            
            // データマネージャーにインポート
            const success = this.dataManager.importData(JSON.stringify(parsed.data));
            
            if (success) {
                // マインドマップを再描画
                const event = new Event('dataImported');
                document.dispatchEvent(event);
                
                this.showMessage('自動保存データを復元しました', 'success');
                this.hasUnsavedChanges = false;
                return true;
            }
        } catch (error) {
            console.error('Failed to restore data:', error);
            this.showMessage('データの復元に失敗しました', 'error');
        }
        
        return false;
    }

    // 定期的な自動保存を開始
    startAutoSave() {
        this.saveInterval = setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.saveToLocalStorage();
            }
        }, 30000); // 30秒ごと
    }

    // 自動保存を停止
    stopAutoSave() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    }

    // 自動保存の有効/無効を切り替え
    toggleAutoSave() {
        this.isEnabled = !this.isEnabled;
        
        if (this.isEnabled) {
            this.startAutoSave();
            this.showMessage('自動保存を有効にしました', 'info');
        } else {
            this.stopAutoSave();
            this.showMessage('自動保存を無効にしました', 'info');
        }
        
        this.updateSaveIndicator(this.isEnabled ? 'enabled' : 'disabled');
    }

    // 保存データをクリア
    clearSavedData() {
        if (confirm('自動保存データを削除しますか？この操作は取り消せません。')) {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.storageKey + '-lastSave');
            localStorage.removeItem(this.storageKey + '-lastHash');
            localStorage.removeItem(this.storageKey + '-currentTimestamp');
            this.hasUnsavedChanges = false;
            this.showMessage('自動保存データを削除しました', 'info');
            this.updateSaveIndicator('cleared');
        }
    }
    
    // 確認なしで保存データをクリア（内部使用）
    clearSavedDataSilently() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.storageKey + '-lastSave');
        localStorage.removeItem(this.storageKey + '-lastHash');
        localStorage.removeItem(this.storageKey + '-currentTimestamp');
    }

    // 保存インジケーターを追加
    addSaveIndicator() {
        const controls = document.querySelector('.controls');
        if (!controls) return;
        
        // 保存インジケーター
        const indicator = document.createElement('div');
        indicator.id = 'save-indicator';
        indicator.className = 'save-indicator';
        indicator.innerHTML = `
            <span class="save-status">
                <span class="save-icon">💾</span>
                <span class="save-text">自動保存中...</span>
            </span>
        `;
        
        // 自動保存切り替えボタン
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-autosave';
        toggleBtn.title = '自動保存の有効/無効を切り替え';
        toggleBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
        `;
        toggleBtn.addEventListener('click', () => this.toggleAutoSave());
        
        // 保存データクリアボタン（デバッグ用）
        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-autosave';
        clearBtn.title = '自動保存データを削除';
        clearBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;
        clearBtn.addEventListener('click', () => this.clearSavedData());
        
        controls.appendChild(indicator);
        controls.appendChild(toggleBtn);
        controls.appendChild(clearBtn);
    }

    // 保存インジケーターを更新
    updateSaveIndicator(status) {
        const indicator = document.querySelector('#save-indicator');
        if (!indicator) return;
        
        const icon = indicator.querySelector('.save-icon');
        const text = indicator.querySelector('.save-text');
        
        switch (status) {
            case 'saving':
                icon.textContent = '⏳';
                text.textContent = '保存中...';
                indicator.className = 'save-indicator saving';
                break;
            case 'saved':
                icon.textContent = '✅';
                text.textContent = '保存済み';
                indicator.className = 'save-indicator saved';
                setTimeout(() => {
                    icon.textContent = '💾';
                    text.textContent = '自動保存有効';
                    indicator.className = 'save-indicator';
                }, 2000);
                break;
            case 'error':
                icon.textContent = '❌';
                text.textContent = '保存エラー';
                indicator.className = 'save-indicator error';
                break;
            case 'disabled':
                icon.textContent = '🚫';
                text.textContent = '自動保存無効';
                indicator.className = 'save-indicator disabled';
                break;
            case 'enabled':
                icon.textContent = '💾';
                text.textContent = '自動保存有効';
                indicator.className = 'save-indicator';
                break;
            case 'cleared':
                icon.textContent = '🗑️';
                text.textContent = 'データ削除済み';
                indicator.className = 'save-indicator';
                setTimeout(() => {
                    icon.textContent = '💾';
                    text.textContent = '自動保存有効';
                    indicator.className = 'save-indicator';
                }, 2000);
                break;
        }
    }

    // 時間経過を表示
    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}日前`;
        } else if (hours > 0) {
            return `${hours}時間前`;
        } else if (minutes > 0) {
            return `${minutes}分前`;
        } else {
            return '今';
        }
    }

    // メッセージ表示
    showMessage(message, type = 'info') {
        const event = new CustomEvent('showMessage', { 
            detail: { message, type }
        });
        document.dispatchEvent(event);
    }

    // クリーンアップ
    destroy() {
        this.stopAutoSave();
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
}