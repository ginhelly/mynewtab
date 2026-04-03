/**
 * Точка входа приложения
 */

import Clock from './modules/clock.js';
import WeatherWidget from './modules/weather.js';
import TodoList from './modules/todo.js';
import SearchModule from './modules/search.js';
import Storage from './utils/storage.js';
import LocationDetector from './utils/locationDetector.js';

const CONFIG = {
    timezone: 4,
    defaultWeatherLocation: 'Izhevsk'
};

const locationDetector = new LocationDetector();

function updateSectionsHighlight(isLocal, source) {
    const outerSection = document.querySelector('.net-section.outer');
    const localSection = document.querySelector('.net-section.local');
    
    if (!outerSection || !localSection) return;
    
    if (isLocal) {
        outerSection.style.opacity = '0.5';
        outerSection.style.filter = 'grayscale(0.3)';
        localSection.style.opacity = '1';
        localSection.style.filter = 'none';
        
        outerSection.classList.add('dimmed');
        localSection.classList.remove('dimmed');
        localSection.classList.add('highlighted');
        outerSection.classList.remove('highlighted');
    } else {
        outerSection.style.opacity = '1';
        outerSection.style.filter = 'none';
        localSection.style.opacity = '0.5';
        localSection.style.filter = 'grayscale(0.3)';
        
        outerSection.classList.add('highlighted');
        localSection.classList.add('dimmed');
        outerSection.classList.remove('dimmed');
        localSection.classList.remove('highlighted');
    }
}

class NetworkWidget {
    constructor(detector) {
        this.element = document.getElementById('myIP');
        this.button = document.getElementById('fetchIPBtn');
        this.isLoading = false;
        this.detector = detector;
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
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error('primary failed');
            
            const data = await response.json();
            
            const positionData = {
                address: data.ip,
                region: data.country_code === 'RU' ? 'local' : 'remote',
                regionName: data.country_name,
                city: data.city,
                provider: data.org
            };
            
            this.detector.detectByPosition(positionData);
            this.display(positionData);
            
        } catch (error) {
            try {
                const response = await fetch('https://ipinfo.io/json');
                if (!response.ok) throw new Error('secondary failed');
                
                const data = await response.json();
                const positionData = {
                    address: data.ip,
                    region: data.country === 'RU' ? 'local' : 'remote',
                    regionName: this.getRegionName(data.country),
                    city: data.city,
                    provider: data.org
                };
                
                this.detector.detectByPosition(positionData);
                this.display(positionData);
                
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

    display(data) {
        if (this.element) {
            this.element.textContent = `${data.address} (${data.regionName}: ${data.city} | ${data.provider})`;
        }
    }

    showError() {
        if (this.element) {
            this.element.textContent = 'Не удалось определить';
        }
    }

    getRegionName(code) {
        const regions = {
            'RU': 'Местный',
            'US': 'Внешний',
            'GB': 'Внешний',
            'DE': 'Внешний',
            'FR': 'Внешний',
            'IT': 'Внешний',
            'ES': 'Внешний',
            'CN': 'Внешний',
            'JP': 'Внешний',
            'KR': 'Внешний',
            'NL': 'Внешний'
        };
        return regions[code] || code;
    }
}

function initApp() {
    const initialStatus = locationDetector.detectLocalBrowser();
    updateSectionsHighlight(initialStatus, locationDetector.getSource());
    
    locationDetector.subscribe((isLocal, source) => {
        if (source === 'network') {
            updateSectionsHighlight(isLocal, source);
        }
    });

    const clock = new Clock({
        timezoneOffset: CONFIG.timezone,
        updateInterval: 1000
    });
    clock.start();

    const search = new SearchModule({
        maxHistory: 10,
        shortcuts: true
    });
    search.init();

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

    const weather = new WeatherWidget({
        defaultLocation: CONFIG.defaultWeatherLocation,
        cacheMaxAge: 24 * 60 * 60 * 1000
    });
    weather.init();

    const todo = new TodoList({
        maxItems: 100
    });
    todo.init();

    const networkWidget = new NetworkWidget(locationDetector);
    networkWidget.init();

    window.app = {
        clock,
        search,
        weather,
        todo,
        networkWidget,
        locationDetector,
        storage: Storage,
        config: CONFIG
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}