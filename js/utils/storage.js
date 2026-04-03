/**
 * Утилиты для работы с localStorage
 * С обработкой ошибок и JSON сериализацией
 */

const Storage = {
    /**
     * Получить значение
     * @param {string} key - Ключ
     * @param {*} defaultValue - Значение по умолчанию
     * @returns {*}
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            
            // Пытаемся распарсить JSON
            try {
                return JSON.parse(item);
            } catch {
                return item; // Возвращаем как строку если не JSON
            }
        } catch (e) {
            console.error(`[Storage] Ошибка чтения "${key}":`, e);
            return defaultValue;
        }
    },

    /**
     * Сохранить значение
     * @param {string} key - Ключ
     * @param {*} value - Значение
     * @returns {boolean}
     */
    set(key, value) {
        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error(`[Storage] Превышен лимит хранилища`);
            } else {
                console.error(`[Storage] Ошибка записи "${key}":`, e);
            }
            return false;
        }
    },

    /**
     * Удалить значение
     * @param {string} key - Ключ
     * @returns {boolean}
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error(`[Storage] Ошибка удаления "${key}":`, e);
            return false;
        }
    },

    /**
     * Проверить существование ключа
     * @param {string} key - Ключ
     * @returns {boolean}
     */
    has(key) {
        return localStorage.getItem(key) !== null;
    },

    /**
     * Получить все ключи по префиксу
     * @param {string} prefix - Префикс
     * @returns {string[]}
     */
    keysByPrefix(prefix) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        return keys;
    },

    /**
     * Очистить по префиксу
     * @param {string} prefix - Префикс
     * @returns {number} - Количество удалённых ключей
     */
    clearByPrefix(prefix) {
        const keys = this.keysByPrefix(prefix);
        keys.forEach(key => this.remove(key));
        return keys.length;
    },

    /**
     * Получить размер хранилища в байтах
     * @returns {number}
     */
    getSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
            }
        }
        return total;
    },

    /**
     * Экспорт всех данных
     * @returns {string} - JSON строка
     */
    export() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                data[key] = this.get(key);
            }
        }
        return JSON.stringify(data, null, 2);
    },

    /**
     * Импорт данных
     * @param {string} json - JSON строка
     * @param {boolean} merge - Объединять или заменять
     * @returns {boolean}
     */
    import(json, merge = true) {
        try {
            const data = JSON.parse(json);
            
            if (!merge) {
                localStorage.clear();
            }
            
            Object.entries(data).forEach(([key, value]) => {
                this.set(key, value);
            });
            
            return true;
        } catch (e) {
            console.error('[Storage] Ошибка импорта:', e);
            return false;
        }
    }
};

export default Storage;