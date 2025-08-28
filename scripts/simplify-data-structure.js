// データ構造を簡素化するスクリプト
// 「現在の取り組み」「将来的な取り組み」のグループノードを削除し、直接対策の子要素にする

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 現在のデータを読み込み
const dataPath = path.join(__dirname, '../data/kotohira-data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(rawData);

// ノードを再帰的に処理
function processNode(node) {
    const processedNode = {
        id: node.id,
        title: node.title,
        type: node.type,
        description: node.description
    };

    // その他の属性をコピー
    if (node.status) processedNode.status = node.status;
    if (node.urls) processedNode.urls = node.urls;
    if (node.data) processedNode.data = node.data;

    // 子ノードの処理
    processedNode.children = [];

    if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
            // グループノードの場合、その子要素を直接追加
            if ((child.id.endsWith('_current_group') || child.id.endsWith('_future_group')) && 
                child.children && Array.isArray(child.children)) {
                // グループの子要素を直接追加
                child.children.forEach(grandchild => {
                    processedNode.children.push(processNode(grandchild));
                });
            } else {
                // 通常のノードはそのまま処理
                processedNode.children.push(processNode(child));
            }
        });
    }

    return processedNode;
}

// 新しいデータ構造の作成
const newData = {
    centerNode: data.centerNode,
    nodes: []
};

// 各主要ノードを処理
data.nodes.forEach(node => {
    newData.nodes.push(processNode(node));
});

// 新しいデータを保存
const newDataPath = path.join(__dirname, '../data/kotohira-data-simplified.json');
fs.writeFileSync(newDataPath, JSON.stringify(newData, null, 2), 'utf8');

console.log('データ構造の簡素化が完了しました。');
console.log(`新しいデータは ${newDataPath} に保存されました。`);