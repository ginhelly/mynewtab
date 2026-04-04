/**
 * Модуль поиска с поддержкой нескольких движков
 */

class SearchModule {
    constructor() {
        this.storageKey = 'search_engine';
        this.defaultEngine = 'duckduckgo';
        this.currentEngine = this.defaultEngine;

        this.searchInput = document.getElementById('searchInput');
        this.searchForm = document.getElementById('searchForm');
        this.engineButtons = document.querySelectorAll('.search-button[data-engine]');
        this.searchEngineIcon = document.getElementById('searchEngineIcon');

        this.engineConfig = {
            duckduckgo: {
                url: 'https://duckduckgo.com/',
                placeholder: 'Поиск в DuckDuckGo...',
                icon: 'images/duck-small.webp',
                param: 'q'
            },
            google: {
                url: 'https://www.google.com/search',
                placeholder: 'Поиск в Google...',
                icon: 'images/google-small.webp',
                param: 'q'
            },
            youtube: {
                url: 'https://www.youtube.com/results',
                placeholder: 'Поиск в YouTube...',
                icon: 'images/youtube.webp',
                param: 'search_query'
            },
            yandex: {
                url: 'https://yandex.ru/search/',
                placeholder: 'Поиск в Yandex...',
                icon: 'images/yandex.webp',
                param: 'text'
            },
            yamaps: {
                url: 'https://yandex.ru/maps/',
                placeholder: 'Поиск на Яндекс.Картах...',
                icon: 'images/yamaps.webp',
                param: 'text'
            }
        };

        this.handleFormSubmit = this.handleFormSubmit.bind(this);
        this.handleEngineClick = this.handleEngineClick.bind(this);
        this.handleEngineMouseDown = this.handleEngineMouseDown.bind(this);
        this.handleInputKeydown = this.handleInputKeydown.bind(this);
    }

    init() {
        this.loadCurrentEngine();
        this.updateUI();
        this.bindEvents();
    }

    destroy() {
        if (this.searchForm) {
            this.searchForm.removeEventListener('submit', this.handleFormSubmit);
        }

        if (this.searchInput) {
            this.searchInput.removeEventListener('keydown', this.handleInputKeydown);
        }

        this.engineButtons.forEach(btn => {
            btn.removeEventListener('click', this.handleEngineClick);
            btn.removeEventListener('mousedown', this.handleEngineMouseDown);
        });
    }

    bindEvents() {
        if (this.searchForm) {
            this.searchForm.addEventListener('submit', this.handleFormSubmit);
        }

        this.engineButtons.forEach(btn => {
            btn.addEventListener('click', this.handleEngineClick);
            btn.addEventListener('mousedown', this.handleEngineMouseDown);
        });

        if (this.searchInput) {
            this.searchInput.addEventListener('keydown', this.handleInputKeydown);
        }
    }

    handleFormSubmit(e) {
        e.preventDefault();
        const query = this.getQuery();
        if (query) {
            this.search(query);
        }
    }

    handleEngineClick(e) {
        const button = e.currentTarget;
        const engine = button?.dataset?.engine;

        if (!engine || !this.engineConfig[engine]) return;

        const query = this.getQuery();

        this.setCurrentEngine(engine);

        if (query) {
            this.search(query, engine);
        } else {
            this.searchInput?.focus();
        }
    }

    handleEngineMouseDown(e) {
        if (e.button !== 1) return;
        e.preventDefault();
        e.stopPropagation();

        const button = e.currentTarget;
        const engine = button?.dataset?.engine;
        const query = this.getQuery();

        if (!engine || !this.engineConfig[engine]) return;

        if (query) {
            // Ищем в движке, на котором кликнули, но НЕ меняем текущий
            this.search(query, engine, true);
        }
        // Если запрос пустой — ничего не делаем, просто игнорируем клик
    }

    handleInputKeydown(e) {
        if (e.key === 'Enter' && !this.getQuery()) {
            e.preventDefault();
        }
    }

    getQuery() {
        return this.searchInput?.value.trim() || '';
    }

    setCurrentEngine(engine) {
        if (!this.engineConfig[engine]) return;

        this.currentEngine = engine;
        this.saveCurrentEngine();
        this.updateUI();
    }

    updateUI() {
        const config = this.engineConfig[this.currentEngine];
        if (!config) return;

        if (this.searchForm) {
            this.searchForm.action = config.url;
            this.searchForm.method = 'GET';
        }

        if (this.searchInput) {
            this.searchInput.placeholder = config.placeholder;
            this.searchInput.name = config.param;
        }

        if (this.searchEngineIcon) {
            this.searchEngineIcon.src = config.icon;
        }

        this.engineButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.engine === this.currentEngine);
        });
    }

    search(query, overrideEngine = null, forceNewTab = false) {
        const engine = overrideEngine || this.currentEngine;
        const config = this.engineConfig[engine];

        if (!config || !query) return;

        const url = `${config.url}?${config.param}=${encodeURIComponent(query)}`;

        if (forceNewTab) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            window.location.href = url;
        }
    }

    saveCurrentEngine() {
        try {
            localStorage.setItem(this.storageKey, this.currentEngine);
        } catch (e) {
            console.error('[Search] Ошибка сохранения:', e);
        }
    }

    loadCurrentEngine() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved && this.engineConfig[saved]) {
                this.currentEngine = saved;
            } else {
                this.currentEngine = this.defaultEngine;
            }
        } catch (e) {
            console.error('[Search] Ошибка загрузки:', e);
            this.currentEngine = this.defaultEngine;
        }
    }
}

export default SearchModule;