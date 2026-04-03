/**
 * Модуль погоды с кэшированием и fallback API
 * Поддержка wttr.in и Open-Meteo
 */

class WeatherWidget {
    constructor(options = {}) {
        this.options = {
            cacheKey: options.cacheKey || 'weather_data',
            cacheMaxAge: options.cacheMaxAge || 24 * 60 * 60 * 1000, // 24 часа
            defaultLocation: options.defaultLocation || null,
            ...options
        };

        this.currentLocation = null;
        this.currentWeather = null;
        this.lastUpdate = null;

        // DOM элементы
        this.elements = {
            location: document.getElementById('weatherLocation'),
            content: document.getElementById('weatherContent'),
            setLocationBtn: document.getElementById('setLocationBtn'),
            fetchWeatherBtn: document.getElementById('fetchWeatherBtn')
        };

        // Привязка методов
        this.handleSetLocation = this.handleSetLocation.bind(this);
        this.handleFetchWeather = this.handleFetchWeather.bind(this);
    }

    /**
     * Инициализация виджета
     */
    init() {
        this.loadLocationFromStorage();
        this.loadWeatherFromCache();
        this.bindEvents();

        if (!this.currentLocation) {
            this.showLocationPrompt();
        } else if (!this.currentWeather) {
            this.showNoDataMessage();
        } else {
            this.displayWeather();
        }
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        if (this.elements.setLocationBtn) {
            this.elements.setLocationBtn.addEventListener('click', this.handleSetLocation);
        }
        if (this.elements.fetchWeatherBtn) {
            this.elements.fetchWeatherBtn.addEventListener('click', this.handleFetchWeather);
        }
    }

    /**
     * Уничтожение виджета (очистка)
     */
    destroy() {
        if (this.elements.setLocationBtn) {
            this.elements.setLocationBtn.removeEventListener('click', this.handleSetLocation);
        }
        if (this.elements.fetchWeatherBtn) {
            this.elements.fetchWeatherBtn.removeEventListener('click', this.handleFetchWeather);
        }
    }

    // ===== Хранилище =====

    loadLocationFromStorage() {
        const saved = localStorage.getItem('weather_location');
        if (saved) {
            this.currentLocation = saved;
        } else if (this.options.defaultLocation) {
            this.currentLocation = this.options.defaultLocation;
        }
    }

    saveLocationToStorage() {
        if (this.currentLocation) {
            localStorage.setItem('weather_location', this.currentLocation);
        }
    }

    loadWeatherFromCache() {
        const cached = localStorage.getItem(this.options.cacheKey);
        if (!cached) return;

        try {
            const data = JSON.parse(cached);
            const cacheAge = Date.now() - data.timestamp;
            
            if (cacheAge < this.options.cacheMaxAge && data.location === this.currentLocation) {
                this.currentWeather = data.weather;
                this.lastUpdate = new Date(data.timestamp);
                console.log('[Weather] Загружено из кэша');
            } else {
                console.log('[Weather] Кэш устарел или город изменился');
                localStorage.removeItem(this.options.cacheKey);
            }
        } catch (e) {
            console.error('[Weather] Ошибка чтения кэша:', e);
        }
    }

    saveWeatherToCache() {
        if (!this.currentWeather || !this.currentLocation) return;

        const cacheData = {
            timestamp: Date.now(),
            location: this.currentLocation,
            weather: this.currentWeather
        };
        
        localStorage.setItem(this.options.cacheKey, JSON.stringify(cacheData));
        console.log('[Weather] Сохранено в кэш');
    }

    // ===== UI Методы =====

    showLoading() {
        if (this.elements.content) {
            this.elements.content.innerHTML = '<div class="weather-loading">🌤️ Загрузка погоды...</div>';
        }
    }

    showError(message) {
        if (this.elements.content) {
            this.elements.content.innerHTML = `<div class="weather-error">❌ ${message}</div>`;
        }
    }

    showNoDataMessage() {
        if (this.elements.location) {
            this.elements.location.textContent = this.currentLocation;
        }
        if (this.elements.content) {
            this.elements.content.innerHTML = `
                <div class="weather-empty">
                    <div>Нет данных</div>
                    <div class="weather-empty-hint">Нажмите 🔄 для обновления</div>
                </div>
            `;
        }
    }

    showLocationPrompt() {
        const newLocation = prompt(
            'Введите название города (например: Moscow, Samara, Saint Petersburg):',
            this.currentLocation || ''
        );
        
        if (newLocation && newLocation.trim()) {
            this.currentLocation = newLocation.trim();
            this.saveLocationToStorage();
            this.fetchWeather();
        }
    }

    // ===== API =====

    async fetchWeather() {
        if (!this.currentLocation) {
            this.showLocationPrompt();
            return;
        }

        this.showLoading();

        const weatherData = await this.tryMultipleApis();
        
        if (weatherData) {
            this.currentWeather = weatherData;
            this.lastUpdate = new Date();
            this.saveWeatherToCache();
            this.displayWeather();
        } else {
            this.showError('Не удалось получить погоду. Проверьте название города или попробуйте позже.');
        }
    }

    async tryMultipleApis() {
        // Пробуем wttr.in
        try {
            const data = await this.fetchWttrIn();
            if (data) return data;
        } catch (error) {
            console.error('[Weather] wttr.in error:', error);
        }

        // Fallback на Open-Meteo
        try {
            const data = await this.fetchOpenMeteo();
            if (data) return data;
        } catch (error) {
            console.error('[Weather] Open-Meteo error:', error);
        }

        return null;
    }

    async fetchWttrIn() {
        const url = `https://wttr.in/${encodeURIComponent(this.currentLocation)}?format=j1`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('wttr.in вернул ошибку');
        
        const data = await response.json();
        const current = data.current_condition[0];
        
        return {
            temp: `${current.temp_C}°C`,
            feelsLike: `${current.FeelsLikeC}°C`,
            description: current.lang_ru?.[0]?.value || current.weatherDesc[0].value,
            wind: `${current.windspeedKmph} км/ч`,
            humidity: `${current.humidity}%`,
            location: data.nearest_area[0].areaName[0].value,
            source: 'wttr.in'
        };
    }

    async fetchOpenMeteo() {
        // Геокодинг
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(this.currentLocation)}&count=1&language=ru&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();
        
        if (!geoData.results?.[0]) {
            throw new Error('Город не найден');
        }

        const { latitude, longitude, name, country } = geoData.results[0];
        
        // Получаем погоду
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();
        
        const current = weatherData.current_weather;
        
        return {
            temp: `${Math.round(current.temperature)}°C`,
            description: this.getWeatherDescription(current.weathercode),
            wind: `${current.windspeed} м/с`,
            feelsLike: null,
            humidity: null,
            location: `${name}, ${country}`,
            source: 'Open-Meteo'
        };
    }

    // ===== Утилиты =====

    getWeatherDescription(code) {
        const codes = {
            0: 'Ясно',
            1: 'Преимущественно ясно',
            2: 'Переменная облачность',
            3: 'Пасмурно',
            45: 'Туман',
            48: 'Иней',
            51: 'Легкая морось',
            53: 'Морось',
            55: 'Сильная морось',
            61: 'Небольшой дождь',
            63: 'Дождь',
            65: 'Сильный дождь',
            71: 'Небольшой снег',
            73: 'Снег',
            75: 'Сильный снег',
            95: 'Гроза',
            96: 'Гроза с градом',
            99: 'Сильная гроза с градом'
        };
        return codes[code] || 'Неизвестно';
    }

    getWeatherIcon(description) {
        if (!description) return '🌡️';
        
        const desc = description.toLowerCase().trim();
        
        // Объединяем карты, сортируем по длине (длинные первыми)
        const allMappings = {
            // Русские — длинные фразы первыми
            'преимущественно ясно': '🌤️',
            'переменная облачность': '⛅',
            'небольшой дождь': '🌦️',
            'сильный дождь': '🌧️',
            'гроза с градом': '⛈️',
            'небольшой снег': '🌨️',
            'сильный снег': '❄️',
            'ясно': '☀️',
            'пасмурно': '☁️',
            'облачно': '☁️',
            'туман': '🌫️',
            'дымка': '🌫️',
            'морось': '🌦️',
            'дождь': '🌧️',
            'ливень': '🌧️',
            'гроза': '⛈️',
            'снег': '❄️',
            'снегопад': '❄️',
            'ветер': '💨',
            'пыль': '🌫️',
            'песчаная буря': '🌪️',
            
            // Английские — длинные фразы первыми
            'mostly clear': '🌤️',
            'partly cloudy': '⛅',
            'light drizzle': '🌦️',
            'moderate rain': '🌧️',
            'heavy rain': '🌧️',
            'light rain': '🌦️',
            'light snow': '🌨️',
            'heavy snow': '❄️',
            'thunderstorm': '⛈️',
            'sandstorm': '🌪️',
            'clear': '☀️',
            'sunny': '☀️',
            'cloudy': '☁️',
            'overcast': '☁️',
            'fog': '🌫️',
            'mist': '🌫️',
            'haze': '🌫️',
            'drizzle': '🌦️',
            'rain': '🌧️',
            'shower': '🌧️',
            'thunder': '⛈️',
            'storm': '⛈️',
            'snow': '❄️',
            'blizzard': '❄️',
            'sleet': '🌨️',
            'windy': '💨',
            'breezy': '💨',
            'wind': '💨',
            'dust': '🌫️',
            'sand': '🌫️'
        };
        
        // Сортируем ключи по длине (убывание) и проверяем
        const sortedKeys = Object.keys(allMappings).sort((a, b) => b.length - a.length);
        
        for (const key of sortedKeys) {
            if (desc.includes(key)) {
                return allMappings[key];
            }
        }
        
        return '🌡️';
    }

    // ===== Отображение =====

    displayWeather() {
        const contentDiv = document.getElementById('weatherContent');
        const locationDiv = document.getElementById('weatherLocation');
        const weather = this.currentWeather;
        
        if (locationDiv) {
            locationDiv.textContent = weather.location || this.currentLocation;
        }

        const updateTimeStr = this.lastUpdate 
            ? this.lastUpdate.toLocaleString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'кэш';

        // Формируем чипы
        const chips = [];
        
        if (weather.wind) {
            chips.push(`<span class="weather-chip"><span class="weather-chip-icon">💨</span>${weather.wind}</span>`);
        }
        if (weather.humidity) {
            chips.push(`<span class="weather-chip"><span class="weather-chip-icon">💧</span>${weather.humidity}</span>`);
        }
        if (weather.feelsLike && weather.feelsLike !== weather.temp) {
            chips.push(`<span class="weather-chip"><span class="weather-chip-icon">🌡️</span>ощущается ${weather.feelsLike}</span>`);
        }

        // Определяем цвет температуры
        const tempNum = parseInt(weather.temp);
        let tempColor = 'var(--text-primary)';
        if (tempNum > 25) tempColor = '#ff7a7a';
        else if (tempNum < 0) tempColor = '#7ab0ff';
        else if (tempNum > 15) tempColor = '#4caf50';

        contentDiv.innerHTML = `
            <div class="weather-main">
                <div class="weather-temp-row">
                    <span class="weather-temp" style="color: ${tempColor}">${weather.temp} ${this.getWeatherIcon(weather.description)}</span>
                </div>
                <div class="weather-desc">${weather.description}</div>
                ${chips.length ? `<div class="weather-details">${chips.join('')}</div>` : ''}
            </div>
            <div class="weather-meta">
                <span>🕐 ${updateTimeStr}</span>
                ${weather.source ? `<span class="weather-source">${weather.source}</span>` : ''}
            </div>
        `;
    }

    // ===== Обработчики событий =====

    handleSetLocation() {
        this.showLocationPrompt();
    }

    handleFetchWeather() {
        this.fetchWeather();
    }
}

export default WeatherWidget;