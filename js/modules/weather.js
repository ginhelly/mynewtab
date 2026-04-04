/**
 * Модуль погоды с кэшированием и fallback API
 * Поддержка wttr.in и Open-Meteo
 */

class WeatherWidget {
    constructor(options = {}) {
        this.options = {
            cacheKey: options.cacheKey || 'weather_data',
            cacheMaxAge: options.cacheMaxAge || 24 * 60 * 60 * 1000,
            defaultLocation: options.defaultLocation || null,
            isLocalBrowser: options.isLocalBrowser || true,
            ...options
        };

        this.currentLocation = null;
        this.currentWeather = null;
        this.lastUpdate = null;

        this.elements = {
            location: document.getElementById('weatherLocation'),
            content: document.getElementById('weatherContent'),
            setLocationBtn: document.getElementById('setLocationBtn'),
            fetchWeatherBtn: document.getElementById('fetchWeatherBtn')
        };

        this.handleSetLocation = this.handleSetLocation.bind(this);
        this.handleFetchWeather = this.handleFetchWeather.bind(this);
    }

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

    bindEvents() {
        if (this.elements.setLocationBtn) {
            this.elements.setLocationBtn.addEventListener('click', this.handleSetLocation);
        }
        if (this.elements.fetchWeatherBtn) {
            this.elements.fetchWeatherBtn.addEventListener('click', this.handleFetchWeather);
        }
    }

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
                localStorage.removeItem(this.options.cacheKey);
            }
        } catch (e) {
            console.error('[Weather] Ошибка чтения кэша:', e);
            localStorage.removeItem(this.options.cacheKey);
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
    }

    // ===== UI =====

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
        const isLocalBrowser = this.options.isLocalBrowser;

        if (isLocalBrowser) {
            try {
                const data = await this.fetchOpenMeteo();
                if (data) return data;
            } catch (error) {
                console.error('[Weather] Open-Meteo не удался:', error.message);
            }

            try {
                const data = await this.fetchWttrIn();
                if (data) return data;
            } catch (error) {
                console.error('[Weather] wttr.in не удался:', error.message);
            }
        } else {
            try {
                const data = await this.fetchWttrIn();
                if (data) return data;
            } catch (error) {
                console.error('[Weather] wttr.in не удался:', error.message);
            }

            try {
                const data = await this.fetchOpenMeteo();
                if (data) return data;
            } catch (error) {
                console.error('[Weather] Open-Meteo не удался:', error.message);
            }
        }

        return null;
    }

    async fetchWithTimeout(url, options = {}, timeout = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('Таймаут запроса');
            }

            if (error instanceof TypeError) {
                throw new Error('CORS или сетевая ошибка');
            }

            throw error;
        }
    }

    async fetchWttrIn() {
        const url = `https://wttr.in/${encodeURIComponent(this.currentLocation)}?format=j1`;
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const makeAttempt = async () => {
            const response = await this.fetchWithTimeout(url, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-store',
                redirect: 'follow'
            }, 4500);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return this.normalizeWttrData(data);
        };

        try {
            return await makeAttempt();
        } catch (firstError) {
            if (firstError.message === 'CORS или сетевая ошибка') {
                throw firstError;
            }

            await sleep(250);
            return await makeAttempt();
        }
    }

    async fetchOpenMeteo() {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(this.currentLocation)}&count=1&language=ru&format=json&_=${Date.now()}`;

        const geoResponse = await this.fetchWithTimeout(geoUrl, {
            cache: 'no-store'
        }, 5000);

        if (!geoResponse.ok) {
            throw new Error(`Ошибка геокодинга: HTTP ${geoResponse.status}`);
        }

        const geoData = await geoResponse.json();
        if (!geoData.results?.[0]) {
            throw new Error('Город не найден');
        }

        const place = geoData.results[0];
        const { latitude, longitude, name, country, admin1 } = place;

        const currentFields = [
            'temperature_2m',
            'relative_humidity_2m',
            'apparent_temperature',
            'weather_code',
            'wind_speed_10m',
            'wind_direction_10m',
            'is_day'
        ].join(',');

        const weatherUrl =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${latitude}` +
            `&longitude=${longitude}` +
            `&current=${encodeURIComponent(currentFields)}` +
            `&timezone=auto` +
            `&_=${Date.now()}`;

        const weatherResponse = await this.fetchWithTimeout(weatherUrl, {
            cache: 'no-store'
        }, 5000);

        if (!weatherResponse.ok) {
            throw new Error(`Ошибка прогноза: HTTP ${weatherResponse.status}`);
        }

        const weatherData = await weatherResponse.json();
        return this.normalizeOpenMeteoData(weatherData, { name, country, admin1 });
    }

    // ===== Нормализация =====

    normalizeWttrData(data) {
        const current = data?.current_condition?.[0];
        const nearest = data?.nearest_area?.[0];
        const today = data?.weather?.[0];
        const currentByHour = this.findNearestWttrHourly(today?.hourly, current?.localObsDateTime);

        if (!current) {
            throw new Error('wttr.in: нет current_condition');
        }

        const locationName = nearest?.areaName?.[0]?.value || this.currentLocation;
        const regionName = nearest?.region?.[0]?.value || '';
        const countryName = nearest?.country?.[0]?.value || '';

        const location = locationName;

        const rawDescription =
            current.weatherDesc?.[0]?.value ||
            currentByHour?.weatherDesc?.[0]?.value ||
            'Неизвестно';

        const windText = this.formatWindKmh(current.windspeedKmph);
        const windArrow = this.getWindArrowFromCompass(current.winddir16Point);

        return {
            temp: this.formatTemp(current.temp_C),
            feelsLike: this.formatTemp(current.FeelsLikeC),
            description: this.translateWttrDescription(rawDescription),wind: windText ? `${windText}${windArrow ? ` ${windArrow}` : ''}` : null,
            humidity: this.formatPercent(current.humidity),
            location,
            source: 'wttr.in',
            raw: {
                provider: 'wttr.in',
                weatherCode: current.weatherCode || currentByHour?.weatherCode || null,
                observationTime: current.localObsDateTime || current.observation_time || null
            }
        };
    }

    normalizeOpenMeteoData(data, locationMeta = {}) {
        const current = data?.current;
        const units = data?.current_units || {};

        if (!current) {
            throw new Error('Open-Meteo: нет current');
        }

        const location = locationMeta.name || this.currentLocation;

        const windUnit = units.wind_speed_10m === 'km/h' ? 'км/ч' : (units.wind_speed_10m || 'км/ч');
        const windSpeed = this.formatNumberWithUnit(current.wind_speed_10m, windUnit);
        const windArrow = this.getWindArrowFromDegrees(current.wind_direction_10m);

        return {
            temp: this.formatNumberWithUnit(current.temperature_2m, units.temperature_2m || '°C', true),
            feelsLike: this.formatNumberWithUnit(current.apparent_temperature, units.apparent_temperature || '°C', true),
            description: this.getWeatherDescription(current.weather_code, current.is_day),
            wind: windSpeed ? `${windSpeed}${windArrow ? ` ${windArrow}` : ''}` : null,
            humidity: this.formatNumberWithUnit(current.relative_humidity_2m, units.relative_humidity_2m || '%'),
            location,
            source: 'Open-Meteo',
            raw: {
                provider: 'Open-Meteo',
                weatherCode: current.weather_code ?? null,
                observationTime: current.time || null
            }
        };
    }

    findNearestWttrHourly(hourly = [], localObsDateTime) {
        if (!Array.isArray(hourly) || !hourly.length || !localObsDateTime) return null;

        const hourMatch = String(localObsDateTime).match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
        if (!hourMatch) return null;

        let hours = parseInt(hourMatch[1], 10);
        const minutes = parseInt(hourMatch[2], 10);
        const meridiem = hourMatch[3].toUpperCase();

        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;

        const currentMinutes = hours * 60 + minutes;

        let nearest = null;
        let minDiff = Infinity;

        for (const item of hourly) {
            const rawTime = String(item?.time ?? '').padStart(4, '0');
            const hh = parseInt(rawTime.slice(0, 2), 10);
            const mm = parseInt(rawTime.slice(2, 4), 10);
            const slotMinutes = hh * 60 + mm;
            const diff = Math.abs(slotMinutes - currentMinutes);

            if (diff < minDiff) {
                minDiff = diff;
                nearest = item;
            }
        }

        return nearest;
    }

    // ===== Форматирование =====

    formatTemp(value) {
        if (value == null || value === '') return null;
        const num = Number(value);
        if (Number.isNaN(num)) return null;
        return `${Math.round(num)}°C`;
    }

    formatPercent(value) {
        if (value == null || value === '') return null;
        const num = Number(value);
        if (Number.isNaN(num)) return null;
        return `${Math.round(num)}%`;
    }

    formatWindKmh(value) {
        if (value == null || value === '') return null;
        const num = Number(value);
        if (Number.isNaN(num)) return null;
        return `${Math.round(num)} км/ч`;
    }

    formatNumberWithUnit(value, unit, roundTemp = false) {
        if (value == null || value === '') return null;

        const num = Number(value);
        if (Number.isNaN(num)) return null;

        const finalValue = roundTemp ? Math.round(num) : Math.round(num);
        return `${finalValue}${unit}`;
    }

    degreesToCompass(deg) {
        if (deg == null || deg === '' || Number.isNaN(Number(deg))) return '';

        const directions = ['С', 'ССВ', 'СВ', 'ВСВ', 'В', 'ВЮВ', 'ЮВ', 'ЮЮВ', 'Ю', 'ЮЮЗ', 'ЮЗ', 'ЗЮЗ', 'З', 'ЗСЗ', 'СЗ', 'ССЗ'];
        const index = Math.round(Number(deg) / 22.5) % 16;
        return directions[index];
    }

    // ===== Описания =====

    getWeatherDescription(code, isDay = 1) {
        const dayCodes = {
            0: 'Ясно',
            1: 'Преимущественно ясно',
            2: 'Переменная облачность',
            3: 'Пасмурно',
            45: 'Туман',
            48: 'Иней',
            51: 'Легкая морось',
            53: 'Морось',
            55: 'Сильная морось',
            56: 'Ледяная морось',
            57: 'Сильная ледяная морось',
            61: 'Небольшой дождь',
            63: 'Дождь',
            65: 'Сильный дождь',
            66: 'Ледяной дождь',
            67: 'Сильный ледяной дождь',
            71: 'Небольшой снег',
            73: 'Снег',
            75: 'Сильный снег',
            77: 'Снежные зерна',
            80: 'Небольшой ливень',
            81: 'Ливень',
            82: 'Сильный ливень',
            85: 'Небольшой снегопад',
            86: 'Сильный снегопад',
            95: 'Гроза',
            96: 'Гроза с небольшим градом',
            99: 'Сильная гроза с градом'
        };

        const nightCodes = {
            0: 'Ясная ночь',
            1: 'Преимущественно ясно',
            2: 'Переменная облачность',
            3: 'Пасмурно',
            45: 'Туман',
            48: 'Иней',
            51: 'Легкая морось',
            53: 'Морось',
            55: 'Сильная морось',
            56: 'Ледяная морось',
            57: 'Сильная ледяная морось',
            61: 'Небольшой дождь',
            63: 'Дождь',
            65: 'Сильный дождь',
            66: 'Ледяной дождь',
            67: 'Сильный ледяной дождь',
            71: 'Небольшой снег',
            73: 'Снег',
            75: 'Сильный снег',
            77: 'Снежные зерна',
            80: 'Небольшой ливень',
            81: 'Ливень',
            82: 'Сильный ливень',
            85: 'Небольшой снегопад',
            86: 'Сильный снегопад',
            95: 'Гроза',
            96: 'Гроза с небольшим градом',
            99: 'Сильная гроза с градом'
        };

        const map = Number(isDay) === 0 ? nightCodes : dayCodes;
        return map[code] || 'Неизвестно';
    }

    translateWttrDescription(description) {
        if (!description) return 'Неизвестно';

        const normalized = description.toLowerCase().trim();

        const map = {
            'sunny': 'Солнечно',
            'clear': 'Ясно',
            'clear ': 'Ясно',
            'partly cloudy': 'Переменная облачность',
            'partly cloudy ': 'Переменная облачность',
            'cloudy': 'Облачно',
            'cloudy ': 'Облачно',
            'overcast': 'Пасмурно',
            'overcast ': 'Пасмурно',
            'mist': 'Дымка',
            'fog': 'Туман',
            'freezing fog': 'Переохлажденный туман',
            'patchy rain nearby': 'Местами дождь поблизости',
            'light drizzle': 'Легкая морось',
            'drizzle': 'Морось',
            'light rain': 'Небольшой дождь',
            'moderate rain': 'Дождь',
            'heavy rain': 'Сильный дождь',
            'light snow': 'Небольшой снег',
            'moderate snow': 'Снег',
            'heavy snow': 'Сильный снег',
            'moderate or heavy snow showers': 'Умеренные или сильные снежные заряды',
            'thunderstorm': 'Гроза',
            'blizzard': 'Метель'
        };

        return map[normalized] || description.trim();
    }

    getWeatherIcon(description) {
        if (!description) return '🌡️';

        const desc = description.toLowerCase().trim();

        const allMappings = {
            'ясная ночь': '🌙',
            'преимущественно ясно': '🌤️',
            'переменная облачность': '⛅',
            'небольшой дождь': '🌦️',
            'сильный дождь': '🌧️',
            'ледяной дождь': '🌧️',
            'сильный ледяной дождь': '🌧️',
            'гроза с небольшим градом': '⛈️',
            'сильная гроза с градом': '⛈️',
            'небольшой снег': '🌨️',
            'сильный снег': '❄️',
            'небольшой снегопад': '🌨️',
            'сильный снегопад': '❄️',
            'местами дождь поблизости': '🌦️',
            'умеренные или сильные снежные заряды': '❄️',
            'солнечно': '☀️',
            'ясно': '☀️',
            'пасмурно': '☁️',
            'облачно': '☁️',
            'туман': '🌫️',
            'дымка': '🌫️',
            'морось': '🌦️',
            'ливень': '🌧️',
            'дождь': '🌧️',
            'гроза': '⛈️',
            'снег': '❄️',
            'снежные зерна': '🌨️',
            'метель': '❄️'
        };

        const sortedKeys = Object.keys(allMappings).sort((a, b) => b.length - a.length);

        for (const key of sortedKeys) {
            if (desc.includes(key)) {
                return allMappings[key];
            }
        }

        return '🌡️';
    }

    getWindArrowFromCompass(dir) {
        if (!dir) return '';
        
        const map = {
            N:'↓', NNE:'↙', NE:'↙', ENE:'↙', E:'←', ESE:'↖', SE:'↖', SSE:'↖',
            S:'↑', SSW:'↗', SW:'↗', WSW:'↗', W:'→', WNW:'↘', NW:'↘', NNW:'↘',
            С:'↓', ССВ:'↙', СВ:'↙', ВСВ:'↙', В:'←', ВЮВ:'↖', ЮВ:'↖', ЮЮВ:'↖',
            Ю:'↑', ЮЮЗ:'↗', ЮЗ:'↗', ЗЮЗ:'↗', З:'→', ЗСЗ:'↘', СЗ:'↘', ССЗ:'↘'
        };
        
        return map[String(dir).trim().toUpperCase()] || '';
    }

    getWindArrowFromDegrees(deg) {
        if (deg == null || deg === '' || Number.isNaN(Number(deg))) return '';
        
        const arrows = ['↓', '↙', '↙', '↙', '←', '↖', '↖', '↖', '↑', '↗', '↗', '↗', '→', '↘', '↘', '↘'];
        const idx = Math.round(Number(deg) / 22.5) % 16;
        
        return arrows[idx];
    }

    // ===== Отображение =====

    displayWeather() {
        const contentDiv = this.elements.content;
        const locationDiv = this.elements.location;
        const weather = this.currentWeather;

        if (!contentDiv || !weather) return;

        if (locationDiv) {
            locationDiv.textContent = weather.location || this.currentLocation;
        }

        const updateTimeStr = this.lastUpdate
            ? this.lastUpdate.toLocaleString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'кэш';

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

        const tempNum = parseInt(weather.temp, 10);
        let tempColor = 'var(--text-primary)';
        if (tempNum > 25) tempColor = '#ff7a7a';
        else if (tempNum < 0) tempColor = '#7ab0ff';
        else if (tempNum > 15) tempColor = '#4caf50';

        contentDiv.innerHTML = `
            <div class="weather-main">
                <div class="weather-temp-row">
                    <span class="weather-temp" style="color: ${tempColor}">${weather.temp} ${this.getWeatherIcon(weather.description)}</span>
                </div>
                <div class="weather-desc">${weather.description || 'Неизвестно'}</div>
                ${chips.length ? `<div class="weather-details">${chips.join('')}</div>` : ''}
            </div>
            <div class="weather-meta">
                <span>🕐 ${updateTimeStr}</span>
                ${weather.source ? `<span class="weather-source">${weather.source}</span>` : ''}
            </div>
        `;
    }

    // ===== События =====

    handleSetLocation() {
        this.showLocationPrompt();
    }

    handleFetchWeather() {
        this.fetchWeather();
    }
}

export default WeatherWidget;