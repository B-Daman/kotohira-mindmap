// 将来的な取り組みのサンプルデータを追加するスクリプト

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 現在のデータを読み込み
const dataPath = path.join(__dirname, '../data/kotohira-data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(rawData);

// 将来的な取り組みのサンプルデータ
const futureEfforts = {
    // 二拠点居住促進の将来的な取り組み
    'dual_residence': [
        {
            id: 'satellite_office',
            title: 'サテライトオフィス誘致',
            type: 'future_effort',
            description: '都市部企業のサテライトオフィス開設支援',
            children: []
        },
        {
            id: 'trial_living',
            title: 'お試し居住プログラム',
            type: 'future_effort',
            description: '短期間の移住体験プログラム開発',
            children: []
        }
    ],
    // 地元就職機会創出の将来的な取り組み
    'local_employment': [
        {
            id: 'tech_hub',
            title: 'テックハブ構想',
            type: 'future_effort',
            description: 'IT企業・スタートアップ集積地化',
            children: []
        }
    ],
    // こんぴらさん以外の魅力発信の将来的な取り組み
    'beyond_konpira': [
        {
            id: 'art_festival',
            title: 'アートフェスティバル開催',
            type: 'future_effort',
            description: '現代アートと伝統文化の融合イベント',
            children: []
        }
    ],
    // 琴平町DAO設立の将来的な取り組み
    'kotohira_dao_establishment': [
        {
            id: 'dao_governance',
            title: 'DAO投票システム導入',
            type: 'future_effort',
            description: 'ブロックチェーンを活用した意思決定システム',
            children: []
        }
    ]
};

// ノードを再帰的に処理して将来的な取り組みを追加
function addFutureEfforts(node) {
    if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
            // 対策ノードに将来的な取り組みを追加
            if (child.type === 'solution' && futureEfforts[child.id]) {
                // 既存の子要素がない、または現在の取り組みしかない場合
                const hasOnlyCurrentEfforts = child.children.length === 0 || 
                    child.children.every(c => c.type === 'current_effort' || c.type === 'success');
                
                if (hasOnlyCurrentEfforts) {
                    // 将来的な取り組みを追加
                    futureEfforts[child.id].forEach(effort => {
                        child.children.push(effort);
                    });
                }
            }
            // 再帰的に処理
            addFutureEfforts(child);
        });
    }
}

// 各主要ノードを処理
data.nodes.forEach(node => {
    addFutureEfforts(node);
});

// 更新されたデータを保存
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

console.log('将来的な取り組みのサンプルデータを追加しました。');