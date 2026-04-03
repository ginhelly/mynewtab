/**
 * Модуль часов с поддержкой UTC+4 (Самара/Ижевск)
 * Автообновление каждую секунду
 */

class Clock {
    constructor(options = {}) {
        // Настройки по умолчанию
        this.timezoneOffset = options.timezoneOffset || 4; // UTC+4
        this.updateInterval = options.updateInterval || 1000; // 1 секунда
        
        // DOM элементы
        this.elements = {
            time: document.getElementById('clock-main'),
            date: document.getElementById('clock-date'),
            weekday: document.getElementById('clock-weekday')
        };
        
        // Форматтеры
        this.formatters = {
            date: new Intl.DateTimeFormat("ru", { 
                day: 'numeric', 
                month: 'long' 
            }),
            weekday: new Intl.DateTimeFormat("ru", { 
                weekday: 'long' 
            })
        };
        
        this.intervalId = null;
        this.isRunning = false;
    }

    /**
     * Получает локальное время с учетом смещения
     * @returns {Date}
     */
    getLocalTime() {
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utcTime + (this.timezoneOffset * 3600000));
    }

    /**
     * Форматирует время как HH:MM
     * @param {Date} date 
     * @returns {string}
     */
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    /**
     * Обновляет отображение часов
     */
    update() {
        if (!this.elements.time) return;
        
        const localTime = this.getLocalTime();
        
        // Обновляем время
        this.elements.time.textContent = this.formatTime(localTime);
        
        // Обновляем дату (только если изменилась)
        const newDate = this.formatters.date.format(localTime);
        if (this.elements.date && this.elements.date.textContent !== newDate) {
            this.elements.date.textContent = newDate;
        }
        
        // Обновляем день недели (только если изменился)
        const newWeekday = this.formatters.weekday.format(localTime);
        if (this.elements.weekday && this.elements.weekday.textContent !== newWeekday) {
            this.elements.weekday.textContent = newWeekday;
        }
    }

    /**
     * Запускает часы
     */
    start() {
        if (this.isRunning) return;
        
        // Первое обновление сразу
        this.update();
        
        // Затем каждую секунду
        this.intervalId = setInterval(() => this.update(), this.updateInterval);
        this.isRunning = true;
        
        console.log('[Clock] Запущены');
    }

    /**
     * Останавливает часы
     */
    stop() {
        if (!this.isRunning) return;
        
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        
        console.log('[Clock] Остановлены');
    }

    /**
     * Перезапускает часы (например, при смене настроек)
     */
    restart() {
        this.stop();
        this.start();
    }

    /**
     * Изменяет часовой пояс
     * @param {number} offset - Смещение от UTC в часах
     */
    setTimezone(offset) {
        this.timezoneOffset = offset;
        this.update();
    }
}

// Экспорт для использования в других модулях
export default Clock;