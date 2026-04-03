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
        // Пробуем wttr.in с полной обработкой всех ошибок
        let wttrSuccess = false;
        
        try {
            console.log('[Weather] Пробуем wttr.in...');
            const data = await this.fetchWttrIn();
            if (data) {
                console.log('[Weather] wttr.in успешно');
                return data;
            }
            wttrSuccess = true;
        } catch (error) {
            console.error('[Weather] wttr.in критическая ошибка:', error.message);
            console.error('[Weather] Тип ошибки:', error.name);
        }
        
        // Если wttr.in не вернул данные (любая причина) — пробуем Open-Meteo
        if (!wttrSuccess) {
            console.log('[Weather] Переключение на Open-Meteo...');
            try {
                const data = await this.fetchOpenMeteo();
                if (data) {
                    console.log('[Weather] Open-Meteo успешно');
                    return data;
                }
            } catch (error) {
                console.error('[Weather] Open-Meteo ошибка:', error.message);
            }
        }
        
        console.log('[Weather] Все API недоступны');
        return null;
    }

    async fetchWttrIn() {
        const baseUrl = `https://wttr.in/${encodeURIComponent(this.currentLocation)}?format=j1`;

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const parseWeather = (text) => {
            if (!text || typeof text !== 'string') {
                throw new Error('Пустой ответ');
            }

            if (text.length < 100) {
                throw new Error('Ответ слишком короткий');
            }

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('Невалидный JSON');
            }

            if (!data || typeof data !== 'object') {
                throw new Error('Ответ не является объектом');
            }

            if (!data.current_condition || !data.current_condition[0]) {
                throw new Error('Нет current_condition');
            }

            if (!data.nearest_area?.[0]?.areaName?.[0]?.value) {
                throw new Error('Нет локации');
            }

            const current = data.current_condition[0];

            if (current.temp_C == null || current.FeelsLikeC == null) {
                throw new Error('Нет температуры');
            }

            return {
                temp: `${current.temp_C}°C`,
                feelsLike: `${current.FeelsLikeC}°C`,
                description: current.lang_ru?.[0]?.value || current.weatherDesc?.[0]?.value || 'Неизвестно',
                wind: `${current.windspeedKmph || 0} км/ч`,
                humidity: `${current.humidity || 0}%`,
                location: data.nearest_area[0].areaName[0].value,
                source: 'wttr.in'
            };
        };

        const makeAttempt = async (attempt) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            try {
                const response = await fetch(baseUrl, {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-store',
                    redirect: 'follow',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                console.log(`[Weather] wttr.in попытка ${attempt}, статус:`, response.status);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const text = await response.text();
                console.log(`[Weather] wttr.in попытка ${attempt}, байт:`, text.length);

                try {
                    return parseWeather(text);
                } catch (parseError) {
                    console.error(`[Weather] wttr.in попытка ${attempt}, плохой ответ:`, parseError.message);
                    console.error('[Weather] Начало ответа:', text.slice(0, 200));
                    console.error('[Weather] Конец ответа:', text.slice(-200));
                    throw parseError;
                }
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
        };

        try {
            return await makeAttempt(1);
        } catch (firstError) {
            console.warn('[Weather] Первая попытка не удалась:', firstError.message);

            if (firstError.message === 'CORS или сетевая ошибка') {
                throw firstError;
            }

            await sleep(250);

            try {
                return await makeAttempt(2);
            } catch (secondError) {
                console.error('[Weather] Вторая попытка тоже не удалась:', secondError.message);
                throw secondError;
            }
        }
    }

    async fetchOpenMeteo() {
        // Геокодинг
        const cacheBuster = Date.now();
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(this.currentLocation)}&count=1&language=ru&format=json&_=${cacheBuster}`;
        
        const geoResponse = await fetch(geoUrl, { cache: 'no-store' });
        const geoData = await geoResponse.json();
        
        if (!geoData.results?.[0]) {
            throw new Error('Город не найден');
        }

        const { latitude, longitude, name, country } = geoData.results[0];
        
        // Получаем погоду
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto&_=${Date.now()}`;
        const weatherResponse = await fetch(weatherUrl, { cache: 'no-store' });
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