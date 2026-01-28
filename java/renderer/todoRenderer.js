document.addEventListener('DOMContentLoaded', () => {
    const els = {
        input: document.getElementById('todo-input'),
        btnAdd: document.getElementById('btn-add'),
        list: document.getElementById('todo-list'),
        activeCount: document.getElementById('active-count'),
        btnOrganize: document.getElementById('btn-ai-organize'),
        dateLabel: document.getElementById('date-label'),
        btnClose: document.getElementById('btn-close')
    };

    let todos = [];

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
        els.activeCount.textContent = active;
    };

    const render = () => {
        els.list.innerHTML = '';
        todos.forEach(todo => {
            const item = document.createElement('div');
            item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            item.innerHTML = `
                <div class="check-btn">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <span class="todo-text">${todo.text}</span>
                <div class="btn-delete">✕</div>
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
        todos.unshift({
            id: Date.now(),
            text: text.trim(),
            completed: false
        });
        els.input.value = '';
        saveTodos();
        render();
    };

    els.btnAdd.onclick = () => addTodo(els.input.value);
    els.input.onkeydown = (e) => { if (e.key === 'Enter') addTodo(els.input.value); };

    els.btnOrganize.onclick = async () => {
        if (todos.length === 0) return;
        els.btnOrganize.textContent = "ORCHESTRATING...";
        els.btnOrganize.disabled = true;

        try {
            const taskList = todos.map(t => t.text).join('\n');
            const prompt = `Act as a productivity expert. Organize the following tasks into a logical execution order. Groups related tasks. Output ONLY a clean list of tasks, one per line. Do not add headers or commentary. Tasks:\n${taskList}`;
            
            const res = await window.browserAPI.ai.performTask({ text: prompt });
            if (res && res.text) {
                const newLines = res.text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('-') && !l.startsWith('*'));
                if (newLines.length > 0) {
                    todos = newLines.map((text, i) => ({ id: Date.now() + i, text, completed: false }));
                    saveTodos();
                    render();
                }
            }
        } catch (e) {
            console.error("AI Organize failed", e);
        } finally {
            els.btnOrganize.textContent = "OMNI ORCHESTRATE";
            els.btnOrganize.disabled = false;
        }
    };

    els.btnClose.onclick = () => {
        // If in a tab, navigate home
        window.browserAPI.navigate('../../html/pages/home.html');
    };

    const d = new Date();
    els.dateLabel.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    loadTodos();
});