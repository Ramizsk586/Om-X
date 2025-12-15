


// Global references for Lazy Loaded modules
let GoogleGenAI = null;
let TerminalClass = null;
let FitAddonClass = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Light Initialization (Fast Paint)
    setupUIEventHandlers();
    
    // 2. Schedule Heavy Loads (Lazy)
    requestAnimationFrame(() => {
        // Yield to let the browser paint the initial HTML
        setTimeout(() => {
            initMonacoEditor();
            // Sync settings lazily in background
            syncAISettings();
            
            // Explicitly disable explorer buttons on start
            setExplorerEnabled(false);
        }, 10);
    });
});

// UI Elements (Cached for scope)
let editor = null;
let diffEditor = null;
let term = null;
let fitAddon = null;

// AI State
let chatSession = null; 
let chatHistory = []; 
let aiConfig = {
    provider: 'google',
    apiKey: '',
    model: 'gemini-2.5-flash'
};

// State
let currentFilePath = null; 
let filename = 'untitled.txt';
let rootFolderPath = null;
let explorer = null;

// --- 1. UI Setup (Fast) ---
function setupUIEventHandlers() {
    console.log("Text Editor: Fast UI Setup");
    
    // Attach listeners immediately so buttons work even if editor is loading
    const attach = (id, handler) => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('click', handler);
    };

    attach('btn-open', openFile);
    attach('btn-save', saveFile);
    attach('btn-open-folder', () => getExplorer().openFolder());
    attach('btn-toggle-sidebar', toggleSidebar);
    attach('btn-toggle-terminal', toggleTerminal);
    
    // Terminal / Output Logic
    attach('btn-term-close', () => {
        document.getElementById('terminal-panel').classList.add('hidden');
        document.getElementById('terminal-resizer').classList.add('hidden');
        if (editor) editor.layout();
    });

    attach('btn-term-clear', () => {
        const activeTab = document.querySelector('.term-tab.active');
        if (activeTab && activeTab.id === 'tab-output') {
             document.getElementById('output-panel').textContent = '';
        } else {
             if (term) term.clear();
        }
    });

    // Terminal Tabs
    const tabTerminal = document.getElementById('tab-terminal');
    const tabOutput = document.getElementById('tab-output');
    
    if (tabTerminal) {
        tabTerminal.addEventListener('click', () => {
            tabTerminal.classList.add('active');
            tabOutput.classList.remove('active');
            document.getElementById('terminal-body').classList.remove('hidden');
            document.getElementById('output-panel').classList.add('hidden');
            if (fitAddon) fitAddon.fit();
        });
    }

    if (tabOutput) {
        tabOutput.addEventListener('click', () => {
            tabOutput.classList.add('active');
            tabTerminal.classList.remove('active');
            document.getElementById('terminal-body').classList.add('hidden');
            document.getElementById('output-panel').classList.remove('hidden');
        });
    }
    
    // AI Toggles (Lazy Load AI when clicked)
    attach('btn-ai-toggle', async () => {
        const aiSidebar = document.getElementById('ai-sidebar');
        aiSidebar.classList.toggle('hidden');
        if (!aiSidebar.classList.contains('hidden')) {
             document.getElementById('ai-prompt-input').focus();
             if (editor) editor.layout();
             // Lazy load AI module
             if (!GoogleGenAI) await loadAIModule();
             syncAISettings();
        }
    });

    attach('btn-ai-close', () => {
        document.getElementById('ai-sidebar').classList.add('hidden');
        if (editor) editor.layout();
    });

    // Run Button
    attach('btn-run', () => {
        if (editor && window.browserAPI && window.browserAPI.runHtml) {
            window.browserAPI.runHtml(editor.getValue());
            appendOutput(`[${new Date().toLocaleTimeString()}] Running HTML Preview...`);
        }
    });

    // Setup Resizers and Drag/Drop listeners
    setupResizers();
    setupDragDrop();
    
    // Initialize Explorer Class (Lightweight)
    explorer = new FileExplorer();
    explorer.render(); // Render empty state
    
    // Button listeners for explorer
    attach('btn-new-file', () => explorer.createNewFile());
    attach('btn-new-folder', () => explorer.createNewFolder());
    attach('btn-refresh-explorer', () => explorer.refresh());
    attach('btn-open-folder-sidebar', () => explorer.openFolder()); // Backup button logic, but handled dynamically in render too
}

function setupResizers() {
    // Terminal Resizer
    const resizer = document.getElementById('terminal-resizer');
    const panel = document.getElementById('terminal-panel');
    let isResizing = false;

    if (resizer && panel) {
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('active');
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const h = document.body.clientHeight - e.clientY - 24; // 24 = statusbar
            if (h > 50 && h < document.body.clientHeight - 100) {
                panel.style.height = `${h}px`;
                if (editor) editor.layout();
                if (fitAddon) fitAddon.fit();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('active');
                document.body.style.cursor = '';
                if (editor) editor.layout();
                if (fitAddon) fitAddon.fit();
            }
        });
    }

    // Debounced Resize Observer for layout
    let resizeTimeout;
    const observer = new ResizeObserver(() => {
        if(resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (editor) editor.layout();
            if (diffEditor) diffEditor.layout();
            if (term && fitAddon && !document.getElementById('terminal-panel').classList.contains('hidden')) {
                 try { fitAddon.fit(); } catch(e){}
            }
        }, 100);
    });
    observer.observe(document.getElementById('editor-container'));
}

function setupDragDrop() {
    const overlay = document.getElementById('drag-overlay');
    let counter = 0;

    window.addEventListener('dragenter', (e) => { e.preventDefault(); counter++; if(overlay) overlay.classList.remove('hidden'); });
    window.addEventListener('dragleave', (e) => { e.preventDefault(); counter--; if(counter === 0 && overlay) overlay.classList.add('hidden'); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        counter = 0;
        if(overlay) overlay.classList.add('hidden');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            loadFileFromDrag(e.dataTransfer.files[0]);
        }
    });
}

function loadFileFromDrag(file) {
    filename = file.name;
    document.getElementById('file-info').textContent = filename;
    const lang = detectLanguage(filename);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        if (editor) {
            editor.setValue(ev.target.result);
            updateLanguageUI(lang);
            appendAiMessage('system', `Loaded ${filename}.`);
            appendOutput(`Opened file: ${filename}`);
        }
    };
    reader.readAsText(file);
}

function appendOutput(msg) {
    const out = document.getElementById('output-panel');
    if (out) {
        const line = document.createElement('div');
        line.style.padding = '4px 8px';
        line.style.borderBottom = '1px solid #333';
        line.style.fontFamily = 'monospace';
        line.style.fontSize = '12px';
        line.textContent = msg;
        out.appendChild(line);
        out.scrollTop = out.scrollHeight;
    }
}

// --- 2. Heavy Loads (Lazy) ---

async function loadAIModule() {
    try {
        const mod = await import("@google/genai");
        GoogleGenAI = mod.GoogleGenAI;
        // Attach AI listeners now that module is ready
        const btnSubmit = document.getElementById('btn-ai-submit');
        const input = document.getElementById('ai-prompt-input');
        const btnFix = document.getElementById('btn-ai-fix');
        
        if (btnSubmit) btnSubmit.addEventListener('click', handleAiSubmit);
        if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); }});
        if (input) input.addEventListener('input', () => btnSubmit.disabled = !input.value.trim());
        if (btnFix) btnFix.addEventListener('click', handleAiFix);
        
        console.log("AI Module Loaded");
    } catch (e) { console.error("Failed to load GenAI", e); }
}

async function loadTerminalModule() {
    if (TerminalClass) return;
    try {
        const xterm = await import("xterm");
        const addon = await import("xterm-addon-fit");
        TerminalClass = xterm.Terminal;
        FitAddonClass = addon.FitAddon;
        console.log("Terminal Module Loaded");
    } catch(e) { console.error("Failed to load xterm", e); }
}

function initMonacoEditor() {
    if (!window.require) return; // Monaco loader missing
    
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }});

    require(['vs/editor/editor.main'], function() {
        // Remove loading spinner
        const root = document.getElementById('monaco-editor-root');
        root.innerHTML = ''; 

        try {
            if (monaco.languages.typescript) {
                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
            }

            editor = monaco.editor.create(root, {
                value: '<!-- Welcome to Om-X Text Studio -->\n<!-- Drop a file or type away -->',
                language: 'html',
                theme: 'vs-dark',
                automaticLayout: false, 
                minimap: { enabled: true, renderCharacters: false },
                fontSize: 13,
                fontFamily: "'Fira Code', 'Consolas', monospace",
                lineHeight: 22,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth'
            });

            diffEditor = monaco.editor.createDiffEditor(document.getElementById('diff-editor-root'), {
                theme: 'vs-dark',
                automaticLayout: false,
                renderSideBySide: true,
                originalEditable: false,
                readOnly: true
            });

            // Bind Events
            editor.onDidChangeCursorPosition((e) => {
                document.getElementById('status-cursor').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
            });
            editor.onDidChangeModelContent(() => setUnsaved(true));
            editor.onDidChangeModelLanguage((e) => updateLanguageUI(e.newLanguage));
            
            // Keybindings
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveFile);
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, openFile);

            console.log("Monaco Initialized");
            updateLanguageUI('html');
            
        } catch(e) {
            root.textContent = "Editor Error: " + e.message;
        }
    });
}

// --- Terminal Logic ---
async function toggleTerminal() {
    const panel = document.getElementById('terminal-panel');
    const resizer = document.getElementById('terminal-resizer');
    
    const isHidden = panel.classList.contains('hidden');
    
    if (isHidden) {
        // Show
        panel.classList.remove('hidden');
        resizer.classList.remove('hidden');
        
        // Ensure default tab is correct
        const termTab = document.getElementById('tab-terminal');
        const outputTab = document.getElementById('tab-output');
        
        // Logic: if neither is active, default to terminal
        if (!termTab.classList.contains('active') && !outputTab.classList.contains('active')) {
            termTab.classList.add('active');
            document.getElementById('terminal-body').classList.remove('hidden');
        }

        // Lazy Load xterm if needed
        if (!term) {
            panel.querySelector('#terminal-body').textContent = 'Initializing shell environment...';
            await loadTerminalModule();
            initTerminalInstance(rootFolderPath);
        }
        
        setTimeout(() => {
            if (fitAddon) fitAddon.fit();
            if (editor) editor.layout();
        }, 50);
    } else {
        // Hide
        panel.classList.add('hidden');
        resizer.classList.add('hidden');
        if (editor) editor.layout();
    }
}

function initTerminalInstance(cwd) {
    if (!TerminalClass) return;
    
    document.getElementById('terminal-body').textContent = ''; // Clear loading text
    
    term = new TerminalClass({
        theme: { 
            background: '#1e1e1e', 
            foreground: '#cccccc', 
            cursor: '#ffffff',
            selection: 'rgba(255, 255, 255, 0.3)' 
        },
        fontSize: 13,
        lineHeight: 1.2,
        fontFamily: 'Consolas, "Courier New", monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        convertEol: true,
        allowTransparency: true
    });
    
    fitAddon = new FitAddonClass();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal-body'));
    
    // Aesthetic Padding
    term.element.style.padding = '8px 0 0 8px';
    
    term.onData(data => {
        if (window.browserAPI && window.browserAPI.terminal) window.browserAPI.terminal.write(data);
    });

    if (window.browserAPI && window.browserAPI.terminal) {
        window.browserAPI.terminal.onData((data) => term.write(data));
        window.browserAPI.terminal.init(cwd);
    }
    
    // Fit immediately and on animation frame to ensure layout is computed
    requestAnimationFrame(() => fitAddon.fit());
}

// --- Helper Functions ---

function getExplorer() { return explorer; } // Accessor
function setExplorerEnabled(enabled) {
    ['btn-new-file','btn-new-folder','btn-refresh-explorer'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !enabled;
        // Visual indicator
        if (btn) btn.style.opacity = enabled ? '1' : '0.5';
    });
}

class FileExplorer {
    constructor() { this.rootPath = null; this.expandedFolders = new Set(); }
    async openFolder() {
        if (window.browserAPI) {
            const path = await window.browserAPI.files.openFolder();
            if(path) this.setRoot(path);
        }
    }
    setRoot(path) {
        this.rootPath = path;
        rootFolderPath = path;
        document.getElementById('explorer-sidebar').classList.remove('collapsed');
        this.expandedFolders.clear();
        setExplorerEnabled(true);
        this.render();
        appendOutput(`Opened folder: ${path}`);
        if (editor) setTimeout(() => editor.layout(), 300);
        // If terminal is open, reset cwd
        if (term && !document.getElementById('terminal-panel').classList.contains('hidden')) {
             if (window.browserAPI) window.browserAPI.terminal.init(path);
        }
    }
    async refresh() { if(this.rootPath) this.render(); }
    async render() {
        const tree = document.getElementById('explorer-tree');
        tree.innerHTML = '';
        
        if (!this.rootPath) {
            // Re-render empty state to ensure button listeners are attached
            tree.innerHTML = `
            <div class="explorer-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" style="opacity:0.2; margin-bottom:12px;"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                <div style="margin-bottom:12px;">No folder open</div>
                <button id="btn-open-folder-sidebar" class="btn-sidebar-cta">Open Folder</button>
            </div>`;
            const btn = tree.querySelector('#btn-open-folder-sidebar');
            if (btn) btn.addEventListener('click', () => this.openFolder());
            return;
        }
        
        await this.renderDirectory(this.rootPath, tree, 0);
    }
    async renderDirectory(dirPath, container, level) {
         const items = await window.browserAPI.files.readDir(dirPath);
         for (const item of items) {
            const el = document.createElement('div');
            el.className = 'tree-item';
            if (item.path === currentFilePath) el.classList.add('active');
            el.style.paddingLeft = `${(level * 16) + 8}px`; // Increased indentation slightly for clarity
            
            const isExpandedInitial = this.expandedFolders.has(item.path);
            
            el.innerHTML = `
               <div class="tree-arrow ${item.isDirectory ? (isExpandedInitial ? 'expanded' : '') : 'hidden'}"><svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5v10z"/></svg></div>
               <div class="tree-icon ${item.isDirectory ? 'folder' : 'file'} ${detectLanguage(item.name)}">
                 ${item.isDirectory ? 
                   '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>' : 
                   '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'}
               </div>
               <div class="tree-label">${item.name}</div>
            `;
            
            // Left Click
            el.addEventListener('click', async (e) => {
                e.stopPropagation();
                document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                el.classList.add('active');
                
                if (item.isDirectory) {
                    const currentlyExpanded = this.expandedFolders.has(item.path);
                    if (currentlyExpanded) {
                        this.expandedFolders.delete(item.path);
                        const children = container.querySelector(`[data-parent="${item.path.replace(/\\/g, '\\\\')}"]`);
                        if(children) children.remove();
                        el.querySelector('.tree-arrow').classList.remove('expanded');
                    } else {
                        this.expandedFolders.add(item.path);
                        el.querySelector('.tree-arrow').classList.add('expanded');
                        const childCont = document.createElement('div');
                        childCont.dataset.parent = item.path;
                        el.after(childCont);
                        await this.renderDirectory(item.path, childCont, level + 1);
                    }
                } else {
                    await openFileFromPath(item.path);
                }
            });

            // Right Click Context Menu
            el.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Simple native confirm for now, can be upgraded to custom UI later
                if (confirm(`Do you want to delete "${item.name}"?`)) {
                    if (window.browserAPI.files.delete) {
                        const success = await window.browserAPI.files.delete(item.path);
                        if (success) {
                            // If deleted file is active, clear editor
                            if (currentFilePath === item.path) {
                                if (editor) editor.setValue('');
                                filename = 'untitled.txt';
                                currentFilePath = null;
                                document.getElementById('file-info').textContent = filename;
                            }
                            this.refresh();
                            appendOutput(`Deleted: ${item.path}`);
                        } else {
                            alert("Failed to delete item.");
                        }
                    } else {
                        alert("Delete functionality not available.");
                    }
                }
            });

            container.appendChild(el);
            
            // Immediate child render if expanded
            if (item.isDirectory && isExpandedInitial) {
                const childCont = document.createElement('div');
                childCont.dataset.parent = item.path;
                container.appendChild(childCont);
                await this.renderDirectory(item.path, childCont, level + 1);
            }
         }
    }
    
    // Improved Helper to join paths correctly regardless of OS
    joinPath(base, name) {
        if (!base) return name;
        // Detect likely separator from base, fallback to '/'
        const sep = base.includes('\\') ? '\\' : '/';
        const cleanBase = base.endsWith(sep) ? base.slice(0, -1) : base;
        return `${cleanBase}${sep}${name}`;
    }

    async createNewFile() {
        if(!this.rootPath) return alert("Please open a folder first.");
        const name = prompt("Enter new filename (e.g., script.js):");
        if(name) {
            const path = this.joinPath(this.rootPath, name);
            if(await window.browserAPI.files.createFile(path, '')) {
                this.refresh();
                openFileFromPath(path);
                appendOutput(`Created file: ${path}`);
            } else {
                alert("Failed to create file.");
            }
        }
    }
    async createNewFolder() {
        if(!this.rootPath) return alert("Please open a folder first.");
        const name = prompt("Enter new folder name:");
        if(name) {
             const path = this.joinPath(this.rootPath, name);
             
             // Check if createFolder exists in API (safe fallback handled in logic if not)
             if (window.browserAPI.files.createFolder) {
                 const success = await window.browserAPI.files.createFolder(path);
                 if (success) {
                     this.refresh();
                     appendOutput(`Created folder: ${path}`);
                 } else {
                     alert("Failed to create folder.");
                 }
             } else {
                 // Fallback if API missing
                 alert("Folder creation API not available.");
             }
        }
    }
}

function detectLanguage(name) {
    if (!name) return 'plaintext';
    const ext = name.split('.').pop().toLowerCase();
    const map = { 'js':'javascript', 'ts':'typescript', 'py':'python', 'html':'html', 'css':'css', 'json':'json', 'md':'markdown', 'jsx':'javascript', 'tsx':'typescript', 'java':'java', 'c':'c', 'cpp':'cpp' };
    return map[ext] || 'plaintext';
}

function toggleSidebar() {
    document.getElementById('explorer-sidebar').classList.toggle('collapsed');
    setTimeout(() => { if(editor) editor.layout(); }, 300);
}

function updateLanguageUI(lang) {
    if (editor) monaco.editor.setModelLanguage(editor.getModel(), lang);
    document.getElementById('status-lang').textContent = lang.toUpperCase();
    document.getElementById('btn-run').style.display = (lang === 'html') ? 'flex' : 'none';
}

function setUnsaved(val) {
    const el = document.querySelector('.file-tab');
    if(val) el.classList.add('unsaved'); else el.classList.remove('unsaved');
}

// --- IO Operations ---
async function openFileFromPath(path) {
    try {
        const response = await fetch(`file://${path}`);
        const text = await response.text();
        if(editor) {
            editor.setValue(text);
            filename = path.split(/[/\\]/).pop();
            currentFilePath = path;
            document.getElementById('file-info').textContent = filename;
            updateLanguageUI(detectLanguage(filename));
            setUnsaved(false);
            // Lazy refresh to highlight active
            if(explorer) explorer.refresh();
            appendOutput(`Opened: ${filename}`);
        }
    } catch(e) { console.error(e); }
}

async function openFile() {
    const res = await window.browserAPI.files.openText();
    if(res && res.success) {
        if(editor) {
            editor.setValue(res.content);
            currentFilePath = res.filePath;
            filename = currentFilePath.split(/[/\\]/).pop();
            document.getElementById('file-info').textContent = filename;
            updateLanguageUI(detectLanguage(filename));
            setUnsaved(false);
            appendOutput(`Opened: ${filename}`);
        }
    }
}

async function saveFile() {
    if(!editor) return;
    const content = editor.getValue();
    if(currentFilePath) {
        await window.browserAPI.files.createFile(currentFilePath, content);
        setUnsaved(false);
        appendOutput(`Saved: ${filename}`);
    } else {
        const res = await window.browserAPI.files.saveText(content, filename);
        if(res && res.success) {
            currentFilePath = res.filePath;
            filename = currentFilePath.split(/[/\\]/).pop();
            document.getElementById('file-info').textContent = filename;
            updateLanguageUI(detectLanguage(filename));
            setUnsaved(false);
            if(rootFolderPath) explorer.refresh();
            appendOutput(`Saved as: ${filename}`);
        }
    }
}

// --- AI Logic (Simplified for Lazy Loading) ---

async function syncAISettings() {
    const s = await window.browserAPI.settings.get();
    if(s) {
        const active = s.activeProvider || 'google';
        const p = s.providers?.[active];
        aiConfig.provider = active;
        aiConfig.apiKey = p?.key || window.env?.API_KEY || '';
        aiConfig.model = p?.model || 'gemini-2.5-flash';
    }
}

function appendAiMessage(role, text) {
    const container = document.getElementById('ai-chat-output');
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    
    // Simple text handling for now
    bubble.innerText = text.replace(/<think>.*?<\/think>/g, ''); 
    
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

async function handleAiSubmit() {
    // Ensure module is loaded if user triggered via keyboard shortcuts without toggle
    if (!GoogleGenAI) await loadAIModule();
    
    const input = document.getElementById('ai-prompt-input');
    const text = input.value.trim();
    if(!text || !aiConfig.apiKey) return;

    input.value = '';
    appendAiMessage('user', text);
    const bubble = appendAiMessage('model', 'Thinking...');

    try {
        if (aiConfig.provider === 'google') {
            const ai = new GoogleGenAI({ apiKey: aiConfig.apiKey });
            const session = ai.chats.create({ 
                model: aiConfig.model, 
                config: { systemInstruction: "You are an expert coding assistant." } 
            });
            const result = await session.sendMessage(text);
            bubble.textContent = result.response.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        } else {
            // ... (Other providers implementation if needed)
            bubble.textContent = "Only Gemini supported in this optimized view.";
        }
    } catch(e) {
        bubble.textContent = "Error: " + e.message;
    }
}

async function handleAiFix() {
    if (!editor || !GoogleGenAI) return;
    const btn = document.getElementById('btn-ai-fix');
    btn.textContent = 'Scanning...';
    btn.disabled = true;
    
    try {
        const code = editor.getValue();
        const ai = new GoogleGenAI({ apiKey: aiConfig.apiKey });
        const resp = await ai.models.generateContent({
            model: aiConfig.model,
            contents: `Analyze this code for errors. Return JSON {fixes: [{lineNumber, newContent}]}. Code:\n${code}`,
            config: { responseMimeType: 'application/json' }
        });
        
        const json = JSON.parse(resp.text);
        if(json.fixes && json.fixes.length) {
            // Apply edits
             const edits = json.fixes.map(f => ({
                range: new monaco.Range(f.lineNumber, 1, f.lineNumber, 1000),
                text: f.newContent,
                forceMoveMarkers: true
            }));
            editor.executeEdits('ai-fix', edits);
            appendAiMessage('model', `Applied ${edits.length} fixes.`);
        } else {
            appendAiMessage('model', "No issues found.");
        }
    } catch(e) {
        console.error(e);
        appendAiMessage('system', "Fix failed.");
    } finally {
        btn.innerHTML = 'Smart Scan & Fix';
        btn.disabled = false;
    }
}
