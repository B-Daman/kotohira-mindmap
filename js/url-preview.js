// URLプレビュー機能モジュール

export class UrlPreview {
    constructor() {
        this.previewContainer = null;
        this.previewTimeout = null;
        this.currentUrl = null;
        this.init();
    }

    init() {
        // プレビューコンテナを作成
        this.previewContainer = document.createElement('div');
        this.previewContainer.id = 'url-preview';
        this.previewContainer.className = 'url-preview hidden';
        document.body.appendChild(this.previewContainer);
    }

    // URLプレビューを表示
    async showPreview(url, x, y) {
        // 同じURLの場合はスキップ
        if (this.currentUrl === url && !this.previewContainer.classList.contains('hidden')) {
            return;
        }

        this.currentUrl = url;
        
        // プレビューコンテナの内容をクリア
        this.previewContainer.innerHTML = '<div class="preview-loading">読み込み中...</div>';
        
        // 位置を設定
        this.positionPreview(x, y);
        
        // 表示
        this.previewContainer.classList.remove('hidden');
        
        try {
            // URLのタイプを判定
            const urlType = this.getUrlType(url);
            
            if (urlType === 'pdf') {
                // PDFの場合
                this.showPdfPreview(url);
            } else if (urlType === 'image') {
                // 画像の場合
                this.showImagePreview(url);
            } else {
                // 通常のWebページの場合
                this.showWebPreview(url);
            }
        } catch (error) {
            this.previewContainer.innerHTML = `
                <div class="preview-error">
                    <p>プレビューを読み込めませんでした</p>
                    <a href="${url}" target="_blank" rel="noopener noreferrer">リンクを開く</a>
                </div>
            `;
        }
    }

    // URLのタイプを判定
    getUrlType(url) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.endsWith('.pdf')) {
            return 'pdf';
        } else if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
            return 'image';
        }
        return 'web';
    }

    // PDFプレビュー
    showPdfPreview(url) {
        this.previewContainer.innerHTML = `
            <div class="preview-pdf">
                <div class="preview-header">
                    <i class="icon-pdf"></i>
                    <span>PDFドキュメント</span>
                </div>
                <div class="preview-body">
                    <p class="preview-filename">${this.getFilename(url)}</p>
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="preview-link">
                        PDFを開く
                    </a>
                </div>
            </div>
        `;
    }

    // 画像プレビュー
    showImagePreview(url) {
        const img = new Image();
        img.onload = () => {
            this.previewContainer.innerHTML = `
                <div class="preview-image">
                    <img src="${url}" alt="プレビュー">
                </div>
            `;
        };
        img.onerror = () => {
            this.previewContainer.innerHTML = `
                <div class="preview-error">
                    <p>画像を読み込めませんでした</p>
                </div>
            `;
        };
        img.src = url;
    }

    // Webページプレビュー（簡易版）
    showWebPreview(url) {
        // ドメインとタイトルを表示
        const domain = new URL(url).hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        this.previewContainer.innerHTML = `
            <div class="preview-web">
                <div class="preview-header">
                    <img src="${favicon}" alt="" class="preview-favicon">
                    <span class="preview-domain">${domain}</span>
                </div>
                <div class="preview-body">
                    <p class="preview-url">${this.truncateUrl(url)}</p>
                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="preview-link">
                        ページを開く
                    </a>
                </div>
            </div>
        `;
    }

    // プレビューの位置を設定
    positionPreview(x, y) {
        const rect = this.previewContainer.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 右側に表示（画面外にはみ出す場合は左側）
        let left = x + 10;
        if (left + rect.width > viewportWidth) {
            left = x - rect.width - 10;
        }
        
        // 下側に表示（画面外にはみ出す場合は上側）
        let top = y;
        if (top + rect.height > viewportHeight) {
            top = viewportHeight - rect.height - 10;
        }
        
        this.previewContainer.style.left = `${left}px`;
        this.previewContainer.style.top = `${top}px`;
    }

    // プレビューを非表示
    hidePreview() {
        if (this.previewTimeout) {
            clearTimeout(this.previewTimeout);
        }
        this.previewContainer.classList.add('hidden');
        this.currentUrl = null;
    }

    // ヘルパー関数
    getFilename(url) {
        return url.split('/').pop().split('?')[0];
    }

    truncateUrl(url) {
        if (url.length > 60) {
            return url.substring(0, 57) + '...';
        }
        return url;
    }

    // URLリンクにイベントを設定
    attachToUrlLinks() {
        document.addEventListener('mouseover', (e) => {
            const link = e.target.closest('.url-item a');
            if (link) {
                if (this.previewTimeout) {
                    clearTimeout(this.previewTimeout);
                }
                this.previewTimeout = setTimeout(() => {
                    this.showPreview(link.href, e.pageX, e.pageY);
                }, 500); // 0.5秒のディレイ
            }
        });

        document.addEventListener('mouseout', (e) => {
            const link = e.target.closest('.url-item a');
            if (link) {
                if (this.previewTimeout) {
                    clearTimeout(this.previewTimeout);
                }
                this.previewTimeout = setTimeout(() => {
                    this.hidePreview();
                }, 300);
            }
        });

        // プレビュー自体にマウスが乗った場合は非表示にしない
        this.previewContainer.addEventListener('mouseenter', () => {
            if (this.previewTimeout) {
                clearTimeout(this.previewTimeout);
            }
        });

        this.previewContainer.addEventListener('mouseleave', () => {
            this.hidePreview();
        });
    }
}