// メインアプリケーション

import { MindMap } from './mindmap.js';
import { DataManager } from './data.js';
import { UIController } from './ui.js';
import { Utils } from './utils.js';
import { UrlPreview } from './url-preview.js';
import { ContextMenu } from './context-menu.js';
import { DataPersistence } from './data-persistence.js';
import { AutoSave } from './auto-save.js';
import { MINDMAP_CONFIGS, getActiveConfig } from './config.js';

class App {
    constructor() {
        this.dataManager = new DataManager();
        this.mindmap = null;
        this.uiController = null;
        this.urlPreview = null;
        this.contextMenu = null;
        this.dataPersistence = null;
        this.autoSave = null;
        
        // 設定ファイルから現在のマインドマップ設定を取得
        const activeConfig = getActiveConfig();
        this.config = {
            dataUrl: activeConfig.dataUrl,
            title: activeConfig.title,
            storageKey: activeConfig.storageKey
        };
    }

    // アプリケーション初期化
    async init() {
        try {
            console.log('Starting application initialization...');
            
            // ローディング表示
            this.showInitialLoading();

            // データマネージャーのリスナー設定
            console.log('Setting up data listeners...');
            this.setupDataListeners();

            // データ読み込み
            console.log('Loading data...');
            await this.loadData();

            // データが正しく読み込まれたか確認
            if (!this.dataManager.data) {
                throw new Error('データが読み込まれませんでした');
            }

            // マインドマップ初期化
            console.log('Initializing mindmap...');
            this.initMindMap();

            // UIコントローラー初期化
            console.log('Initializing UI controller...');
            this.initUIController();

            // カスタムイベントリスナー設定
            console.log('Setting up custom event listeners...');
            this.setupCustomEventListeners();

            // URLパラメータ処理
            console.log('Handling URL parameters...');
            this.handleUrlParams();

            // ローディング非表示
            this.hideInitialLoading();

            // タイトルを更新
            this.updatePageTitle();
            
            // 初期メッセージ
            this.showWelcomeMessage();
            
            console.log('Application initialization completed successfully');

        } catch (error) {
            console.error('Application initialization error:', error);
            console.error('Error stack:', error.stack);
            this.showErrorMessage(`アプリケーションの初期化に失敗しました。\n\nエラー: ${error.message}`);
        }
    }

    // データ読み込み
    async loadData() {
        try {
            console.log('Initializing AutoSave...');
            // 自動保存機能を初期化（デフォルトで無効）
            this.autoSave = new AutoSave(this.dataManager);
            this.autoSave.isEnabled = false;  // 自動保存を無効化
            // マインドマップごとに異なるストレージキーを使用
            if (this.config.storageKey) {
                this.autoSave.storageKey = this.config.storageKey;
            }
            
            // 自動保存は無効なので、チェックをスキップ
            console.log('Auto-save is disabled, skipping saved data check');
            
            console.log('Loading initial data from server...');
            // 自動保存データがない場合、またはロードに失敗した場合は初期データを読み込む
            try {
                await this.dataManager.loadData(this.config.dataUrl);
                console.log('Successfully loaded initial data from server');
            } catch (error) {
                // フォールバックデータを使用
                console.warn('Failed to load data from server, using fallback data:', error);
                const fallbackData = this.getFallbackData();
                this.dataManager.importData(JSON.stringify(fallbackData));
                console.log('Loaded fallback data');
            }
        } catch (error) {
            console.error('Error in loadData:', error);
            throw error;
        }
    }

    // マインドマップ初期化
    initMindMap() {
        this.mindmap = new MindMap('mindmap-svg', this.dataManager);
        this.mindmap.render(this.dataManager.data);
    }

    // UIコントローラー初期化
    initUIController() {
        this.uiController = new UIController(this.mindmap, this.dataManager);
        
        // URLプレビュー初期化
        this.urlPreview = new UrlPreview();
        this.urlPreview.attachToUrlLinks();
        
        // コンテキストメニュー初期化
        this.contextMenu = new ContextMenu(this.dataManager, this.mindmap);
        
        // データ永続化機能初期化
        this.dataPersistence = new DataPersistence(this.dataManager);
        
        // 自動保存機能は loadData() で初期化済み
    }

    // データリスナー設定
    setupDataListeners() {
        this.dataManager.addListener((event, data) => {
            switch (event) {
                case 'dataLoaded':
                    console.log('Data loaded successfully');
                    break;
                case 'nodeUpdated':
                    this.handleNodeUpdate(data);
                    break;
                case 'nodeAdded':
                    this.handleNodeAdd(data);
                    break;
                case 'nodeRemoved':
                    this.handleNodeRemove(data);
                    break;
                case 'error':
                    this.handleDataError(data);
                    break;
            }
        });
    }

    // カスタムイベントリスナー設定
    setupCustomEventListeners() {
        // コンテキストメニュー表示イベント
        document.addEventListener('showContextMenu', (event) => {
            const { node, x, y } = event.detail;
            this.contextMenu.show(x, y, node);
        });

        // ノード右クリックイベント（詳細表示用）
        document.addEventListener('nodeRightClick', (event) => {
            const { node, x, y } = event.detail;
            this.uiController.showInfoPanel(node);
        });

        // ノードホバーイベント
        document.addEventListener('nodeHover', (event) => {
            const { node, x, y } = event.detail;
            this.uiController.showTooltip(x + 10, y - 10, node.title);
        });

        // ノードリーブイベント
        document.addEventListener('nodeLeave', () => {
            this.uiController.hideTooltip();
        });

        // メッセージ表示イベント
        document.addEventListener('showMessage', (event) => {
            const { message, type } = event.detail;
            this.uiController.showMessage(message, type);
        });

        // データインポートイベント
        document.addEventListener('dataImported', () => {
            this.mindmap.render(this.dataManager.data);
        });
    }

    // URLパラメータ処理
    handleUrlParams() {
        const params = Utils.getUrlParams();
        
        // フォーカスノード
        if (params.focus) {
            setTimeout(() => {
                this.mindmap.focusNode(params.focus);
            }, 500);
        }

        // 検索キーワード
        if (params.search) {
            this.uiController.searchInput.value = params.search;
            this.uiController.handleSearch();
        }

        // フィルター
        if (params.filter) {
            this.uiController.filterSelect.value = params.filter;
            this.uiController.handleFilter();
        }
    }

    // ノード更新処理
    handleNodeUpdate(data) {
        // マインドマップを再レンダリング
        this.mindmap.render(this.dataManager.data);
    }

    // ノード追加処理
    handleNodeAdd(data) {
        // マインドマップを再レンダリング
        this.mindmap.render(this.dataManager.data);
        // 新しいノードにフォーカス
        this.mindmap.focusNode(data.node.id);
    }

    // ノード削除処理
    handleNodeRemove(data) {
        // マインドマップを再レンダリング
        this.mindmap.render(this.dataManager.data);
    }

    // データエラー処理
    handleDataError(error) {
        console.error('Data error:', error);
        this.showErrorMessage('データ処理エラーが発生しました。');
    }

    // 初期ローディング表示
    showInitialLoading() {
        const loading = document.createElement('div');
        loading.id = 'initial-loading';
        loading.className = 'loading';
        loading.innerHTML = `
            <div class="spinner"></div>
            <p>琴平町地域活性化マインドマップを読み込んでいます...</p>
        `;
        document.body.appendChild(loading);
    }

    // 初期ローディング非表示
    hideInitialLoading() {
        const loading = document.getElementById('initial-loading');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => loading.remove(), 300);
        }
    }

    // タイトルを更新
    updatePageTitle() {
        // データファイルのタイトルを優先、なければconfig.jsのタイトルを使用
        const title = this.dataManager.data?.centerNode?.title || this.config.title;
        if (title) {
            document.title = title;
            const h1 = document.querySelector('header h1');
            if (h1) {
                h1.textContent = title;
            }
        }
    }

    // ウェルカムメッセージ表示
    showWelcomeMessage() {
        this.uiController.showMessage('マインドマップへようこそ！ノードをクリックして詳細を確認できます。', 'info');
    }

    // エラーメッセージ表示
    showErrorMessage(message) {
        if (this.uiController) {
            this.uiController.showMessage(message, 'error');
        } else {
            alert(message);
        }
    }

    // フォールバックデータ
    getFallbackData() {
        return {
            centerNode: {
                id: "root",
                title: "琴平町 消滅可能性自治体からの脱却",
                type: "root",
                description: "香川県琴平町の地域活性化に向けた総合的な取り組み"
            },
            nodes: [
                {
                    id: "population_decline",
                    title: "人口減少問題",
                    type: "major_issue",
                    description: "20-39歳女性50%減少等の深刻な人口問題",
                    status: "critical",
                    children: [
                        {
                            id: "female_population",
                            title: "20-39歳女性人口50%減少",
                            type: "issue",
                            data: {
                                currentStatus: "消滅可能性自治体指定",
                                evidence: "現況調査 第3期 琴平町 まち・ひと・しごと創生総合戦略（令和7年3月）"
                            }
                        }
                    ]
                },
                {
                    id: "tourism_issue",
                    title: "観光リピーター不足",
                    type: "major_issue",
                    description: "一度きりの観光地からの脱却が課題",
                    children: [
                        {
                            id: "konpira_once",
                            title: "一生に一度はこんぴらさん問題",
                            type: "issue",
                            description: "リピート率の低さが課題"
                        }
                    ]
                }
            ]
        };
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    
    // グローバルに公開（デバッグ用）
    window.app = app;
});

// エクスポート
export { App };