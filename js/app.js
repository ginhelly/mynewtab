/**
 * Точка входа приложения
 * Инициализация всех модулей
 */

import Clock from './modules/clock.js';
import WeatherWidget from './modules/weather.js';
import TodoList from './modules/todo.js';
import SearchModule from './modules/search.js';
import Storage from './utils/storage.js';

// Конфигурация приложения
const CONFIG = {
    timezone: 4, // UTC+4 (Самара/Ижевск)
    defaultWeatherLocation: 'Izhevsk'
};

/**
 * Модуль IP-адреса (простой, не требует отдельного файла)
 */
class IPWidget {
    constructor() {
        this.element = document.getElementById('myIP');
        this.button = document.getElementById('fetchIPBtn');
        this.isLoading = false;
    }

    init() {
        if (this.button) {
            this.button.addEventListener('click', () => this.fetch());
        }
    }

    async fetch() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        if (this.button) {
            this.button.textContent = '...';
            this.button.disabled = true;
        }

        if (this.element) {
            this.element.textContent = 'Загрузка...';
        }

        try {
            // Пробуем ipapi.co
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error('ipapi failed');
            
            const data = await response.json();
            this.display(data.ip, data.country_name, data.city, data.org);
        } catch (error) {
            // Fallback на ipinfo.io
            try {
                const response = await fetch('https://ipinfo.io/json');
                if (!response.ok) throw new Error('ipinfo failed');
                
                const data = await response.json();
                const country = this.getCountryName(data.country);
                this.display(data.ip, country, data.city, data.org);
            } catch (fallbackError) {
                this.showError();
            }
        } finally {
            this.isLoading = false;
            if (this.button) {
                this.button.textContent = 'Чек';
                this.button.disabled = false;
            }
        }
    }

    display(ip, country, city, org) {
        if (this.element) {
            this.element.textContent = `${ip} (${country}: ${city} | ${org})`;
        }
    }

    showError() {
        if (this.element) {
            this.element.textContent = 'Не удалось определить IP';
        }
    }

    getCountryName(code) {
        const countries = {
            'RU': 'Россия',
            'US': 'США',
            'GB': 'Великобритания',
            'DE': 'Германия',
            'FR': 'Франция',
            'IT': 'Италия',
            'ES': 'Испания',
            'CN': 'Китай',
            'JP': 'Япония',
            'KR': 'Южная Корея',
            'NL': 'Нидерланды'
        };
        return countries[code] || code;
    }
}

/**
 * Инициализация приложения
 */
function initApp() {
    console.log('[App] Инициализация...');

    // 1. Часы
    const clock = new Clock({
        timezoneOffset: CONFIG.timezone,
        updateInterval: 1000
    });
    clock.start();

    // 2. Поиск
    const search = new SearchModule({
        maxHistory: 10,
        shortcuts: true
    });
    search.init();

    // Привязываем кнопки поиска
    document.querySelectorAll('.search-button[data-engine]').forEach(btn => {
        const engine = btn.dataset.engine;
        btn.addEventListener('click', () => {
            const query = document.getElementById('searchInput')?.value || '';
            if (query.trim()) {
                search.search(query, engine);
            } else {
                document.getElementById('searchInput')?.focus();
            }
        });
    });

    // 3. Погода
    const weather = new WeatherWidget({
        defaultLocation: CONFIG.defaultWeatherLocation,
        cacheMaxAge: 24 * 60 * 60 * 1000 // 24 часа
    });
    weather.init();

    // 4. Todo
    const todo = new TodoList({
        maxItems: 100
    });
    todo.init();

    // 5. IP виджет
    const ipWidget = new IPWidget();
    ipWidget.init();

    // Экспорт в глобальную область для отладки
    window.app = {
        clock,
        search,
        weather,
        todo,
        ipWidget,
        storage: Storage,
        config: CONFIG
    };

    console.log('[App] Готово! Доступно через window.app');
}

// Запуск при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}