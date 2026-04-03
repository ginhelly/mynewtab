class MarkdownParser {
    static parse(text) {
        if (!text) return '';

        let html = this.escapeHtml(text);

        const linkMap = [];

        // Markdown-ссылки -> плейсхолдеры
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
            try {
                const safeUrl = new URL(url);
                const tag = `<a href="${safeUrl.href}" target="_blank" rel="noopener noreferrer" class="todo-link">${linkText}</a>`;
                const token = `@@LINK${linkMap.length}@@`;
                linkMap.push(tag);
                return token;
            } catch {
                return match;
            }
        });

        // Авто-ссылки, уже без риска залезть внутрь <a>
        html = html.replace(/(^|[\s(>])(https?:\/\/[^\s<"]+)/g, (match, prefix, url) => {
            try {
                const safeUrl = new URL(url);
                return `${prefix}<a href="${safeUrl.href}" target="_blank" rel="noopener noreferrer" class="todo-link">${url}</a>`;
            } catch {
                return match;
            }
        });

        // Возвращаем Markdown-ссылки
        linkMap.forEach((tag, i) => {
            html = html.replace(`@@LINK${i}@@`, tag);
        });

        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<u>$1</u>');

        return html;
    }

    static escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

export default MarkdownParser;