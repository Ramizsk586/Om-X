document.addEventListener('DOMContentLoaded', () => {
    const els = {
        input: document.getElementById('todo-input'),
        btnAdd: document.getElementById('btn-add'),
        list: document.getElementById('todo-list'),
        btnOrganize: document.getElementById('btn-ai-organize'),
        btnClearCompleted: document.getElementById('btn-clear-completed'),
        countActive: document.getElementById('count-active'),
        countCompleted: document.getElementById('count-completed'),
        countTotal: document.getElementById('count-total'),
        filterTabs: document.querySelectorAll('.filter-tab')
    };

    let todos = [];
    let currentFilter = 'all';

    const loadTodos = () => {
        const saved = localStorage.getItem('omni_tasks');
        if (saved) {
            todos = JSON.parse(saved);
            render();
        }
    };

    const saveTodos = () => {
        localStorage.setItem('omni_tasks', JSON.stringify(todos));
        updateStats();
    };

    const updateStats = () => {
        const active = todos.filter(t => !t.completed).length;
        const completed = todos.filter(t => t.completed).length;
        const total = todos.length;

        els.countActive.textContent = active;
        els.countCompleted.textContent = completed;
        els.countTotal.textContent = total;
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getFilteredTodos = () => {
        switch (currentFilter) {
            case 'active':
                return todos.filter(t => !t.completed);
            case 'completed':
                return todos.filter(t => t.completed);
            default:
                return todos;
        }
    };

    const render = () => {
        const filteredTodos = getFilteredTodos();

        if (filteredTodos.length === 0) {
            els.list.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                    <h3>No tasks found</h3>
                    <p>${currentFilter === 'all' ? 'Add a new task to get started' : `No ${currentFilter} tasks`}</p>
                </div>
            `;
            return;
        }

        els.list.innerHTML = '';
        filteredTodos.forEach(todo => {
            const item = document.createElement('div');
            item.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.priority ? 'priority-' + todo.priority : ''}`;

            const priorityBadge = todo.priority ?
                `<span class="priority-badge ${todo.priority}">${todo.priority}</span>` : '';

            item.innerHTML = `
                <div class="check-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <span class="todo-text">${todo.text}</span>
                <div class="todo-meta">
                    <span class="todo-time">${formatTime(todo.created)}</span>
                    ${priorityBadge}
                    <button class="btn-delete">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `;

            item.querySelector('.check-btn').onclick = () => {
                todo.completed = !todo.completed;
                saveTodos();
                render();
            };

            item.querySelector('.btn-delete').onclick = () => {
                todos = todos.filter(t => t.id !== todo.id);
                saveTodos();
                render();
            };

            els.list.appendChild(item);
        });
        updateStats();
    };

    const addTodo = (text) => {
        if (!text.trim()) return;

        // Detect priority from text
        let priority = null;
        const lowerText = text.toLowerCase();
        if (lowerText.includes('!!!') || lowerText.includes('urgent') || lowerText.includes('important')) {
            priority = 'high';
        } else if (lowerText.includes('!!') || lowerText.includes('soon')) {
            priority = 'medium';
        } else if (lowerText.includes('!')) {
            priority = 'low';
        }

        todos.unshift({
            id: Date.now(),
            text: text.trim(),
            completed: false,
            priority: priority,
            created: Date.now()
        });
        els.input.value = '';
        saveTodos();
        render();
    };

    const setFilter = (filter) => {
        currentFilter = filter;
        els.filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });
        render();
    };

    // Event Listeners
    els.btnAdd.onclick = () => addTodo(els.input.value);
    els.input.onkeydown = (e) => { if (e.key === 'Enter') addTodo(els.input.value); };

    els.filterTabs.forEach(tab => {
        tab.onclick = () => setFilter(tab.dataset.filter);
    });

    els.btnClearCompleted.onclick = () => {
        todos = todos.filter(t => !t.completed);
        saveTodos();
        render();
    };

    els.btnOrganize.onclick = async () => {
        const activeTodos = todos.filter(t => !t.completed);
        if (activeTodos.length === 0) return;

        const originalText = els.btnOrganize.innerHTML;
        els.btnOrganize.innerHTML = `
            <svg class="spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            ORCHESTRATING...
        `;
        els.btnOrganize.disabled = true;

        try {
            const taskList = activeTodos.map(t => t.text).join('\n');
            const prompt = `Act as a productivity expert. Organize the following tasks into a logical execution order. Groups related tasks. Output ONLY a clean list of tasks, one per line. Do not add headers or commentary. Tasks:\n${taskList}`;

            const res = await window.browserAPI.ai.performTask({ text: prompt });
            if (res && res.text) {
                const newLines = res.text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('-') && !l.startsWith('*'));
                if (newLines.length > 0) {
                    // Keep completed tasks, reorder active ones
                    const completedTasks = todos.filter(t => t.completed);
                    const reorderedTodos = newLines.map((text, i) => ({
                        id: Date.now() + i,
                        text: text.replace(/^[!\d\.]+\s*/, ''), // Remove numbering
                        completed: false,
                        priority: activeTodos.find(t => t.text.includes(text.substring(0, 20)))?.priority || null,
                        created: Date.now()
                    }));

                    todos = [...completedTasks, ...reorderedTodos];
                    saveTodos();
                    render();
                }
            }
        } catch (e) {
            console.error("AI Organize failed", e);
        } finally {
            els.btnOrganize.innerHTML = originalText;
            els.btnOrganize.disabled = false;
        }
    };

    // Add spin animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
    `;
    document.head.appendChild(style);

    loadTodos();
});
