/**
 * Модуль поиска с поддержкой multiple search engines
 * Горячие клавиши, история поиска
 */

class SearchModule {
    constructor(options = {}) {
        this.options = {
            historyKey: options.historyKey || 'search_history',
            maxHistory: options.maxHistory || 10,
            shortcuts: options.shortcuts !== false, // true по умолчанию
            ...options
        };

        this.engines = {
            duckduckgo: {
                name: 'DuckDuckGo',
                url: 'https://duckduckgo.com/',
                param: 'q',
                icon: 'images/duck-small.webp'
            },
            google: {
                name: 'Google',
                url: 'https://www.google.com/search',
                param: 'q',
                icon: 'images/google-small.webp'
            },
            youtube: {
                name: 'YouTube',
                url: 'https://www.youtube.com/results',
                param: 'search_query',
                icon: 'images/youtube.webp'
            },
            yandex: {
                name: 'Yandex',
                url: 'https://ya.ru/search/',
                param: 'text',
                icon: 'images/yandex.webp'
            },
            yamaps: {
                name: 'Yandex Maps',
                url: 'https://yandex.ru/maps/44/izhevsk/search/',
                param: 'text',
                icon: 'images/yamaps.webp'
            }
        };

        this.currentEngine = 'duckduckgo';
        this.history = [];

        // DOM элементы
        this.elements = {
            input: document.getElementById('searchInput'),
            form: document.querySelector('form[action*="duckduckgo"]')
        };

        // Привязка методов
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    /**
     * Инициализация модуля
     */
    init() {
        this.loadHistory();
        this.bindEvents();
        this.setupForm();
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        if (this.elements.input) {
            this.elements.input.addEventListener('keydown', this.handleKeydown);
        }

        if (this.elements.form) {
            this.elements.form.addEventListener('submit', this.handleSubmit);
        }

        // Глобальные горячие клавиши
        if (this.options.shortcuts) {
            document.addEventListener('keydown', (e) => this.handleGlobalShortcut(e));
        }
    }

    /**
     * Уничтожение модуля
     */
    destroy() {
        if (this.elements.input) {
            this.elements.input.removeEventListener('keydown', this.handleKeydown);
        }
        if (this.elements.form) {
            this.elements.form.removeEventListener('submit', this.handleSubmit);
        }
    }

    // ===== Настройка формы =====

    setupForm() {
        if (!this.elements.form || !this.elements.input) return;

        // Устанавливаем action формы в соответствии с текущим движком
        const engine = this.engines[this.currentEngine];
        this.elements.form.action = engine.url;
        this.elements.input.name = engine.param;
        
        // Placeholder с подсказкой
        this.elements.input.placeholder = `Поиск в ${engine.name}...`;
    }

    // ===== Поиск =====

    search(query, engineKey = null) {
        const trimmed = query.trim();
        if (!trimmed) return;

        // Сохраняем в историю
        this.addToHistory(trimmed);

        const engine = engineKey ? this.engines[engineKey] : this.engines[this.currentEngine];
        if (!engine) return;

        const encodedQuery = encodeURIComponent(trimmed);
        const url = engine.param === 'text' && engineKey === 'yamaps'
            ? `${engine.url}${encodedQuery}` // Yandex Maps использует path, не query param
            : `${engine.url}?${engine.param}=${encodedQuery}`;

        window.location.href = url;
    }

    setEngine(engineKey) {
        if (!this.engines[engineKey]) {
            console.error(`[Search] Неизвестный движок: ${engineKey}`);
            return;
        }

        this.currentEngine = engineKey;
        this.setupForm();
        
        // Обновляем визуальную индикацию если есть
        this.updateEngineIndicator();
    }

    // ===== История =====

    loadHistory() {
        try {
            const saved = localStorage.getItem(this.options.historyKey);
            this.history = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('[Search] Ошибка загрузки истории:', e);
            this.history = [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem(this.options.historyKey, JSON.stringify(this.history));
        } catch (e) {
            console.error('[Search] Ошибка сохранения истории:', e);
        }
    }

    addToHistory(query) {
        // Удаляем дубликаты
        this.history = this.history.filter(item => item.toLowerCase() !== query.toLowerCase());
        
        // Добавляем в начало
        this.history.unshift(query);
        
        // Ограничиваем размер
        if (this.history.length > this.options.maxHistory) {
            this.history = this.history.slice(0, this.options.maxHistory);
        }
        
        this.saveHistory();
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem(this.options.historyKey);
    }

    getSuggestions(partial) {
        if (!partial || partial.length < 2) return [];
        
        const lower = partial.toLowerCase();
        return this.history
            .filter(item => item.toLowerCase().includes(lower))
            .slice(0, 5);
    }

    // ===== Обработчики =====

    handleKeydown(event) {
        // Tab для переключения движков
        if (event.key === 'Tab' && event.ctrlKey) {
            event.preventDefault();
            this.cycleEngine();
        }
    }

    handleSubmit(event) {
        event.preventDefault();
        this.search(this.elements.input.value);
    }

    handleGlobalShortcut(event) {
        // / или Ctrl+K для фокуса на поиск
        if (event.key === '/' || (event.ctrlKey && event.key === 'k')) {
            // Не срабатываем если пользователь печатает в input
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA') {
                return;
            }
            
            event.preventDefault();
            this.elements.input?.focus();
            this.elements.input?.select();
        }

        // Escape для сброса
        if (event.key === 'Escape' && document.activeElement === this.elements.input) {
            this.elements.input.value = '';
            this.elements.input.blur();
        }
    }

    // ===== Утилиты =====

    cycleEngine() {
        const keys = Object.keys(this.engines);
        const currentIndex = keys.indexOf(this.currentEngine);
        const nextIndex = (currentIndex + 1) % keys.length;
        this.setEngine(keys[nextIndex]);
    }

    updateEngineIndicator() {
        // Можно добавить визуальную индикацию текущего движка
        const engine = this.engines[this.currentEngine];
        console.log(`[Search] Текущий движок: ${engine.name}`);
    }

    // ===== Публичные методы для кнопок =====

    searchGoogle() { this.search(this.elements.input?.value, 'google'); }
    searchYoutube() { this.search(this.elements.input?.value, 'youtube'); }
    searchYandex() { this.search(this.elements.input?.value, 'yandex'); }
    searchYamaps() { this.search(this.elements.input?.value, 'yamaps'); }
}

export default SearchModule;