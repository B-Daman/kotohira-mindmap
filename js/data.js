// データ管理モジュール

export class DataManager {
    constructor() {
        this.data = null;
        this.nodeMap = new Map();
        this.listeners = [];
    }

    // データ読み込み
    async loadData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawData = await response.json();
            this.data = this.processData(rawData);
            this.buildNodeMap();
            this.notifyListeners('dataLoaded', this.data);
            return this.data;
        } catch (error) {
            console.error('Error loading data:', error);
            this.notifyListeners('error', error);
            throw error;
        }
    }

    // データ処理
    processData(rawData) {
        // データ構造の検証
        if (!rawData || !rawData.centerNode) {
            console.error('Invalid data structure: missing centerNode');
            throw new Error('無効なデータ構造です');
        }

        const processed = {
            centerNode: rawData.centerNode,
            nodes: [],
            links: []
        };

        // nodesが配列として存在する場合はフラット化
        if (rawData.nodes && Array.isArray(rawData.nodes)) {
            processed.nodes = this.flattenNodes(rawData.nodes);
        }

        // リンクの生成
        processed.nodes.forEach(node => {
            if (node.parentId) {
                processed.links.push({
                    source: node.parentId,
                    target: node.id,
                    type: node.type
                });
            }
        });

        return processed;
    }

    // ノードのフラット化
    flattenNodes(nodes, parentId = 'root', result = []) {
        if (!nodes || !Array.isArray(nodes)) return result;
        
        nodes.forEach(node => {
            // 必須フィールドのチェック
            if (!node || !node.id || !node.title || !node.type) {
                console.warn('Invalid node data, skipping:', node);
                return;
            }
            
            // 参考資料ノードはスキップ
            if (node.type === 'reference') {
                return;
            }

            const flatNode = {
                ...node,
                parentId: parentId,
                children: node.children ? node.children.filter(c => c.type !== 'reference').map(c => c.id) : []
            };

            result.push(flatNode);

            // 子ノードを再帰的に処理（新しい階層構造に対応）
            if (node.children && Array.isArray(node.children)) {
                this.flattenNodes(node.children, node.id, result);
            }
        });

        return result;
    }

    // ノードマップの構築
    buildNodeMap() {
        this.nodeMap.clear();
        if (this.data) {
            // センターノードを追加
            this.nodeMap.set(this.data.centerNode.id, this.data.centerNode);
            
            // その他のノードを追加
            this.data.nodes.forEach(node => {
                this.nodeMap.set(node.id, node);
            });
        }
    }

    // ノード取得
    getNode(nodeId) {
        return this.nodeMap.get(nodeId);
    }

    // 子ノード取得
    getChildren(nodeId) {
        const node = this.getNode(nodeId);
        if (!node || !node.children) return [];
        
        return node.children.map(childId => this.getNode(childId)).filter(Boolean);
    }

    // 親ノード取得
    getParent(nodeId) {
        const node = this.getNode(nodeId);
        if (!node || !node.parentId) return null;
        
        return this.getNode(node.parentId);
    }

    // 祖先ノード取得
    getAncestors(nodeId) {
        const ancestors = [];
        let current = this.getParent(nodeId);
        
        while (current) {
            ancestors.push(current);
            current = this.getParent(current.id);
        }
        
        return ancestors;
    }

    // 子孫ノード取得
    getDescendants(nodeId) {
        const descendants = [];
        const queue = [...this.getChildren(nodeId)];
        
        while (queue.length > 0) {
            const node = queue.shift();
            descendants.push(node);
            queue.push(...this.getChildren(node.id));
        }
        
        return descendants;
    }

    // ノード検索
    searchNodes(keyword) {
        if (!keyword) return [];
        
        const lowerKeyword = keyword.toLowerCase();
        const results = [];
        
        this.nodeMap.forEach(node => {
            if (node.title.toLowerCase().includes(lowerKeyword) ||
                (node.description && node.description.toLowerCase().includes(lowerKeyword))) {
                results.push(node);
            }
        });
        
        return results;
    }

    // タイプによるフィルタリング
    filterByType(type) {
        if (!type) return Array.from(this.nodeMap.values());
        
        const results = [];
        this.nodeMap.forEach(node => {
            if (node.type === type) {
                results.push(node);
            }
        });
        
        return results;
    }

    // ステータスによるフィルタリング
    filterByStatus(status) {
        const results = [];
        this.nodeMap.forEach(node => {
            if (node.status === status) {
                results.push(node);
            }
        });
        
        return results;
    }

    // データ更新
    updateNode(nodeId, updates) {
        const node = this.getNode(nodeId);
        if (!node) return false;
        
        Object.assign(node, updates);
        this.notifyListeners('nodeUpdated', { nodeId, updates });
        return true;
    }

    // ノード追加
    addNode(parentId, newNode) {
        const parent = this.getNode(parentId);
        if (!parent) return false;
        
        newNode.id = newNode.id || this.generateNodeId();
        newNode.parentId = parentId;
        newNode.children = newNode.children || [];
        
        this.data.nodes.push(newNode);
        this.nodeMap.set(newNode.id, newNode);
        
        if (!parent.children) {
            parent.children = [];
        }
        parent.children.push(newNode.id);
        
        this.data.links.push({
            source: parentId,
            target: newNode.id,
            type: newNode.type
        });
        
        this.notifyListeners('nodeAdded', { parentId, node: newNode });
        return newNode;
    }

    // ノード削除
    removeNode(nodeId) {
        const node = this.getNode(nodeId);
        if (!node || nodeId === 'root') return false;
        
        console.log(`Removing node: ${nodeId} (${node.title})`);
        
        // 子孫ノードも削除
        const descendants = this.getDescendants(nodeId);
        const nodesToRemove = [node, ...descendants];
        console.log(`Total nodes to remove: ${nodesToRemove.length}`);
        
        nodesToRemove.forEach(n => {
            // ノードマップから削除
            this.nodeMap.delete(n.id);
            
            // 親の子リストから削除
            const parent = this.getNode(n.parentId);
            if (parent && parent.children) {
                parent.children = parent.children.filter(childId => childId !== n.id);
            }
            
            // ノードリストから削除
            this.data.nodes = this.data.nodes.filter(node => node.id !== n.id);
            
            // リンクから削除（sourceとtargetの両方をチェック）
            this.data.links = this.data.links.filter(link => {
                // オブジェクト形式の場合はidを取得
                const sourceId = typeof link.source === 'string' ? link.source : (link.source ? link.source.id : null);
                const targetId = typeof link.target === 'string' ? link.target : (link.target ? link.target.id : null);
                
                return sourceId !== n.id && targetId !== n.id;
            });
        });
        
        console.log(`Nodes remaining after deletion: ${this.data.nodes.length}`);
        console.log('Current data structure:', {
            centerNode: this.data.centerNode,
            nodesCount: this.data.nodes.length,
            linksCount: this.data.links.length
        });
        
        this.notifyListeners('nodeRemoved', { nodeId, removedNodes: nodesToRemove });
        return true;
    }

    // ノードID生成
    generateNodeId() {
        return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // リスナー登録
    addListener(callback) {
        this.listeners.push(callback);
    }

    // リスナー削除
    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    // リスナー通知
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Error in listener:', error);
            }
        });
    }

    // データエクスポート
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    // データインポート
    importData(jsonString) {
        try {
            const rawData = JSON.parse(jsonString);
            this.data = this.processData(rawData);
            this.buildNodeMap();
            this.notifyListeners('dataImported', this.data);
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            this.notifyListeners('error', error);
            return false;
        }
    }
}