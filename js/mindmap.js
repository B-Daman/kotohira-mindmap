// マインドマップ描画モジュール

import { Utils } from './utils.js';

export class MindMap {
    constructor(containerId, dataManager) {
        this.containerId = containerId;
        this.dataManager = dataManager;
        this.container = d3.select(`#${containerId}`);
        
        // 設定
        this.config = {
            nodeWidth: {
                root: 250,
                major_issue: 200,
                issue: 180,
                solution: 160,
                success: 160,
                reference: 140,
                current_effort: 160,
                future_effort: 160,
                category: 200,
                subcategory: 180,
                stats: 180,
                future: 180,
                mission: 200
            },
            nodeHeight: {
                root: 60,
                major_issue: 50,
                issue: 45,
                solution: 40,
                success: 40,
                reference: 35,
                current_effort: 40,
                future_effort: 40,
                category: 50,
                subcategory: 45,
                stats: 45,
                future: 45,
                mission: 50
            },
            levelDistance: 320,  // 横方向の階層間隔を増やす
            siblingDistance: 60,  // 縦方向の兄弟間隔を減らす
            transitionDuration: 750
        };
        
        // 状態管理
        this.collapsedNodes = new Set();
        this.highlightedNodes = new Set();
        this.filteredNodes = null;
        
        // D3要素
        this.svg = null;
        this.g = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        
        this.initialize();
    }

    // 初期化
    initialize() {
        // SVGセットアップ
        const rect = this.container.node().getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        this.svg = this.container.append('svg')
            .attr('width', this.width)
            .attr('height', this.height);
        
        // デフォルト定義（矢印など）
        this.setupDefs();
        
        // メイングループ
        this.g = this.svg.append('g');
        
        // ズーム設定
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
                this.updateMinimap();
            });
        
        this.svg.call(this.zoom);
        
        // フォースシミュレーション設定
        this.setupSimulation();
        
        // ミニマップ設定
        this.setupMinimap();
    }

    // 定義設定
    setupDefs() {
        const defs = this.svg.append('defs');
        
        // 矢印マーカー
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 10)
            .attr('markerHeight', 10)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10,0 L 0,5')
            .attr('fill', '#999')
            .style('stroke', 'none');
    }

    // シミュレーション設定
    setupSimulation() {
        // 階層レイアウトを使用するため、シミュレーションは簡略化
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).strength(0))
            .force('charge', d3.forceManyBody().strength(0))
            .alphaTarget(0)
            .on('tick', this.ticked.bind(this));
    }

    // データレンダリング
    render(data) {
        if (!data) return;
        
        // データ準備
        this.prepareData(data);
        
        // リンク描画
        this.renderLinks();
        
        // ノード描画
        this.renderNodes();
        
        // シミュレーション更新
        this.updateSimulation();
        
        // 初期ズーム調整
        setTimeout(() => this.fitToScreen(), 100);
    }

    // データ準備
    prepareData(data) {
        // 階層構造の構築
        const hierarchy = this.buildHierarchy(data);

        // ツリーレイアウトの作成
        const treeLayout = d3.tree()
            .nodeSize([this.config.siblingDistance, this.config.levelDistance])
            .separation((a, b) => {
                // 同じ親を持つ兄弟ノード間の間隔のみを調整
                if (a.parent !== b.parent) {
                    return 1.5;
                }

                // ノードの高さに基づいて動的に間隔を調整
                const aHeight = this.config.nodeHeight[a.data.type] || 40;
                const bHeight = this.config.nodeHeight[b.data.type] || 40;
                let baseSpacing = Math.max(aHeight, bHeight) / 40;

                // 折りたたまれたノード（子を持たない）の場合は間隔を最小化
                const aHasNoVisibleChildren = !a.children || a.children.length === 0;
                const bHasNoVisibleChildren = !b.children || b.children.length === 0;

                if (aHasNoVisibleChildren && bHasNoVisibleChildren) {
                    // 両方とも子がない場合は最小間隔
                    baseSpacing *= 0.5;
                }

                return baseSpacing;
            });

        // レイアウト計算
        const root = d3.hierarchy(hierarchy);
        treeLayout(root);

        // 階層ノードを保存
        this.root = root;

        // ノードデータ準備（座標を90度回転して左から右へ）
        this.nodes = [];

        // 最小・最大のY座標を見つける
        let minY = Infinity;
        let maxY = -Infinity;
        root.descendants().forEach(d => {
            minY = Math.min(minY, d.x);
            maxY = Math.max(maxY, d.x);
        });

        // 全体の高さを計算し、中央に配置するためのオフセット
        const totalHeight = maxY - minY;
        const yOffset = (this.height - totalHeight) / 2 - minY;

        root.descendants().forEach(d => {
            // 座標を設定
            d.x_transformed = d.y + 100;  // yとxを入れ替えて左から右へ
            d.y_transformed = d.x + yOffset;  // 画面中央に配置

            const node = {
                ...d.data,
                x: d.x_transformed,
                y: d.y_transformed,
                depth: d.depth
            };
            this.nodes.push(node);
        });
        
        // リンクデータ準備
        this.links = [];
        if (data.links && Array.isArray(data.links)) {
            this.links = data.links
                .filter(link => link && link.source && link.target)  // 無効なリンクを除外
                .map(link => {
                    try {
                        return {
                            ...link,
                            source: typeof link.source === 'string' ? link.source : link.source.id,
                            target: typeof link.target === 'string' ? link.target : link.target.id
                        };
                    } catch (e) {
                        console.warn('Invalid link data:', link, e);
                        return null;
                    }
                })
                .filter(link => link !== null);  // nullを除外
        } else {
            // linksが存在しない場合は、親子関係から生成
            this.nodes.forEach(node => {
                if (node.parentId) {
                    this.links.push({
                        source: node.parentId,
                        target: node.id,
                        type: node.type
                    });
                }
            });
        }
    }
    
    // 階層構造の構築
    buildHierarchy(data) {
        console.log('buildHierarchy input:', {
            hasCenterNode: !!data.centerNode,
            hasNodes: !!data.nodes,
            nodesLength: data.nodes ? data.nodes.length : 0,
            firstNodeHasChildren: data.nodes && data.nodes[0] ? data.nodes[0].children !== undefined : false
        });

        // データが既にネストされた構造（children プロパティあり）の場合
        if (data.nodes && data.nodes.length > 0 && data.nodes[0].children !== undefined) {
            // 既にネストされた構造なので、centerNode に nodes を children として追加
            const hierarchy = {
                ...data.centerNode,
                children: data.nodes
            };
            console.log('Returning nested hierarchy:', {
                id: hierarchy.id,
                title: hierarchy.title,
                childrenCount: hierarchy.children.length,
                firstChildId: hierarchy.children[0].id,
                firstChildHasType: !!hierarchy.children[0].type,
                firstChildType: hierarchy.children[0].type,
                fullFirstChild: hierarchy.children[0]
            });
            return hierarchy;
        }

        // parentId ベースの構造の場合（後方互換性のため残す）
        const nodeMap = new Map();

        // センターノードを追加
        const root = { ...data.centerNode, children: [] };
        nodeMap.set(root.id, root);

        // すべてのノードをマップに追加
        data.nodes.forEach(node => {
            nodeMap.set(node.id, { ...node, children: [] });
        });

        // 親子関係を構築
        data.nodes.forEach(node => {
            if (node.parentId && nodeMap.has(node.parentId)) {
                const parent = nodeMap.get(node.parentId);
                const child = nodeMap.get(node.id);
                if (parent && child) {
                    parent.children.push(child);
                }
            }
        });

        return root;
    }

    // リンク描画
    renderLinks() {
        // リンクグループ
        if (!this.linkGroup) {
            this.linkGroup = this.g.append('g').attr('class', 'links');
        }

        // 階層から直接リンクを生成
        const links = this.root.links();

        // データバインディング
        const link = this.linkGroup.selectAll('.link')
            .data(links, d => `${d.source.data.id}-${d.target.data.id}`);
        
        // Enter
        const linkEnter = link.enter()
            .append('path')
            .attr('class', d => `link link-${d.target.data.type}`)
            .attr('marker-end', 'url(#arrowhead)');
        
        // Update + Enter
        this.linkSelection = linkEnter.merge(link);
        
        // Exit
        link.exit().remove();
    }

    // ノード描画
    renderNodes() {
        // ノードグループ
        if (!this.nodeGroup) {
            this.nodeGroup = this.g.append('g').attr('class', 'nodes');
        }

        // データバインディング（階層データを使用）
        const node = this.nodeGroup.selectAll('.node')
            .data(this.root.descendants(), d => d.data.id);
        
        // Enter
        const nodeEnter = node.enter()
            .append('g')
            .attr('class', d => {
                // typeが存在しない場合のフォールバック
                if (!d.data.type) {
                    console.error('Node missing type:', d.data.id, 'Full node:', d.data);
                    return 'node unknown';
                }
                // アンダースコアをハイフンに変換
                const typeClass = d.data.type.replace(/_/g, '-');
                return `node ${typeClass} ${this.collapsedNodes.has(d.data.id) ? 'collapsed' : ''}`;
            });
        
        // 矩形追加
        nodeEnter.append('rect')
            .attr('width', d => this.config.nodeWidth[d.data.type || 'default'] || 160)
            .attr('height', d => this.config.nodeHeight[d.data.type || 'default'] || 40)
            .attr('x', d => -(this.config.nodeWidth[d.data.type || 'default'] || 160) / 2)
            .attr('y', d => -(this.config.nodeHeight[d.data.type || 'default'] || 40) / 2)
            .attr('data-node-id', d => d.data.id);
        
        // テキスト追加（複数行対応）
        const self = this;
        nodeEnter.each(function(d) {
            const group = d3.select(this);
            
            // 担当者アイコンを追加（対策系ノードのみ）
            if (d.data.assignee === '自分' && d.data.status && ['solution', 'current_effort', 'future_effort', 'success'].includes(d.data.type)) {
                const iconGroup = group.append('g')
                    .attr('class', 'assignee-icon')
                    .attr('transform', `translate(${(self.config.nodeWidth[d.data.type] || 160) / 2 - 10}, ${-(self.config.nodeHeight[d.data.type] || 40) / 2 - 10})`);

                // 背景円
                iconGroup.append('circle')
                    .attr('r', 10)
                    .attr('fill', d.data.status === 'active' ? '#FFD700' :
                                 d.data.status === 'planned' ? '#87CEEB' : '#90EE90');

                // アイコンテキスト
                iconGroup.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .attr('font-size', '12px')
                    .text(d.data.status === 'active' ? '🌟' :
                          d.data.status === 'planned' ? '📅' : '✅');
            }
            
            const text = group.append('text')
                .attr('dy', '0em');

            const title = d.data.title || 'Untitled';
            const nodeType = d.data.type || 'default';
            const lineHeight = 1.2;
            const maxWidth = (self.config.nodeWidth[nodeType] || 160) - 20;
            const fontSize = nodeType === 'root' ? 16 : nodeType === 'major_issue' ? 15 : 14;
            const charWidth = fontSize * 0.8; // 日本語文字の概算幅
            const maxCharsPerLine = Math.floor(maxWidth / charWidth);

            // テキストを適切な位置で分割
            const lines = [];
            if (title && title.length <= maxCharsPerLine) {
                lines.push(title);
            } else {
                // 最初の行
                lines.push(title.substring(0, maxCharsPerLine));
                // 2行目
                const remaining = title.substring(maxCharsPerLine);
                if (remaining.length <= maxCharsPerLine) {
                    lines.push(remaining);
                } else {
                    lines.push(remaining.substring(0, maxCharsPerLine - 1) + '...');
                }
            }
            
            // 行を描画
            lines.forEach((line, i) => {
                text.append('tspan')
                    .attr('x', 0)
                    .attr('dy', i === 0 ? '-0.3em' : `${lineHeight}em`)
                    .text(line);
            });
        });
        
        // クリックイベント
        nodeEnter.on('click', (event, d) => this.handleNodeClick(event, d));
        nodeEnter.on('contextmenu', (event, d) => this.handleNodeRightClick(event, d));
        nodeEnter.on('dblclick', (event, d) => this.handleNodeDoubleClick(event, d));
        nodeEnter.on('mouseenter', (event, d) => this.handleNodeHover(event, d));
        nodeEnter.on('mouseleave', () => this.handleNodeLeave());
        
        // Update + Enter
        this.nodeSelection = nodeEnter.merge(node);
        
        // クラス更新
        this.nodeSelection
            .attr('class', d => {
                // typeが存在しない場合のフォールバック
                if (!d.data || !d.data.type) {
                    console.error('Node missing data or type in update:', d);
                    return 'node unknown';
                }
                // アンダースコアをハイフンに変換
                const typeClass = d.data.type.replace(/_/g, '-');
                const classes = [`node`, typeClass];
                if (this.collapsedNodes.has(d.data.id)) classes.push('collapsed');
                if (this.highlightedNodes.has(d.data.id)) classes.push('highlighted');

                // 担当者クラスを追加（対策系ノードのみ）
                if (d.data.assignee === '自分' && d.data.status && ['solution', 'current_effort', 'future_effort', 'success'].includes(d.data.type)) {
                    classes.push(`my-${d.data.status}`);
                }

                return classes.join(' ');
            })
            .attr('transform', d => `translate(${d.x_transformed},${d.y_transformed})`);
        
        // Exit
        node.exit()
            .transition()
            .duration(this.config.transitionDuration)
            .attr('transform', 'scale(0)')
            .remove();
    }

    // シミュレーション更新
    updateSimulation() {
        // ノードとリンクを設定
        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);
        
        // 階層レイアウトのため、シミュレーションは最小限に
        this.simulation.alpha(0.3).restart();
    }

    // ティック処理
    ticked() {
        // リンク更新（左から右への直線）
        if (this.linkSelection) {
            this.linkSelection.attr('d', d => {
                const source = d.source;
                const target = d.target;

                // 矩形の端から線を引く
                const sourceX = source.x_transformed + (this.config.nodeWidth[source.data.type] || 160) / 2;
                const targetX = target.x_transformed - (this.config.nodeWidth[target.data.type] || 160) / 2;

                // ベジェ曲線で滑らかな接続
                const midX = (sourceX + targetX) / 2;
                return `M${sourceX},${source.y_transformed} C${midX},${source.y_transformed} ${midX},${target.y_transformed} ${targetX},${target.y_transformed}`;
            });
        }

        // ノード更新（既に transform で位置を設定しているので不要）
        // if (this.nodeSelection) {
        //     this.nodeSelection.attr('transform', d => `translate(${d.x_transformed},${d.y_transformed})`);
        // }
    }

    // ノードクリック処理
    handleNodeClick(event, node) {
        event.stopPropagation();

        // 子ノードがあるか、折りたたまれた子ノードがあるかチェック
        const hasChildren = (node.children && node.children.length > 0) ||
                           (node._children && node._children.length > 0);

        if (hasChildren) {
            if (this.collapsedNodes.has(node.data.id)) {
                this.expandNode(node.data.id);
            } else {
                this.collapseNode(node.data.id);
            }
        }
    }

    // ノード右クリック処理
    handleNodeRightClick(event, node) {
        event.preventDefault();
        event.stopPropagation();
        
        // コンテキストメニューを表示
        const menuEvent = new CustomEvent('showContextMenu', { 
            detail: { node, x: event.pageX, y: event.pageY }
        });
        document.dispatchEvent(menuEvent);
    }

    // ノードホバー処理
    handleNodeHover(event, node) {
        const uiEvent = new CustomEvent('nodeHover', { 
            detail: { node, x: event.pageX, y: event.pageY }
        });
        document.dispatchEvent(uiEvent);
    }

    // ノードリーブ処理
    handleNodeLeave() {
        const uiEvent = new CustomEvent('nodeLeave');
        document.dispatchEvent(uiEvent);
    }

    // ノード展開
    expandNode(nodeId) {
        this.collapsedNodes.delete(nodeId);

        // 階層ノードを見つけて展開
        const node = this.findHierarchyNode(this.root, nodeId);
        if (node && node._children) {
            node.children = node._children;
            node._children = null;
        }

        this.updateLayout();
    }

    // ノード折りたたみ
    collapseNode(nodeId) {
        this.collapsedNodes.add(nodeId);

        // 階層ノードを見つけて折りたたみ
        const node = this.findHierarchyNode(this.root, nodeId);
        if (node && node.children) {
            node._children = node.children;
            node.children = null;
        }

        this.updateLayout();
    }

    // 階層ノードを検索
    findHierarchyNode(root, nodeId) {
        if (root.data.id === nodeId) return root;

        if (root.children) {
            for (const child of root.children) {
                const found = this.findHierarchyNode(child, nodeId);
                if (found) return found;
            }
        }

        if (root._children) {
            for (const child of root._children) {
                const found = this.findHierarchyNode(child, nodeId);
                if (found) return found;
            }
        }

        return null;
    }

    // レイアウト更新（折りたたみ/展開時）
    updateLayout() {
        // ツリーレイアウトを再計算
        const treeLayout = d3.tree()
            .nodeSize([this.config.siblingDistance, this.config.levelDistance])
            .separation((a, b) => {
                // 同じ親を持つ兄弟ノード間の間隔のみを調整
                if (a.parent !== b.parent) {
                    return 1.5;
                }

                // ノードの高さに基づいて動的に間隔を調整
                const aHeight = this.config.nodeHeight[a.data.type] || 40;
                const bHeight = this.config.nodeHeight[b.data.type] || 40;
                let baseSpacing = Math.max(aHeight, bHeight) / 40;

                // 折りたたまれたノード（子を持たない）の場合は間隔を最小化
                const aHasNoVisibleChildren = !a.children || a.children.length === 0;
                const bHasNoVisibleChildren = !b.children || b.children.length === 0;

                if (aHasNoVisibleChildren && bHasNoVisibleChildren) {
                    // 両方とも子がない場合は最小間隔
                    baseSpacing *= 0.5;
                }

                return baseSpacing;
            });

        // レイアウト計算
        treeLayout(this.root);

        // 座標を更新
        let minY = Infinity;
        let maxY = -Infinity;
        this.root.descendants().forEach(d => {
            minY = Math.min(minY, d.x);
            maxY = Math.max(maxY, d.x);
        });

        const totalHeight = maxY - minY;
        const yOffset = (this.height - totalHeight) / 2 - minY;

        this.root.descendants().forEach(d => {
            d.x_transformed = d.y + 100;
            d.y_transformed = d.x + yOffset;
        });

        // ノードとリンクを再描画
        this.renderNodes();
        this.renderLinks();

        // シミュレーションを更新
        this.updateSimulation();
    }

    // 可視性更新
    updateVisibility() {
        // 非表示ノードの収集
        const hiddenNodes = new Set();
        this.collapsedNodes.forEach(nodeId => {
            const descendants = this.dataManager.getDescendants(nodeId);
            descendants.forEach(d => hiddenNodes.add(d.id));
        });
        
        // フィルタリングされたノードも考慮
        if (this.filteredNodes) {
            this.nodes.forEach(node => {
                if (!this.filteredNodes.includes(node.id)) {
                    hiddenNodes.add(node.id);
                }
            });
        }
        
        // ノードの表示/非表示
        this.nodeSelection
            .style('opacity', d => hiddenNodes.has(d.data.id) ? 0 : 1)
            .style('pointer-events', d => hiddenNodes.has(d.data.id) ? 'none' : 'all');

        // リンクの表示/非表示
        this.linkSelection
            .style('opacity', d =>
                hiddenNodes.has(d.source.data.id) || hiddenNodes.has(d.target.data.id) ? 0 : 0.6
            );

        // クラス更新
        this.nodeSelection
            .classed('collapsed', d => this.collapsedNodes.has(d.data.id));
    }

    // ノードハイライト
    highlightNodes(nodeIds) {
        this.highlightedNodes = new Set(nodeIds);
        this.nodeSelection
            .classed('highlighted', d => this.highlightedNodes.has(d.data.id));
    }

    // ハイライトクリア
    clearHighlight() {
        this.highlightedNodes.clear();
        this.nodeSelection.classed('highlighted', false);
    }

    // ノードフィルタリング
    filterNodes(nodeIds) {
        this.filteredNodes = nodeIds;
        this.updateVisibility();
    }

    // 全ノード表示
    showAllNodes() {
        this.filteredNodes = null;
        this.updateVisibility();
    }

    // ノードにフォーカス
    focusNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // ノードまでの経路を展開
        const ancestors = this.dataManager.getAncestors(nodeId);
        ancestors.forEach(ancestor => {
            this.collapsedNodes.delete(ancestor.id);
        });
        this.updateVisibility();
        
        // ノードにズーム
        const transform = d3.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .scale(1.5)
            .translate(-node.x, -node.y);
        
        this.svg.transition()
            .duration(this.config.transitionDuration)
            .call(this.zoom.transform, transform);
    }

    // 画面にフィット
    fitToScreen() {
        const bounds = this.g.node().getBBox();
        const fullWidth = this.width;
        const fullHeight = this.height;
        const width = bounds.width;
        const height = bounds.height;
        const midX = bounds.x + width / 2;
        const midY = bounds.y + height / 2;
        
        // 6階層の場合の横幅を考慮してスケールを調整
        const padding = 50;
        const scaleX = (fullWidth - padding * 2) / width;
        const scaleY = (fullHeight - padding * 2) / height;
        const scale = Math.min(scaleX, scaleY, 1); // 最大倍率は1に制限
        
        const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
        
        this.svg.transition()
            .duration(this.config.transitionDuration)
            .call(this.zoom.transform, d3.zoomIdentity
                .translate(translate[0], translate[1])
                .scale(scale));
    }

    // ズームリセット
    resetZoom() {
        this.fitToScreen();
    }

    // ノードダブルクリック処理（編集モード）
    handleNodeDoubleClick(event, node) {
        event.stopPropagation();
        event.preventDefault();
        
        const self = this;
        const currentTarget = event.currentTarget;
        
        // 編集可能なtextareaを作成
        const nodeWidth = this.config.nodeWidth[node.type] || 160;
        const nodeHeight = this.config.nodeHeight[node.type] || 40;
        const foreignObject = d3.select(currentTarget)
            .append('foreignObject')
            .attr('x', -nodeWidth / 2)
            .attr('y', -nodeHeight / 2)
            .attr('width', nodeWidth)
            .attr('height', Math.max(nodeHeight * 2, 80)); // 高さを増やして複数行対応
        
        const textarea = foreignObject.append('xhtml:textarea')
            .attr('class', 'node-edit-textarea')
            .style('width', '100%')
            .style('height', '100%')
            .style('font-size', node.type === 'root' ? '16px' : node.type === 'major_issue' ? '15px' : '14px')
            .style('text-align', 'center')
            .style('border', '2px solid #4285f4')
            .style('background', 'rgba(255,255,255,0.98)')
            .style('padding', '8px')
            .style('box-sizing', 'border-box')
            .style('resize', 'none')
            .style('font-family', 'inherit')
            .style('line-height', '1.4')
            .style('border-radius', '4px')
            .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
            .property('value', node.title);
        
        // 矩形を非表示
        d3.select(currentTarget).select('rect').style('opacity', 0.3);
        // テキストを非表示
        d3.select(currentTarget).select('text').style('opacity', 0);
        
        // フォーカスと全選択
        textarea.node().focus();
        textarea.node().select();
        
        // テキストエリアの高さを内容に合わせて調整
        const adjustHeight = () => {
            const ta = textarea.node();
            ta.style.height = 'auto';
            const newHeight = Math.max(ta.scrollHeight, nodeHeight * 2);
            ta.style.height = newHeight + 'px';
            foreignObject.attr('height', newHeight);
        };
        
        textarea.on('input', adjustHeight);
        setTimeout(adjustHeight, 0);
        
        // 編集完了処理
        const finishEdit = () => {
            const newTitle = textarea.property('value').trim();
            if (newTitle && newTitle !== node.title) {
                // データを更新
                this.dataManager.updateNode(node.id, { title: newTitle });
                node.title = newTitle;
            }
            
            // テキストを再描画（変更の有無に関わらず）
            const textElement = d3.select(currentTarget).select('text');
            textElement.selectAll('tspan').remove();
            self.updateNodeText(d3.select(currentTarget), node);
            
            // 編集UIを削除
            foreignObject.remove();
            d3.select(currentTarget).select('rect').style('opacity', 1);
            textElement.style('opacity', 1);
        };
        
        // イベントリスナー
        textarea.on('blur', finishEdit);
        textarea.on('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                finishEdit();
            } else if (e.key === 'Escape') {
                // キャンセル時もテキストを再描画
                const textElement = d3.select(currentTarget).select('text');
                textElement.selectAll('tspan').remove();
                self.updateNodeText(d3.select(currentTarget), node);
                
                foreignObject.remove();
                d3.select(currentTarget).select('rect').style('opacity', 1);
                textElement.style('opacity', 1);
            }
        });
    }
    
    // ノードのテキストを更新
    updateNodeText(nodeSelection, node) {
        const text = nodeSelection.select('text');
        text.selectAll('tspan').remove();
        
        const title = node.title;
        const lineHeight = 1.2;
        const maxWidth = (this.config.nodeWidth[node.type] || 160) - 20;
        const fontSize = node.type === 'root' ? 16 : node.type === 'major_issue' ? 15 : 14;
        const charWidth = fontSize * 0.8;
        const maxCharsPerLine = Math.floor(maxWidth / charWidth);
        
        // テキストを適切な位置で分割
        const lines = [];
        if (title.length <= maxCharsPerLine) {
            lines.push(title);
        } else {
            lines.push(title.substring(0, maxCharsPerLine));
            const remaining = title.substring(maxCharsPerLine);
            if (remaining.length <= maxCharsPerLine) {
                lines.push(remaining);
            } else {
                lines.push(remaining.substring(0, maxCharsPerLine - 1) + '...');
            }
        }
        
        // 行を描画
        lines.forEach((line, i) => {
            text.append('tspan')
                .attr('x', 0)
                .attr('dy', i === 0 ? '-0.3em' : `${lineHeight}em`)
                .text(line);
        });
    }

    // ミニマップ設定
    setupMinimap() {
        // ミニマップ実装（簡略版）
        const minimap = d3.select('#minimap');
        // TODO: ミニマップの詳細実装
    }

    // ミニマップ更新
    updateMinimap() {
        // TODO: ミニマップ更新の実装
    }

    // リサイズ処理
    handleResize() {
        const rect = this.container.node().getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);
        
        this.simulation
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .restart();
    }

    // テキスト切り詰め
    truncateText(text, type) {
        const maxLength = type === 'root' ? 30 : type === 'major_issue' ? 25 : 20;
        return Utils.truncateText(text, maxLength);
    }

    // クリーンアップ
    destroy() {
        if (this.simulation) {
            this.simulation.stop();
        }
        this.svg.remove();
    }
}