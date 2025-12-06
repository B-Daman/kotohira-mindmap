// マインドマップ設定ファイル

export const MINDMAP_CONFIGS = {
    // 琴平町マインドマップ（既存）
    kotohira: {
        title: '琴平町 消滅可能性自治体からの脱却',
        dataUrl: 'data/kotohira-data.json',
        storageKey: 'kotohira-mindmap-autosave'
    },
    
    // 個人目標マインドマップ（地域おこし協力隊）
    'personal-goals': {
        title: '地域おこし協力隊DAOマネージャー卒業までにやりたいこと',
        dataUrl: 'data/personal-goals.json',
        storageKey: 'personal-goals-mindmap-autosave'
    },
    
    // プロジェクト管理の例
    project: {
        title: 'プロジェクト管理',
        dataUrl: 'data/project-mindmap.json',
        storageKey: 'project-mindmap-autosave'
    },
    
    // アイデア整理の例
    ideas: {
        title: 'アイデア整理',
        dataUrl: 'data/ideas-mindmap.json',
        storageKey: 'ideas-mindmap-autosave'
    },
    
    // 琴平DAOペルソナ設計
    'dao-persona': {
        title: '琴平DAO ペルソナ設計',
        dataUrl: 'data/dao-persona-design.json',
        storageKey: 'dao-persona-mindmap-autosave'
    },

    // あっきーの活動マインドマップ
    'akki-activities': {
        title: 'AI × DAOでつくる「関わりしろのあるまち」琴平町 - あっきーの活動マインドマップ',
        dataUrl: 'data/akki-activities.json',
        storageKey: 'akki-activities-mindmap-autosave'
    }
};

// URLパラメータからマインドマップを選択
export function getActiveConfig() {
    const params = new URLSearchParams(window.location.search);
    const mapType = params.get('map') || 'kotohira';
    console.log('Map type requested:', mapType);
    console.log('Available configs:', Object.keys(MINDMAP_CONFIGS));
    const config = MINDMAP_CONFIGS[mapType] || MINDMAP_CONFIGS.kotohira;
    console.log('Selected config:', config);
    return config;
}