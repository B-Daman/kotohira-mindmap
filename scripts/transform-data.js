// データ構造変換スクリプト
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

// 新しいデータ構造の作成
function transformData(oldData) {
    const newData = {
        centerNode: oldData.centerNode,
        nodes: []
    };

    // 各ノードを変換
    oldData.nodes.forEach(node => {
        if (node.type === 'major_issue' || node.type === 'issue') {
            const transformedNode = {
                ...node,
                children: []
            };

            // ソリューションを処理
            if (node.solutions) {
                node.solutions.forEach(solution => {
                    const solutionNode = {
                        ...solution,
                        children: []
                    };

                    // 現在の取り組みを対策の子要素として追加
                    const currentEfforts = node.currentEfforts || [];
                    const matchingEfforts = currentEfforts.filter(effort => {
                        // 対策に関連する取り組みを判定（簡易的なマッチング）
                        return true; // すべての取り組みを最初の対策に紐付け（後で手動調整）
                    });

                    if (matchingEfforts.length > 0) {
                        // 現在の取り組みグループを作成
                        const currentGroup = {
                            id: `${solution.id}_current`,
                            title: "現在の取り組み",
                            type: "current_effort",
                            description: "実施中の具体的な取り組み",
                            children: []
                        };

                        matchingEfforts.forEach(effort => {
                            const effortNode = {
                                ...effort,
                                children: []
                            };

                            // 成功事例を取り組みの子要素として追加
                            const successCases = node.successCases || [];
                            const matchingSuccess = successCases.filter(success => {
                                // 取り組みに関連する成功事例を判定
                                return true; // 簡易的にすべてを紐付け
                            });

                            if (matchingSuccess.length > 0) {
                                matchingSuccess.forEach(success => {
                                    effortNode.children.push(success);
                                });
                            }

                            currentGroup.children.push(effortNode);
                        });

                        solutionNode.children.push(currentGroup);
                    }

                    // 将来的な取り組みグループ（プレースホルダー）
                    const futureGroup = {
                        id: `${solution.id}_future`,
                        title: "将来的な取り組み",
                        type: "future_effort",
                        description: "検討中または計画段階の取り組み",
                        children: []
                    };
                    solutionNode.children.push(futureGroup);

                    transformedNode.children.push(solutionNode);
                });
            }

            newData.nodes.push(transformedNode);
        }
    });

    return newData;
}

// 変換実行
const newData = transformData(oldData);

// 新しいデータを保存
const newDataPath = path.join(__dirname, '../data/kotohira-data-new.json');
fs.writeFileSync(newDataPath, JSON.stringify(newData, null, 2), 'utf8');

console.log('データ変換が完了しました。');
console.log(`新しいデータは ${newDataPath} に保存されました。`);