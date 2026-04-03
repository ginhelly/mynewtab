/**
 * Модуль списка задач с localStorage
 * Поддержка добавления, удаления, переключения статуса
 */

import MarkdownParser from '../utils/markdownParser.js';


class TodoList {
    constructor(options = {}) {
        this.options = {
            storageKey: options.storageKey || 'todos',
            maxItems: options.maxItems || 100,
            ...options
        };

        this.todos = [];
        
        // DOM элементы
        this.elements = {
            input: document.getElementById('todoInput'),
            list: document.getElementById('todoList')
        };

        // Привязка методов
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    /**
     * Инициализация списка
     */
    init() {
        this.loadTodos();
        this.bindEvents();
        this.autoResize();
        this.render();
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        if (this.elements.input) {
            this.elements.input.addEventListener('keydown', this.handleKeydown);
            this.elements.input.addEventListener('input', () => this.autoResize());  // Добавить
        }
        
        if (this.elements.list) {
            this.elements.list.addEventListener('click', this.handleClick);
        }
    }

    /**
     * Уничтожение модуля
     */
    destroy() {
        if (this.elements.input) {
            this.elements.input.removeEventListener('keydown', this.handleKeydown);
        }
        
        if (this.elements.list) {
            this.elements.list.removeEventListener('click', this.handleClick);
        }
    }

    // ===== Хранилище =====

    loadTodos() {
        try {
            const saved = localStorage.getItem(this.options.storageKey);
            this.todos = saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('[Todo] Ошибка загрузки:', e);
            this.todos = [];
        }
    }

    saveTodos() {
        try {
            localStorage.setItem(this.options.storageKey, JSON.stringify(this.todos));
        } catch (e) {
            console.error('[Todo] Ошибка сохранения:', e);
        }
    }

    // ===== CRUD операции =====

    add(text) {
        const trimmed = text.trim();
        if (!trimmed) return false;
        
        if (this.todos.length >= this.options.maxItems) {
            alert(`Максимум ${this.options.maxItems} заметок`);
            return false;
        }

        const todo = {
            id: Date.now(),
            text: trimmed,
            createdAt: new Date().toISOString()
        };

        this.todos.unshift(todo);
        this.saveTodos();
        this.render();
        
        return true;
    }

    remove(id) {
        this.todos = this.todos.filter(todo => todo.id !== id);
        this.saveTodos();
        this.render();
    }

    // ===== Рендеринг =====

    render() {
        if (!this.elements.list) return;

        if (this.todos.length === 0) {
            this.elements.list.innerHTML = '<li class="todo-empty">Нет заметок</li>';
            return;
        }

        this.elements.list.innerHTML = this.todos.map(todo => `
            <li class="todo-item" data-id="${todo.id}">
                <span class="todo-text">${MarkdownParser.parse(todo.text)}</span>
                <div class="todo-actions">
                    <button class="btn-delete" title="Удалить">✕</button>
                </div>
            </li>
        `).join('');
    }

    autoResize() {
        if (!this.elements.input) return;
        
        const input = this.elements.input;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px'; // макс 200px
    }

    // ===== Обработчики =====

    handleKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {  // Добавляем проверку на Shift+Enter
            event.preventDefault();  // Предотвращаем добавление перевода строки
            const success = this.add(this.elements.input.value);
            if (success) {
                this.elements.input.value = '';
                this.autoResize();  // Сбрасываем высоту textarea
            }
        }
    }

    handleClick(event) {
        const button = event.target.closest('.btn-delete');
        if (!button) return;

        const li = button.closest('li');
        if (!li) return;

        const id = parseInt(li.dataset.id, 10);
        if (id) {
            this.remove(id);
        }
    }

    // ===== Публичные методы =====

    getStats() {
        return { total: this.todos.length };
    }

    export() {
        return JSON.stringify(this.todos, null, 2);
    }

    import(json) {
        try {
            const data = JSON.parse(json);
            if (Array.isArray(data)) {
                this.todos = data.slice(0, this.options.maxItems);
                this.saveTodos();
                this.render();
                return true;
            }
        } catch (e) {
            console.error('[Todo] Ошибка импорта:', e);
        }
        return false;
    }
}

export default TodoList;