// サンプル画像データを追加するスクリプト

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 現在のデータを読み込み
const dataPath = path.join(__dirname, '../data/kotohira-data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(rawData);

// サンプル画像データ
const sampleImages = {
    // 女性人口減少のノードに画像を追加
    'female_population': {
        url: 'https://via.placeholder.com/600x400/3498db/ffffff?text=人口推移グラフ',
        alt: '琴平町の20-39歳女性人口推移グラフ（サンプル）',
        caption: '※これはサンプル画像です。実際のデータに置き換えてください。'
    },
    // 観光リピーター問題に画像を追加
    'konpira_problem': {
        url: 'https://via.placeholder.com/600x400/e74c3c/ffffff?text=観光客数推移',
        alt: '金刀比羅宮参拝者数の推移（サンプル）',
        caption: '※サンプル画像：年間200-300万人の参拝者数推移'
    }
};

// ノードを再帰的に処理して画像を追加
function addSampleImages(node) {
    // 該当するノードに画像を追加
    if (sampleImages[node.id]) {
        node.image = sampleImages[node.id];
        console.log(`画像を追加: ${node.title}`);
    }
    
    // 子ノードを再帰的に処理
    if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
            addSampleImages(child);
        });
    }
}

// 各主要ノードを処理
data.nodes.forEach(node => {
    addSampleImages(node);
});

// 更新されたデータを保存
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

console.log('\nサンプル画像データを追加しました。');
console.log('実際の画像を使用する場合は、以下の手順で置き換えてください：');
console.log('1. imagesフォルダに画像ファイルを配置');
console.log('2. data/kotohira-data.jsonの該当箇所でURLを更新');
console.log('   例: "url": "images/population-graph.png"');