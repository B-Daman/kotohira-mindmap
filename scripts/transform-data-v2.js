// データ構造変換スクリプト v2
// 課題→対策→現在/将来の取り組み→成功事例の階層に変換

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 既存データの読み込み
const dataPath = path.join(__dirname, '../data/kotohira-data.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const oldData = JSON.parse(rawData);

// 主要課題のマッピング例（手動で調整）
const effortToSolutionMap = {
    // 関係人口創出の取り組み
    'kotohira_connect': 'relation_population',
    'otetsutabi': 'relation_population',
    'cooperation_team': 'relation_population',
    
    // UIターン支援の取り組み
    'ai_online_income': 'ui_turn_support',
    
    // 観光コンテンツの取り組み
    'modern_tourism': 'create_new_tourism',
    'kotohira_guide': 'create_new_tourism',
    'kotorip': 'create_new_tourism',
    
    // リピーター施策の取り組み
    'shodoshima_collaboration': 'repeater_measures',
    'shrine_festival': 'repeater_measures',
    
    // 情報発信の取り組み
    'social_media': 'strengthen_information',
    'youtuber_collaboration': 'strengthen_information',
    
    // PR戦略の取り組み
    'influencer_marketing': 'pr_strategy',
    'kotohira_ambassador': 'pr_strategy',
    
    // 交通アクセスの取り組み
    'limousine_renewal': 'improve_access',
    'secondary_transport': 'improve_access',
    
    // AI活用の取り組み
    'ai_promotion': 'ai_utilization',
    'smart_tourism': 'ai_utilization',
    
    // 創業支援の取り組み
    'startup_support': 'create_startup',
    'coworking_space': 'create_startup',
    
    // DX推進の取り組み
    'digital_education': 'promote_dx',
    'online_events': 'promote_dx'
};

// 成功事例のマッピング
const successToEffortMap = {
    'kerry_case': 'kotohira_connect',
    'ambassador_success': 'kotohira_ambassador',
    'hotel_shuttle': 'limousine_renewal',
    'startup_example': 'startup_support'
};

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

    // 1. まず既存のchildrenを処理（サブ課題など）
    if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
            processedNode.children.push(processNode(child));
        });
    }

    // 2. solutionsを処理
    if (node.solutions && Array.isArray(node.solutions)) {
        node.solutions.forEach(solution => {
            const solutionNode = {
                id: solution.id,
                title: solution.title,
                type: solution.type,
                description: solution.description,
                children: []
            };

            if (solution.urls) solutionNode.urls = solution.urls;

            // 現在の取り組みグループを作成
            const currentEffortsForSolution = [];
            if (node.currentEfforts) {
                node.currentEfforts.forEach(effort => {
                    if (effortToSolutionMap[effort.id] === solution.id) {
                        const effortNode = {
                            ...effort,
                            children: []
                        };

                        // この取り組みに関連する成功事例を追加
                        if (node.successCases) {
                            node.successCases.forEach(success => {
                                if (successToEffortMap[success.id] === effort.id) {
                                    effortNode.children.push({
                                        ...success,
                                        children: []
                                    });
                                }
                            });
                        }

                        currentEffortsForSolution.push(effortNode);
                    }
                });
            }

            // 現在の取り組みがある場合はグループ化
            if (currentEffortsForSolution.length > 0) {
                solutionNode.children.push({
                    id: `${solution.id}_current_group`,
                    title: "現在の取り組み",
                    type: "current_effort",
                    description: "実施中の具体的な施策",
                    children: currentEffortsForSolution
                });
            }

            // 将来的な取り組みグループを追加（プレースホルダー）
            solutionNode.children.push({
                id: `${solution.id}_future_group`,
                title: "将来的な取り組み",
                type: "future_effort",
                description: "検討中・計画段階の施策",
                children: []
            });

            processedNode.children.push(solutionNode);
        });
    }

    return processedNode;
}

// 新しいデータ構造の作成
const newData = {
    centerNode: oldData.centerNode,
    nodes: []
};

// 各主要ノードを処理
oldData.nodes.forEach(node => {
    newData.nodes.push(processNode(node));
});

// 新しいデータを保存
const newDataPath = path.join(__dirname, '../data/kotohira-data-hierarchical.json');
fs.writeFileSync(newDataPath, JSON.stringify(newData, null, 2), 'utf8');

console.log('データ変換が完了しました。');
console.log(`新しいデータは ${newDataPath} に保存されました。`);
console.log('注意: 一部の取り組みと成功事例のマッピングは手動で調整が必要です。');