import { QuickBot } from '../utils/quickBot.js';
import renderMathInElement from "https://esm.sh/katex@0.16.11/dist/contrib/auto-render.mjs";
import { findResponse, getAvailableTopics, shouldUseDatabase, processDatabaseQuery } from './responseDatabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    applyChatWindowMode();
    
    // --- PROFESSIONAL UI INJECTION ---
    const styleId = 'omni-pro-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

            :root {
                --omni-accent: #6366f1;
                --omni-accent-glow: rgba(99, 102, 241, 0.2);
                --omni-bg-glass: rgba(30, 41, 59, 0.7);
                --omni-border: rgba(255, 255, 255, 0.1);
                --omni-text-main: #f8fafc;
                --omni-text-sub: #94a3b8;
                --omni-success: #10b981;
                --omni-warning: #f59e0b;
            }

            /* Animations (minimal) */
            .omni-fade-in { animation: none; }

            /* Typography */
            .pro-p { margin: 0 0 11px 0; line-height: 1.7; color: #e2e8f0; font-size: 0.96rem; }
            .pro-h2 { font-size: 1.18rem; font-weight: 700; margin: 1.2rem 0 0.65rem 0; color: #fff; display: flex; align-items: center; gap: 8px; }
            .pro-h2::before { content: '#'; color: var(--omni-accent); font-weight: 700; }
            .pro-h3 { font-size: 1.02rem; font-weight: 650; margin: 1rem 0 0.45rem 0; color: #dbeafe; }
            .pro-ul { list-style: none; margin: 0 0 12px 0; padding: 0; }
            .pro-li { margin-bottom: 7px; padding-left: 1.5rem; position: relative; color: #dbe3ef; font-size: 0.93rem; line-height: 1.6; }
            .pro-li::before { content: '•'; color: var(--omni-accent); position: absolute; left: 0.5rem; font-weight: bold; }
            .pro-poem {
                border-left: 2px solid #4f89d8;
                background: rgba(59, 130, 246, 0.08);
                border-radius: 8px;
                padding: 10px 12px;
                margin: 6px 0 10px 0;
            }
            .pro-poem-line {
                margin: 0;
                color: #e6edf7;
                font-size: 0.98rem;
                line-height: 1.85;
                letter-spacing: 0.15px;
            }
            .pro-poem-gap { height: 10px; }
            
            /* Tables */
            .table-wrapper { overflow-x: auto; margin: 16px 0; border-radius: 8px; border: 1px solid var(--omni-border); }
            .pro-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; background: rgba(15, 23, 42, 0.5); }
            .pro-table th { background: rgba(255,255,255,0.05); padding: 12px; text-align: left; font-weight: 600; color: #fff; position: sticky; top: 0; backdrop-filter: blur(4px); }
            .pro-table td { padding: 10px 12px; border-bottom: 1px solid var(--omni-border); color: var(--omni-text-sub); }
            .pro-table tr:last-child td { border-bottom: none; }
            .pro-table tr:hover td { background: rgba(255,255,255,0.03); color: #fff; }

            /* =========================================
               DARK THEME & GLASSMORPHISM FOUNDATION
               ========================================= */
            
            :root {
                --panel-bg: #11161d;
                --panel-bg-2: #141b24;
                --panel-border: #253142;
                --panel-border-strong: #334155;
                --panel-shadow: none;
                --panel-shadow-hover: none;
                --panel-accent: rgba(59, 130, 246, 0.14);
                --transition-smooth: all 0.12s ease;
            }
            
            /* =========================================
               COLLAPSIBLE CONTAINER SYSTEM
               ========================================= */
            
            .collapsible-container {
                background: var(--panel-bg);
                border: 1px solid var(--panel-border);
                border-radius: 8px;
                margin: 10px 0;
                overflow: hidden;
                box-shadow: var(--panel-shadow);
                transition: var(--transition-smooth);
            }
            
            .collapsible-container:hover {
                background: var(--panel-bg-2);
                border-color: var(--panel-border-strong);
                box-shadow: var(--panel-shadow-hover);
            }
            
            .collapsible-container.focused {
                border-color: rgba(80, 99, 255, 0.5);
                box-shadow: 0 0 0 1px var(--panel-accent), var(--panel-shadow-hover);
            }
            
            /* Container Header */
            .container-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                background: #131a22;
                border-bottom: 1px solid #273347;
                cursor: pointer;
                user-select: none;
                transition: var(--transition-smooth);
                position: relative;
            }
            
            .container-header::before {
                display: none;
            }
            
            .container-header:hover::before {
                opacity: 1;
            }
            
            .container-header:hover {
                background: #17202b;
                border-bottom-color: #314158;
            }
            
            .container-header-title {
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 1;
            }
            
            .container-header-icon {
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(59, 130, 246, 0.12);
                border-radius: 5px;
                color: #93c5fd;
                transition: var(--transition-smooth);
            }
            
            .container-header:hover .container-header-icon {
                background: rgba(80, 99, 255, 0.18);
                color: #c3d0ff;
            }
            
            .container-header-text {
                font-weight: 650;
                font-size: 0.74rem;
                color: #cbd5e1;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: color 0.3s;
            }
            
            .container-header:hover .container-header-text {
                color: #fff;
            }
            
            /* Toggle Button */
            .toggle-btn {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #1a2330;
                border: 1px solid #2a394e;
                border-radius: 6px;
                color: #94a3b8;
                cursor: pointer;
                transition: var(--transition-smooth);
                z-index: 1;
            }
            
            .toggle-btn:hover {
                background: rgba(255, 255, 255, 0.07);
                border-color: rgba(255, 255, 255, 0.2);
                color: #fff;
            }
            
            .toggle-btn svg {
                width: 16px;
                height: 16px;
                transition: transform 0.15s ease;
            }
            
            .collapsible-container.collapsed .toggle-btn svg {
                transform: rotate(-90deg);
            }
            
            .toggle-btn:active {
                transform: scale(0.92);
            }
            
            /* Container Content with Smooth Height Transition */
            .container-content {
                max-height: 1200px;
                opacity: 1;
                overflow: hidden;
                transition: max-height 0.2s ease, 
                            opacity 0.15s ease,
                            padding 0.15s ease;
                background: #101720;
            }
            
            .collapsible-container.collapsed .container-content {
                max-height: 0;
                opacity: 0;
            }
            
            .container-content-inner {
                padding: 14px;
            }
            
            /* Container Type Variants */
            .collapsible-container.reasoning { border-color: #2f3e56; }
            .collapsible-container.reasoning .container-header-icon { background: rgba(96, 165, 250, 0.15); color: #93c5fd; }
            
            .collapsible-container.code { border-color: #2e4a43; }
            .collapsible-container.code .container-header-icon { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }
            
            .collapsible-container.search { border-color: #30485f; }
            .collapsible-container.search .container-header-icon { background: rgba(56, 189, 248, 0.14); color: #7dd3fc; }
            
            .collapsible-container.tool { border-color: #4b4332; }
            .collapsible-container.tool .container-header-icon { background: rgba(251, 191, 36, 0.14); color: #fcd34d; }
            
            .collapsible-container.diagram { border-color: #43365d; }
            .collapsible-container.diagram .container-header-icon { background: rgba(167, 139, 250, 0.14); color: #c4b5fd; }
            
            .collapsible-container.answer { border-color: #2e4a43; background: #101720; }
            .collapsible-container.answer .container-header-icon { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }

            /* Keep only reasoning as a visible container */
            .collapsible-container:not(.reasoning) {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                margin: 8px 0 !important;
            }
            .collapsible-container:not(.reasoning) .container-header {
                display: none !important;
            }
            .collapsible-container:not(.reasoning) .container-content {
                max-height: none !important;
                opacity: 1 !important;
                background: transparent !important;
            }
            .collapsible-container:not(.reasoning) .container-content-inner {
                padding: 0 !important;
            }
            
            /* MODERN REASONING TRACE - Enhanced */
            .reasoning-pro-card { 
                background: #10131a;
                border: 1px solid rgba(120, 132, 255, 0.25);
                border-radius: 6px; 
                margin: 12px 0 16px 0; 
                overflow: hidden;
                width: 100%;
                max-width: 100%;
                box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
                transition: var(--transition-smooth);
            }
            .reasoning-pro-card:hover {
                border-color: rgba(120, 132, 255, 0.35);
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.4);
            }
            .reasoning-header { 
                padding: 12px 16px; 
                background: rgba(255, 255, 255, 0.03);
                cursor: pointer; 
                display: flex; 
                align-items: center; 
                justify-content: space-between;
                gap: 12px;
                transition: var(--transition-smooth);
                border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            }
            .reasoning-header:hover { 
                background: rgba(255, 255, 255, 0.05);
            }
            .reasoning-icon { 
                width: 18px; 
                height: 18px; 
                color: var(--omni-accent); 
                opacity: 0.95;
                flex-shrink: 0;
            }
            .reasoning-icon.pulsing { animation: pulseSoft 2s infinite; }
            .title { 
                font-weight: 700; 
                font-size: 0.75rem; 
                color: var(--omni-accent);
                text-transform: uppercase; 
                letter-spacing: 1.2px;
                flex: 1;
            }
            .chevron-icon { 
                width: 16px; 
                height: 16px; 
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                color: var(--omni-accent);
                opacity: 0.7;
                flex-shrink: 0;
            }
            .reasoning-pro-card.collapsed .chevron-icon { transform: rotate(-90deg); }
            .reasoning-content { 
                padding: 14px 16px; 
                font-family: 'JetBrains Mono', monospace; 
                font-size: 0.8rem; 
                color: #cbd5e1; 
                line-height: 1.6; 
                white-space: pre-wrap;
                word-break: break-word;
                background: rgba(0, 0, 0, 0.25);
                max-height: 320px;
                overflow-y: auto;
            }
            .reasoning-pro-card.collapsed .reasoning-content { display: none; }
            
            /* Web Search Results Section */
            .search-results-section {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(34, 197, 94, 0.04) 100%);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 12px;
                margin: 12px 0 16px 0;
                overflow: hidden;
                backdrop-filter: blur(12px);
                box-shadow: 0 8px 24px rgba(16, 185, 129, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .search-results-section:hover {
                border-color: rgba(16, 185, 129, 0.3);
                box-shadow: 0 12px 32px rgba(16, 185, 129, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08);
            }
            .search-results-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                background: linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.06) 100%);
                border-bottom: 1px solid rgba(16, 185, 129, 0.12);
                font-weight: 700;
                font-size: 0.75rem;
                color: #10b981;
                text-transform: uppercase;
                letter-spacing: 1.2px;
            }
            .search-results-header svg {
                width: 16px;
                height: 16px;
                color: #10b981;
                flex-shrink: 0;
            }
            .search-result-item {
                padding: 12px 16px;
                border-bottom: 1px solid rgba(16, 185, 129, 0.08);
                transition: all 0.2s;
                cursor: pointer;
            }
            .search-result-item:last-child {
                border-bottom: none;
            }
            .search-result-item:hover {
                background: rgba(16, 185, 129, 0.08);
            }
            .result-title {
                font-weight: 600;
                font-size: 0.95rem;
                color: #fff;
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .result-url {
                font-size: 0.75rem;
                color: #10b981;
                font-family: 'JetBrains Mono', monospace;
                margin-bottom: 6px;
                opacity: 0.85;
            }
            .result-snippet {
                font-size: 0.85rem;
                color: #cbd5e1;
                line-height: 1.5;
            }

            /* Web Sources Collection Container */
            .web-sources-section {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.04) 100%);
                border: 1px solid rgba(59, 130, 246, 0.2);
                border-radius: 12px;
                margin: 12px 0 16px 0;
                overflow: hidden;
                backdrop-filter: blur(12px);
                box-shadow: 0 8px 24px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05);
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .web-sources-section:hover {
                border-color: rgba(59, 130, 246, 0.3);
                box-shadow: 0 12px 32px rgba(59, 130, 246, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08);
            }
            .web-sources-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                background: linear-gradient(90deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.06) 100%);
                border-bottom: 1px solid rgba(59, 130, 246, 0.12);
                font-weight: 700;
                font-size: 0.75rem;
                color: #3b82f6;
                text-transform: uppercase;
                letter-spacing: 1.2px;
            }
            .web-sources-header svg {
                width: 16px;
                height: 16px;
                color: #3b82f6;
                flex-shrink: 0;
            }
            .web-source-item {
                padding: 12px 16px;
                border-bottom: 1px solid rgba(59, 130, 246, 0.08);
                transition: all 0.2s;
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            .web-source-item:last-child {
                border-bottom: none;
            }
            .web-source-item:hover {
                background: rgba(59, 130, 246, 0.08);
            }
            .source-status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
                margin-top: 6px;
                background: #3b82f6;
                animation: pulse 2s infinite;
            }
            .source-status-indicator.completed {
                background: #10b981;
                animation: none;
            }
            .source-content {
                flex: 1;
                min-width: 0;
            }
            .source-url {
                font-size: 0.75rem;
                color: #3b82f6;
                font-family: 'JetBrains Mono', monospace;
                margin-bottom: 4px;
                opacity: 0.85;
                word-break: break-all;
            }
            .source-data {
                font-size: 0.8rem;
                color: #cbd5e1;
                line-height: 1.5;
                word-break: break-word;
                max-height: 100px;
                overflow-y: auto;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* Canvas / Code */
            .neural-canvas { 
                background: #0f172a; 
                border: 1px solid #334155; 
                border-radius: 10px; 
                margin: 16px 0; 
                overflow: hidden; 
                box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
            }
            .canvas-header { 
                display: flex; 
                align-items: center; 
                justify-content: space-between; 
                padding: 8px 12px; 
                background: #1e293b; 
                border-bottom: 1px solid #334155; 
            }
            .window-controls { display: flex; gap: 6px; }
            .control { width: 10px; height: 10px; border-radius: 50%; }
            .close { background: #ef4444; }
            .minimize { background: #f59e0b; }
            .maximize { background: #10b981; }
            .canvas-title { display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 0.8rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
            .btn-copy { background: transparent; border: 1px solid #475569; color: #94a3b8; border-radius: 4px; padding: 4px 8px; font-size: 0.7rem; cursor: pointer; transition: all 0.2s; }
            .btn-copy:hover { background: #334155; color: #fff; }
            .btn-copy.copied { background: #10b981; border-color: #10b981; color: #fff; }
            
            .canvas-body.code { padding: 0; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; line-height: 1.6; }
            .canvas-body.manuscript { padding: 14px; font-family: 'Inter', sans-serif; color: #dbe3ef; line-height: 1.65; background: #111a24; border: 1px solid #263447; border-radius: 6px; }
            .manuscript-rich { display: flex; flex-direction: column; gap: 10px; }
            .ms-headline { font-size: 1.15rem; font-weight: 700; color: #f8fafc; line-height: 1.35; letter-spacing: 0.2px; margin-top: 2px; }
            .ms-subhead { font-size: 1rem; font-weight: 650; color: #c7d2fe; line-height: 1.4; margin-top: 4px; }
            .ms-para { font-size: 0.95rem; color: #dbe3ef; line-height: 1.75; }
            .ms-para.lead { font-size: 1.01rem; color: #e2e8f0; }
            .ms-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
            .ms-item { display: flex; align-items: flex-start; gap: 10px; color: #dbe3ef; font-size: 0.92rem; line-height: 1.6; }
            .ms-emoji { font-size: 0.95rem; line-height: 1.4; opacity: 0.95; }
            .ms-note { border-left: 2px solid #38bdf8; background: rgba(56, 189, 248, 0.09); padding: 8px 10px; border-radius: 6px; font-size: 0.9rem; color: #cfe8ff; }
            .ms-accent-critical { color: #fca5a5; font-weight: 650; }
            .ms-accent-success { color: #86efac; font-weight: 650; }
            .ms-accent-info { color: #93c5fd; font-weight: 650; }
            .ms-block-reveal { opacity: 0; transform: translateY(6px); transition: opacity 0.2s ease, transform 0.2s ease; }
            .ms-block-reveal.show { opacity: 1; transform: translateY(0); }

            /* Code Line Numbers */
            .code-line { display: flex; }
            .ln { width: 40px; padding-right: 12px; text-align: right; color: #475569; user-select: none; border-right: 1px solid #1e293b; flex-shrink: 0; background: #0f172a; position: sticky; left: 0; }
            .code-text { padding-left: 12px; color: #e2e8f0; white-space: pre; flex-grow: 1; }

            /* Pipeline Steps */
            .process-pipeline-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                font-size: 0.7rem;
                font-weight: 800;
                color: #93c5fd;
                text-transform: uppercase;
                letter-spacing: 1.45px;
                text-shadow: 0 0 12px rgba(59, 130, 246, 0.22);
            }
            .process-pipeline-header .pipeline-live-dot {
                position: relative;
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: #60a5fa;
                box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.58);
                animation: omniLiveBlink 1.5s ease-in-out infinite;
            }
            .process-pipeline-header .pipeline-live-signal {
                width: 12px;
                height: 12px;
                border-radius: 999px;
                border: 1px solid rgba(129, 140, 248, 0.65);
                border-top-color: transparent;
                animation: omniSpin 2.4s linear infinite;
                opacity: 0.9;
            }
            .process-pipeline-header .pipeline-live-glyph {
                color: #a5b4fc;
                animation: omniSpinSlow 4s linear infinite;
            }

            .pipeline-step {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                margin-bottom: 12px;
                position: relative;
            }
            .pipeline-step:not(:last-child)::after {
                content: '';
                position: absolute;
                left: 10px;
                top: 24px;
                bottom: -12px;
                width: 1px;
                border-radius: 999px;
                background: linear-gradient(180deg, rgba(96, 165, 250, 0.42) 0%, rgba(30, 41, 59, 0.08) 100%);
                z-index: 0;
                animation: omniLineFlow 2s ease-in-out infinite;
            }
            .pipeline-step.completed::after {
                background: linear-gradient(180deg, rgba(52, 211, 153, 0.85) 0%, rgba(6, 95, 70, 0.25) 100%);
                animation: none;
            }

            .step-marker {
                position: relative;
                width: 20px;
                height: 20px;
                border-radius: 999px;
                background: radial-gradient(circle at 30% 30%, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.94));
                z-index: 1;
                border: 1px solid rgba(148, 163, 184, 0.42);
                margin-top: 1px;
                flex-shrink: 0;
                overflow: visible;
                transition: var(--transition-smooth);
            }
            .step-core {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 6px;
                height: 6px;
                border-radius: 999px;
                transform: translate(-50%, -50%);
                background: #64748b;
                transition: var(--transition-smooth);
            }
            .step-fx,
            .step-orbit {
                position: absolute;
                border-radius: 999px;
                pointer-events: none;
                opacity: 0;
            }
            .step-fx {
                inset: -4px;
            }
            .step-orbit {
                inset: -8px;
                border: 1px dashed transparent;
            }

            .pipeline-step.pending .step-core {
                background: #64748b;
                opacity: 0.72;
                animation: omniBlinkDot 1.8s ease-in-out infinite;
            }

            .pipeline-step.active .step-marker {
                border-color: rgba(129, 140, 248, 0.72);
                background: radial-gradient(circle at 30% 30%, rgba(67, 56, 202, 0.45), rgba(15, 23, 42, 0.96));
                box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.18), 0 0 18px rgba(99, 102, 241, 0.22);
            }
            .pipeline-step.active .step-core {
                background: #c7d2fe;
                opacity: 1;
            }

            .pipeline-step.completed .step-marker {
                border-color: rgba(52, 211, 153, 0.76);
                background: radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.45), rgba(6, 78, 59, 0.7));
                box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.18), 0 0 14px rgba(16, 185, 129, 0.26);
            }
            .pipeline-step.completed .step-core,
            .pipeline-step.completed .step-fx,
            .pipeline-step.completed .step-orbit {
                opacity: 0;
                animation: none;
            }
            .pipeline-step.completed .step-marker::after {
                content: '';
                position: absolute;
                left: 6px;
                top: 3px;
                width: 5px;
                height: 9px;
                border-right: 2px solid #6ee7b7;
                border-bottom: 2px solid #6ee7b7;
                transform: rotate(45deg);
            }

            .step-label {
                display: flex;
                flex-direction: column;
                gap: 4px;
                min-height: 22px;
            }
            .step-title {
                font-size: 0.86rem;
                color: #d0dae8;
                font-weight: 620;
                letter-spacing: 0.1px;
            }
            .step-status {
                font-size: 0.75rem;
                color: #7b8596;
                font-weight: 520;
                display: inline-flex;
                align-items: center;
                gap: 2px;
            }
            .step-status.status-live::after {
                content: '...';
                display: inline-block;
                width: 12px;
                letter-spacing: 1px;
                animation: omniDots 1.2s steps(4, end) infinite;
            }
            .pipeline-step.active .step-title { color: #f8fafc; }
            .pipeline-step.active .step-status { color: #b7c2ff; }
            .pipeline-step.completed .step-status { color: #6ee7bf; }

            /* Task-specific live animations */
            .pipeline-step.task-type-intent.active .step-fx {
                inset: -3px;
                border: 2px solid rgba(96, 165, 250, 0.78);
                border-left-color: transparent;
                border-right-color: transparent;
                opacity: 1;
                animation: omniSpin 0.9s linear infinite;
            }

            .pipeline-step.task-type-vision.active .step-fx {
                inset: -5px;
                border: 1px solid rgba(56, 189, 248, 0.74);
                opacity: 1;
                animation: omniPulseRing 1.5s ease-out infinite;
            }
            .pipeline-step.task-type-vision.active .step-orbit {
                inset: -8px;
                border-color: rgba(14, 165, 233, 0.35);
                opacity: 0.8;
                animation: omniCounterSpin 3.8s linear infinite;
            }

            .pipeline-step.task-type-wiki-fetch.active .step-fx {
                inset: -4px;
                border: 1px dashed rgba(167, 139, 250, 0.75);
                opacity: 1;
                animation: omniSpinSlow 2.7s linear infinite;
            }
            .pipeline-step.task-type-wiki-fetch.active .step-core {
                background: #d8b4fe;
                animation: omniBlinkDot 1.1s ease-in-out infinite;
            }
            .pipeline-step.task-type-wiki-fetch.active .step-orbit {
                border-color: rgba(196, 181, 253, 0.42);
                opacity: 0.85;
                animation: omniCounterSpin 4.2s linear infinite;
            }

            .pipeline-step.task-type-search.active .step-fx {
                inset: -4px;
                background: conic-gradient(from 0deg, rgba(45, 212, 191, 0.95), rgba(45, 212, 191, 0.08), rgba(45, 212, 191, 0.95));
                -webkit-mask: radial-gradient(circle, transparent 53%, #000 58%);
                mask: radial-gradient(circle, transparent 53%, #000 58%);
                opacity: 1;
                animation: omniSpin 1.25s linear infinite;
            }
            .pipeline-step.task-type-search.active .step-core {
                background: #2dd4bf;
            }

            .pipeline-step.task-type-synthesis.active .step-fx {
                inset: -6px;
                border-top: 2px solid rgba(99, 102, 241, 0.9);
                border-bottom: 2px solid rgba(16, 185, 129, 0.92);
                border-left: 2px solid transparent;
                border-right: 2px solid transparent;
                opacity: 1;
                animation: omniSpin 1.12s linear infinite;
            }
            .pipeline-step.task-type-synthesis.active .step-orbit {
                inset: -9px;
                border: 1px solid rgba(16, 185, 129, 0.38);
                opacity: 0.75;
                animation: omniCounterSpin 2.1s linear infinite;
            }
            .pipeline-step.task-type-synthesis.active .step-core {
                background: #6ee7b7;
                animation: omniBlinkDot 1s ease-in-out infinite;
            }

            @keyframes omniLiveBlink {
                0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.58); }
                50% { opacity: 0.58; box-shadow: 0 0 0 6px rgba(96, 165, 250, 0.08); }
            }
            @keyframes omniSpin {
                to { transform: rotate(360deg); }
            }
            @keyframes omniSpinSlow {
                to { transform: rotate(360deg); }
            }
            @keyframes omniCounterSpin {
                to { transform: rotate(-360deg); }
            }
            @keyframes omniPulseRing {
                0% { transform: scale(0.82); opacity: 0.9; }
                70% { transform: scale(1.17); opacity: 0.28; }
                100% { transform: scale(1.22); opacity: 0; }
            }
            @keyframes omniBlinkDot {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            @keyframes omniLineFlow {
                0%, 100% { opacity: 0.46; }
                50% { opacity: 1; }
            }
            @keyframes omniDots {
                0% { width: 0; }
                100% { width: 12px; }
            }

            /* Tool Calls */
            .tool-call-card { 
                background: rgba(30,41,59,0.4); border: 1px solid var(--omni-border); border-radius: 8px; margin: 12px 0; overflow: hidden;
            }
            .tool-header { padding: 8px 12px; background: rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px; }
            .tool-name { font-family: 'JetBrains Mono'; font-size: 0.8rem; color: var(--omni-accent); font-weight: 600; }
            .tool-status { font-size: 0.7rem; color: #94a3b8; margin-left: auto; }
            .tool-body { padding: 12px; font-family: 'JetBrains Mono'; font-size: 0.8rem; color: #cbd5e1; white-space: pre-wrap; background: rgba(0,0,0,0.2); }
            .wiki-trace-list { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px 14px 14px; }
            .wiki-trace-step { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); opacity: 0.7; transform: translateY(2px); transition: all 0.2s ease; }
            .wiki-trace-step.active { opacity: 1; transform: translateY(0); border-color: rgba(129, 140, 248, 0.55); background: rgba(99, 102, 241, 0.12); box-shadow: 0 6px 18px rgba(99, 102, 241, 0.18); }
            .wiki-trace-step.done { opacity: 1; border-color: rgba(52, 211, 153, 0.5); background: rgba(16, 185, 129, 0.12); }
            .wiki-step-indicator { width: 10px; height: 10px; border-radius: 50%; background: rgba(148,163,184,0.8); flex-shrink: 0; }
            .wiki-trace-step.active .wiki-step-indicator { background: #818cf8; box-shadow: 0 0 0 4px rgba(99,102,241,0.2); animation: wikiPulse 1.2s infinite; }
            .wiki-trace-step.done .wiki-step-indicator { background: #34d399; box-shadow: none; animation: none; }
            .wiki-step-title { font-size: 0.82rem; font-weight: 600; color: #e2e8f0; }
            .wiki-step-meta { margin-left: auto; font-size: 0.72rem; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
            .wiki-page-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; padding: 0 14px 14px 14px; }
            .wiki-page-card { border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(15,23,42,0.45); padding: 10px; }
            .wiki-page-title { font-size: 0.82rem; color: #fff; font-weight: 600; margin-bottom: 6px; line-height: 1.35; }
            .wiki-page-snippet { font-size: 0.76rem; color: #cbd5e1; line-height: 1.45; max-height: 80px; overflow: hidden; }
            @keyframes wikiPulse {
                0% { transform: scale(1); opacity: 0.9; }
                50% { transform: scale(1.18); opacity: 1; }
                100% { transform: scale(1); opacity: 0.9; }
            }
            /* JSON Syntax Colors */
            .json-key { color: #93c5fd; }
            .json-string { color: #86efac; }
            .json-number { color: #fca5a5; }
            .json-boolean { color: #fcd34d; }

            /* Images & Grids */
            .grounded-section { margin-top: 16px; }
            .grounded-images-wrap { margin-bottom: 14px; }
            .grounded-images-card {
                background: #111a24;
                border: 1px solid #263447;
                border-radius: 8px;
                padding: 12px 13px;
            }
            .grounded-images-card .section-header {
                margin-bottom: 10px;
            }
            .section-header { font-size: 0.75rem; font-weight: 700; color: var(--omni-accent); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
            .image-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
            .gallery-item { aspect-ratio: 4/3; border-radius: 8px; overflow: hidden; border: 1px solid var(--omni-border); cursor: zoom-in; transition: transform 0.2s; position: relative; background: #000; }
            .gallery-item:hover { transform: scale(1.03); border-color: var(--omni-accent); }
            .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
            .image-viewer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); animation: fadeInUp 0.2s; }
            .image-viewer-overlay img { max-width: 90vw; max-height: 90vh; border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
            .btn-close-viewer { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; }
            .btn-close-viewer:hover { background: rgba(255,255,255,0.2); }

            .video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-top: 16px; }
            .video-card { background: rgba(30,41,59,0.4); border: 1px solid var(--omni-border); border-radius: 10px; overflow: hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
            .video-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.3); border-color: var(--omni-accent); }
            .video-thumb-wrapper { position: relative; aspect-ratio: 16/9; background: #000; }
            .video-thumb-wrapper img { width: 100%; height: 100%; object-fit: cover; opacity: 0.9; }
            .play-indicator { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); transition: background 0.2s; }
            .video-card:hover .play-indicator { background: rgba(0,0,0,0.5); }
            .play-circle { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; color: #000; }
            .video-meta { padding: 12px; }
            .video-title { margin: 0; font-size: 0.9rem; color: #fff; font-weight: 500; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
            .video-tag { display: inline-block; font-size: 0.7rem; color: var(--omni-accent); background: rgba(99, 102, 241, 0.1); padding: 2px 6px; border-radius: 4px; margin-top: 8px; font-weight: 600; }

            /* Action Bar - FIXED: Always Visible */
            .message-actions { 
                display: flex; gap: 8px; margin-top: 12px; 
                opacity: 1; /* Fixed: Always visible */
                pointer-events: auto;
            }
            .sources-popup-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.55);
                backdrop-filter: blur(3px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .sources-popup {
                width: min(820px, 94vw);
                max-height: 82vh;
                overflow-y: auto;
                border-radius: 10px;
                background: #0e1218;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 24px 60px rgba(0,0,0,0.55);
                display: flex;
                flex-direction: column;
            }
            .sources-popup-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 14px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                font-size: 0.78rem;
                letter-spacing: 1px;
                font-weight: 700;
                text-transform: uppercase;
                color: #93c5fd;
            }
            .sources-popup-subheader {
                padding: 8px 14px 10px 14px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                font-size: 0.72rem;
                color: #94a3b8;
                letter-spacing: 0.4px;
            }
            .sources-popup-list {
                flex: 1;
                min-height: 0;
                max-height: calc(82vh - 108px);
                padding: 10px;
                overflow-y: auto;
                overscroll-behavior: contain;
                scrollbar-gutter: stable both-edges;
                scrollbar-width: thin;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .sources-popup-list::-webkit-scrollbar {
                width: 10px;
            }
            .sources-popup-list::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.04);
                border-radius: 10px;
            }
            .sources-popup-list::-webkit-scrollbar-thumb {
                background: rgba(96,165,250,0.35);
                border-radius: 10px;
                border: 2px solid transparent;
                background-clip: content-box;
            }
            .sources-popup-list::-webkit-scrollbar-thumb:hover {
                background: rgba(96,165,250,0.55);
                background-clip: content-box;
            }
            .source-link-item {
                padding: 15px 16px;
                min-height: 138px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.09);
                background: rgba(255,255,255,0.02);
                cursor: pointer;
                transition: all 0.2s ease;
                overflow: hidden;
            }
            .source-link-item:hover {
                border-color: rgba(96,165,250,0.45);
                background: rgba(59,130,246,0.08);
            }
            .source-link-title { font-size: 0.85rem; color: #fff; font-weight: 600; margin-bottom: 4px; }
            .source-link-url { font-size: 0.74rem; color: #60a5fa; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px; word-break: break-all; }
            .source-link-snippet { font-size: 0.78rem; color: #cbd5e1; line-height: 1.45; }
            .source-link-meta {
                display: flex;
                gap: 6px;
                margin: 6px 0 8px 0;
                flex-wrap: wrap;
            }
            .source-link-chip {
                font-size: 0.68rem;
                color: #bfdbfe;
                background: rgba(59,130,246,0.15);
                border: 1px solid rgba(96,165,250,0.3);
                border-radius: 999px;
                padding: 2px 8px;
                text-transform: uppercase;
                letter-spacing: 0.7px;
                font-weight: 700;
            }
            .source-link-chip.host {
                color: #cbd5e1;
                background: rgba(148,163,184,0.12);
                border-color: rgba(148,163,184,0.26);
            }
            .source-link-data-label {
                font-size: 0.67rem;
                color: #94a3b8;
                margin-bottom: 3px;
                text-transform: uppercase;
                letter-spacing: 0.7px;
                font-weight: 700;
            }
            .source-link-data {
                font-size: 0.79rem;
                color: #dbeafe;
                line-height: 1.45;
                word-break: break-word;
                overflow-wrap: anywhere;
                white-space: normal;
                max-height: 144px;
                overflow-y: auto;
                overflow-x: hidden;
                scrollbar-width: thin;
                scrollbar-color: rgba(96,165,250,0.45) rgba(255,255,255,0.03);
                padding-right: 4px;
            }
            .source-link-data::-webkit-scrollbar {
                width: 8px;
            }
            .source-link-data::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.03);
                border-radius: 10px;
            }
            .source-link-data::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, rgba(96,165,250,0.55), rgba(59,130,246,0.45));
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.06);
            }
            .source-link-data::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, rgba(125,179,255,0.75), rgba(96,165,250,0.62));
            }
            .offline-log-item {
                padding: 12px 14px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.09);
                background: rgba(255,255,255,0.02);
            }
            .offline-log-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 8px;
            }
            .offline-log-name {
                font-size: 0.78rem;
                color: #dbeafe;
                font-weight: 800;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }
            .offline-log-status {
                font-size: 0.68rem;
                color: #bfdbfe;
                background: rgba(59,130,246,0.15);
                border: 1px solid rgba(96,165,250,0.3);
                border-radius: 999px;
                padding: 2px 8px;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                font-weight: 700;
            }
            .offline-log-summary {
                font-size: 0.8rem;
                color: #cbd5e1;
                line-height: 1.5;
                white-space: pre-wrap;
                word-break: break-word;
                overflow-wrap: anywhere;
                max-height: 150px;
                overflow-y: auto;
                overflow-x: hidden;
                scrollbar-width: thin;
                scrollbar-color: rgba(96,165,250,0.45) rgba(255,255,255,0.03);
                padding-right: 4px;
            }
            .offline-log-summary::-webkit-scrollbar {
                width: 8px;
            }
            .offline-log-summary::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.03);
                border-radius: 10px;
            }
            .offline-log-summary::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, rgba(96,165,250,0.55), rgba(59,130,246,0.45));
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.06);
            }
            
            /* Message Bubbles */
            .message { margin: 12px 0; }
            .message .bubble {
                background: #101720;
                border: 1px solid #263447;
                border-radius: 10px;
                padding: 14px 16px;
                box-shadow: none;
            }
            .message.user .bubble {
                background: #111a26;
                border-color: #30435f;
            }
            .message.model .bubble {
                background: #101720;
                border-color: #2b3a4f;
            }
            
            .final-answer-instant {
                background: #111a24;
                border: 1px solid #263447;
                border-radius: 8px;
                padding: 12px 13px;
                color: #e2e8f0;
                line-height: 1.65;
            }
            .final-answer-instant.db-response-card {
                background:
                    radial-gradient(120% 180% at 100% 0%, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0) 52%),
                    linear-gradient(180deg, #111c28 0%, #0f1924 100%);
                border-color: rgba(80, 142, 235, 0.35);
                border-radius: 12px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 26px rgba(0,0,0,0.28);
                padding: 14px 15px;
            }
            .db-response-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 0.68rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.9px;
                color: #bfdbfe;
                background: rgba(59, 130, 246, 0.15);
                border: 1px solid rgba(96, 165, 250, 0.3);
                border-radius: 999px;
                padding: 4px 9px;
                margin-bottom: 10px;
            }
            .db-response-chip::before {
                content: '';
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #60a5fa;
                box-shadow: 0 0 10px rgba(96, 165, 250, 0.75);
            }
            .db-response-card .pro-h2 {
                font-size: 1.04rem;
                margin-top: 0.85rem;
            }
            .db-response-card .pro-p {
                color: #dbe5f4;
            }
            .db-response-card .pro-ul {
                margin-bottom: 8px;
            }
            .db-response-card .pro-li {
                padding-left: 1.35rem;
                margin-bottom: 6px;
            }
            .action-btn { 
                background: rgba(255,255,255,0.05); 
                border: 1px solid var(--omni-border); 
                color: var(--omni-text-sub); 
                padding: 6px; 
                border-radius: 6px; 
                cursor: pointer; 
                transition: all 0.2s; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                z-index: 50; /* Ensure on top */
            }
            .action-btn:hover { 
                background: rgba(255,255,255,0.1); 
                color: #fff; 
                border-color: rgba(255,255,255,0.2);
            }
            .action-btn.active { color: var(--omni-accent); background: rgba(99, 102, 241, 0.1); border-color: var(--omni-accent); }
            
            /* TTS Indicator */
            .tts-indicator {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                background: rgba(99, 102, 241, 0.15);
                border: 1px solid rgba(99, 102, 241, 0.3);
                border-radius: 20px;
                font-size: 0.7rem;
                color: var(--omni-accent);
                font-weight: 600;
                margin-left: auto;
                animation: ttsPulse 2s ease-in-out infinite;
            }
            
            .tts-indicator svg {
                width: 14px;
                height: 14px;
            }
            
            .tts-indicator.paused {
                background: rgba(245, 158, 11, 0.15);
                border-color: rgba(245, 158, 11, 0.3);
                color: #fbbf24;
                animation: none;
            }
            
            @keyframes ttsPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .db-topic-popup {
                position: absolute;
                left: 52px;
                right: 52px;
                bottom: calc(100% - 6px);
                border-radius: 12px;
                border: 1px solid rgba(99, 102, 241, 0.38);
                background: rgba(9, 13, 21, 0.96);
                box-shadow: 0 14px 36px rgba(0, 0, 0, 0.42);
                backdrop-filter: blur(14px);
                z-index: 240;
                overflow: hidden;
            }

            .db-topic-popup.hidden {
                display: none;
            }

            .db-topic-popup-header {
                padding: 8px 12px;
                font-size: 0.72rem;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #c7d2fe;
                border-bottom: 1px solid rgba(99, 102, 241, 0.22);
                background: rgba(99, 102, 241, 0.08);
            }

            .db-topic-popup-list {
                max-height: 208px;
                overflow-y: auto;
                padding: 6px;
            }

            .db-topic-item {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                border: 0;
                border-radius: 8px;
                padding: 8px 10px;
                background: transparent;
                color: #cbd5e1;
                font-size: 0.86rem;
                text-align: left;
                cursor: pointer;
            }

            .db-topic-item:hover,
            .db-topic-item.active {
                background: rgba(99, 102, 241, 0.22);
                color: #ffffff;
            }

            .db-topic-item-token {
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.8rem;
                color: #dbeafe;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .db-topic-item-hint {
                font-size: 0.68rem;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }

            @media (max-width: 720px) {
                .db-topic-popup {
                    left: 10px;
                    right: 10px;
                }
            }

            .typewriter-content {
                white-space: pre-wrap;
                color: #e2e8f0;
                line-height: 1.7;
            }

            .typewriter-cursor {
                display: inline-block;
                width: 2px;
                height: 1em;
                margin-left: 2px;
                background: var(--omni-accent);
                vertical-align: text-bottom;
                animation: omniCursorBlink 0.85s steps(1) infinite;
            }

            @keyframes omniCursorBlink {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0; }
            }

            .error-message { background: rgba(239, 68, 68, 0.1); color: #fca5a5; padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); font-size: 0.9rem; margin-top: 8px; }
        `;
        document.head.appendChild(style);
    }

    const els = {
        messages: document.getElementById('chat-messages'),
        input: document.getElementById('chat-input'),
        btnSend: document.getElementById('btn-send'),
        welcome: document.getElementById('welcome-screen'),
        btnNewChat: document.getElementById('btn-new-chat'),
        btnSettings: document.getElementById('btn-chat-settings'),
        btnOpenLlama: document.getElementById('btn-open-llama-web'),
        iconSend: document.getElementById('icon-send'),
        iconStop: document.getElementById('icon-stop'),
        btnPlus: document.getElementById('btn-abilities-plus'),
        abilitiesPopup: document.getElementById('abilities-popup'),
        btnAbilityNothing: document.getElementById('btn-ability-nothing'),
        btnToggleQuickSearch: document.getElementById('btn-toggle-quick-search'),
        btnToggleSearch: document.getElementById('btn-toggle-search'),
        btnToggleWiki: document.getElementById('btn-toggle-wiki'),
        btnToggleVideo: document.getElementById('btn-toggle-video'),
        btnEnhance: document.getElementById('btn-enhance-popup'),
        btnAttach: document.getElementById('btn-attach-popup'),
        attachedAssetsPreview: document.getElementById('attached-assets-preview'),
        attachmentsList: document.getElementById('attachments-list'),
        attachmentCount: document.getElementById('attachment-count'),
        clearAllAttachments: document.getElementById('clear-all-attachments'),
        modeCapsule: document.getElementById('mode-capsule'),
        modeNickname: document.getElementById('mode-nickname'),
        wikiModal: document.getElementById('wiki-url-modal'),
        wikiInput: document.getElementById('wiki-url-input'),
        btnWikiCancel: document.getElementById('btn-wiki-cancel'),
        btnWikiConfirm: document.getElementById('btn-wiki-confirm'),
        serpapiQuotaContainer: document.getElementById('serpapi-quota-container'),
        quotaLimit: document.getElementById('quota-limit'),
        quotaUsed: document.getElementById('quota-used'),
        quotaRemaining: document.getElementById('quota-remaining')
    };

    let chatHistory = [];
    let isGenerating = false;
    let currentMode = 'nothing'; 
    let offlineModeLocked = false;
    let attachedAssets = [];
    let lastUserQuery = '';
    let config = { provider: 'google', model: 'gemini-3-flash-preview', key: '', aiConfig: null };
    const databaseTopics = Array.from(new Set(getAvailableTopics()))
        .map((topic) => String(topic || '').trim())
        .filter((topic) => topic.length > 0)
        .sort((a, b) => a.localeCompare(b));
    let dbTopicPopup = null;
    let dbTopicMatches = [];
    let dbTopicActiveIndex = 0;

    // Video search helper
    const searchVideosForResponse = async (query) => {
        if (!query) return [];
        try {
            const result = await window.browserAPI.ai.webSearch(query + " site:youtube.com");
            if (result && result.sources && result.sources.length > 0) {
                return result.sources.filter(v => v.url.includes('youtube.com') || v.url.includes('youtu.be')).slice(0, 3);
            }
        } catch (e) {
            console.error("Video search failed:", e);
        }
        return [];
    };

    const extractVideoId = (url) => {
        if (!url) return null;
        let videoId = '';
        if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        return videoId || null;
    };

    const createResponseVideoCard = (video) => {
        const videoId = extractVideoId(video.url);
        if (!videoId) return null;

        const card = document.createElement('div');
        card.className = 'video-card';
        card.style.cssText = `
            background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(34,197,94,0.05) 100%);
            border: 1px solid rgba(16,185,129,0.2);
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            display: inline-block;
            width: 240px;
            margin: 10px 10px 10px 0;
        `;

        const thumb = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        card.innerHTML = `
            <div style="position: relative; width: 100%; padding-bottom: 56.25%; background: #000;">
                <img src="${thumb}" 
                     onerror="this.src='https://img.youtube.com/vi/${videoId}/0.jpg'"
                     style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            width: 48px; height: 48px; background: rgba(255,255,255,0.95); 
                            border-radius: 50%; display: flex; align-items: center; justify-content: center;
                            font-size: 20px; color: #000; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                            transition: all 0.2s;">▶</div>
            </div>
            <div style="padding: 10px; background: rgba(0,0,0,0.3);">
                <div style="font-size: 12px; color: #10b981; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">YouTube</div>
                <div style="font-size: 12px; color: #cbd5e1; line-height: 1.3; 
                            overflow: hidden; text-overflow: ellipsis; display: -webkit-box; 
                            -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${video.title || 'Video'}
                </div>
            </div>
        `;

        card.onmouseenter = () => {
            card.style.transform = 'translateY(-4px) scale(1.02)';
            card.style.boxShadow = '0 12px 32px rgba(16,185,129,0.2)';
            card.style.borderColor = '#10b981';
            card.querySelector('img').style.transform = 'scale(1.05)';
        };

        card.onmouseleave = () => {
            card.style.transform = 'translateY(0) scale(1)';
            card.style.boxShadow = '';
            card.style.borderColor = 'rgba(16,185,129,0.2)';
            card.querySelector('img').style.transform = 'scale(1)';
        };

        card.onclick = () => {
            window.browserAPI.openTab(`https://www.youtube.com/watch?v=${videoId}`);
        };

        return card;
    };

    const loadConfig = async () => {
        try {
            const settings = await window.browserAPI.settings.get();
            const provider = settings.activeProvider || 'google';
            const pConfig = settings.providers?.[provider] || {};
            let localAiConfig = {};
            try {
                localAiConfig = JSON.parse(localStorage.getItem('omni_ai_module_settings') || '{}');
            } catch {
                localAiConfig = {};
            }
            const mergedAiConfig = {
                ...(settings.aiConfig || {}),
                ...(localAiConfig || {})
            };
            config = {
                provider,
                key: pConfig.key || '',
                model: pConfig.model || (provider === 'google' ? 'gemini-3-flash-preview' : ''),
                baseUrl: pConfig.baseUrl || '',
                aiConfig: mergedAiConfig
            };
        } catch (e) {
            console.warn("AI Config Load Failure", e);
            // Never keep stale offline lock if config read fails.
            config = { provider: 'google', model: 'gemini-3-flash-preview', key: '', aiConfig: {} };
        } finally {
            syncOfflineModeLock();
        }
    };

    const resolveLlamaWebUrl = () => {
        const raw =
            config.aiConfig?.llamaWebUrl ||
            config.aiConfig?.llamacpp?.baseUrl ||
            'http://localhost:8081';
        const trimmed = (raw || '').trim();
        if (!trimmed) return 'http://localhost:8081';
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `http://${trimmed}`;
    };

    const updateModeUI = () => {
        const nicknames = {
            nothing: '',
            quick_search: 'Quick Retrieval',
            web: 'Deep Neural',
            wiki: 'Wiki Brain',
            video: 'Video Discover'
        };

        if (currentMode !== 'nothing') {
            els.modeCapsule.classList.add('active');
            els.modeCapsule.className = `mode-capsule active mode-${currentMode}`;
            els.modeNickname.textContent = nicknames[currentMode];
        } else {
            if(els.modeCapsule) els.modeCapsule.classList.remove('active');
        }
    };

    const updateSendButtonState = () => {
        if (!isGenerating && els.btnSend) {
            const hasText = els.input.value.trim().length > 0;
            els.btnSend.disabled = !hasText && attachedAssets.length === 0;
            // Ensure input is always enabled
            if (els.input && els.input.disabled) {
                els.input.disabled = false;
            }
        }
    };

    const scrollToBottom = () => { 
        if (els.messages) {
            els.messages.scrollTo({
                top: els.messages.scrollHeight,
                behavior: 'smooth'
            });
        } 
    };

    const ensureInputActive = () => {
        if (els.input) {
            // Remove disabled state if it exists
            if (els.input.disabled) {
                els.input.disabled = false;
            }
            // Remove readonly if it exists
            if (els.input.readOnly) {
                els.input.readOnly = false;
            }
            // Ensure it's visible and can receive pointer events
            els.input.style.pointerEvents = 'auto';
            els.input.style.opacity = '1';
            els.input.style.cursor = 'text';
        }
    };

    const formatDatabaseTopicList = (topics) => {
        return topics.map((topic, index) => `${index + 1}. \`@${topic}\``).join('\n');
    };

    const findRelatedDatabaseTopics = (query, limit = 10) => {
        const normalized = (query || '').toLowerCase().trim();
        const queryWords = normalized.split(/\s+/).filter((word) => word.length > 1);

        if (!normalized) {
            return databaseTopics.slice(0, limit);
        }

        const ranked = databaseTopics
            .map((topic) => {
                const lowerTopic = topic.toLowerCase();
                let score = 0;

                if (lowerTopic === normalized) score += 100;
                if (lowerTopic.startsWith(normalized)) score += 55;
                if (lowerTopic.includes(normalized)) score += 40;

                for (const word of queryWords) {
                    if (lowerTopic.includes(word)) score += 10;
                }

                return { topic, score };
            })
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));

        return ranked.slice(0, limit).map((entry) => entry.topic);
    };

    const buildDatabaseFallbackResponse = (query) => {
        const safeTopics = databaseTopics.length > 0
            ? databaseTopics
            : ['panels', 'buttons', 'navigation', 'feature workflows', 'page modules'];
        const trimmedQuery = (query || '').trim();

        if (!trimmedQuery) {
            return `## OM-X Local Database Mode
The \`@\` command uses the local hardcoded database as the source of truth, then rewrites it into natural response format.

### Available Topics
${formatDatabaseTopicList(safeTopics.slice(0, 12))}

### Quick Examples
- \`@panels\`
- \`@buttons\`
- \`@navigation\`
- \`@feature workflows\`
- \`@page modules\``;
        }

        const closestTopics = findRelatedDatabaseTopics(trimmedQuery, 10);
        const topicsForDisplay = closestTopics.length > 0 ? closestTopics : safeTopics.slice(0, 10);

        return `## OM-X Local Database Mode
No exact hardcoded entry was found for \`${trimmedQuery}\`.

### Closest Topics
${formatDatabaseTopicList(topicsForDisplay)}

### Next Step
Ask with one of the listed topics, for example: \`@${topicsForDisplay[0] || 'panels'}\``;
    };

    const rewriteDatabaseResponseWithAI = async (userText, query, localKnowledge) => {
        const knowledgeText = String(localKnowledge || '').trim();
        if (!knowledgeText) return null;
        if (!window.browserAPI?.ai?.performTask) return null;

        await loadConfig();

        const systemInstruction = `You are Omni for OM-X.
Rewrite local database content into a polished, professional answer.
Rules:
1. Use only the LOCAL DATABASE DATA provided below.
2. Do not add external facts, web data, or assumptions.
3. Keep wording precise, professional, and concise.
4. Avoid dumping internal ids unless they are directly useful for the user action.
5. If local data is missing, say so clearly and suggest related @ topics.
6. Do not use tools/search in this mode.
7. Output in this exact markdown structure:
## Quick Overview
1-2 short paragraphs.

## What You Can Do
3-6 bullet points.

## Suggested Next Step
One concise action sentence.
8. Do not include code fences or XML-like tags.`;

        const userPrompt = `USER QUESTION:
${userText}

QUERY TOKEN:
${query || '(none)'}

LOCAL DATABASE DATA:
${knowledgeText}

Return a polished final answer based only on LOCAL DATABASE DATA.`;

        const result = await window.browserAPI.ai.performTask({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            configOverride: config,
            systemInstruction,
            searchMode: false,
            wikiMode: false,
            videoMode: false,
            searchDepth: 'standard'
        });

        if (result?.error) {
            throw new Error(result.error);
        }

        const rewritten = String(result?.text || '')
            .replace(/<think>([\s\S]*?)<\/think>/gi, '')
            .trim();

        return rewritten || null;
    };

    const normalizeDatabaseResponse = (responseText, query) => {
        const fallback = buildDatabaseFallbackResponse(query || '');
        const source = String(responseText || '').trim() || fallback;
        const cleaned = source
            .replace(/<think>([\s\S]*?)<\/think>/gi, '')
            .replace(/\r/g, '')
            .trim();

        const hasOverview = /##\s*quick overview/i.test(cleaned);
        const hasActions = /##\s*what you can do/i.test(cleaned);
        const hasNext = /##\s*suggested next step/i.test(cleaned);
        if (hasOverview && hasActions && hasNext) {
            return cleaned;
        }

        const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
        const bullets = lines
            .filter((line) => /^(-|\*|\d+\.)\s+/.test(line))
            .map((line) => line.replace(/^(-|\*|\d+\.)\s+/, '').trim())
            .filter(Boolean)
            .slice(0, 5);
        const plain = lines
            .filter((line) => !/^(-|\*|\d+\.)\s+/.test(line) && !/^#{1,3}\s+/.test(line))
            .slice(0, 5);

        const overview = plain.slice(0, 2).join(' ') || 'This topic is available in the local OM-X knowledge base.';
        const actionItems = bullets.length > 0 ? bullets : plain.slice(2, 6);
        const nextStep = actionItems[0]
            ? `Use @${(query || '').trim() || 'panels'} and ask for that area in more detail.`
            : 'Use a specific @ topic to get a focused walkthrough.';

        const actionsBlock = actionItems.length > 0
            ? actionItems.map((item) => `- ${item}`).join('\n')
            : '- Ask for a narrower @ topic to see a focused answer.';

        return `## Quick Overview
${overview}

## What You Can Do
${actionsBlock}

## Suggested Next Step
${nextStep}`;
    };

    const ensureDatabaseTopicPopup = () => {
        if (dbTopicPopup) return dbTopicPopup;
        if (!els.input) return null;

        const chatInputBox = els.input.closest('.chat-input-box');
        if (!chatInputBox) return null;

        dbTopicPopup = document.createElement('div');
        dbTopicPopup.className = 'db-topic-popup hidden';
        dbTopicPopup.innerHTML = `
            <div class="db-topic-popup-header">Loaded Local Topics</div>
            <div class="db-topic-popup-list"></div>
        `;
        chatInputBox.appendChild(dbTopicPopup);
        return dbTopicPopup;
    };

    const hideDatabaseTopicPopup = () => {
        if (dbTopicPopup) {
            dbTopicPopup.classList.add('hidden');
        }
        dbTopicMatches = [];
        dbTopicActiveIndex = 0;
    };

    const applyDatabaseTopicFromPopup = (topic) => {
        if (!els.input || !topic) return;
        els.input.value = `@${topic} `;
        els.input.focus();
        els.input.style.height = 'auto';
        els.input.style.height = Math.min(els.input.scrollHeight, 100) + 'px';
        updateSendButtonState();
        hideDatabaseTopicPopup();
    };

    const renderDatabaseTopicPopup = () => {
        if (!els.input) return;

        const rawValue = els.input.value || '';
        const trimmedStart = rawValue.trimStart();
        const mentionBody = trimmedStart.replace(/^@/, '');
        const hasExpandedBeyondTopic = /\S+\s+/.test(mentionBody);

        if (!trimmedStart.startsWith('@') || hasExpandedBeyondTopic) {
            hideDatabaseTopicPopup();
            return;
        }

        const popup = ensureDatabaseTopicPopup();
        if (!popup) return;

        const query = processDatabaseQuery(trimmedStart);
        const matchedTopics = findRelatedDatabaseTopics(query, 12);
        dbTopicMatches = matchedTopics.length > 0 ? matchedTopics : databaseTopics.slice(0, 12);

        if (dbTopicMatches.length === 0) {
            hideDatabaseTopicPopup();
            return;
        }

        if (dbTopicActiveIndex < 0 || dbTopicActiveIndex >= dbTopicMatches.length) {
            dbTopicActiveIndex = 0;
        }

        const list = popup.querySelector('.db-topic-popup-list');
        if (!list) return;
        list.innerHTML = '';

        dbTopicMatches.forEach((topic, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `db-topic-item${index === dbTopicActiveIndex ? ' active' : ''}`;
            item.innerHTML = `
                <span class="db-topic-item-token">@${topic}</span>
                <span class="db-topic-item-hint">local</span>
            `;
            item.addEventListener('mousedown', (event) => event.preventDefault());
            item.addEventListener('click', () => applyDatabaseTopicFromPopup(topic));
            list.appendChild(item);
        });

        popup.classList.remove('hidden');
    };

    const handleDatabaseTopicPopupKeydown = (event) => {
        if (!dbTopicPopup || dbTopicPopup.classList.contains('hidden') || dbTopicMatches.length === 0) {
            return false;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            dbTopicActiveIndex = (dbTopicActiveIndex + 1) % dbTopicMatches.length;
            renderDatabaseTopicPopup();
            return true;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            dbTopicActiveIndex = (dbTopicActiveIndex - 1 + dbTopicMatches.length) % dbTopicMatches.length;
            renderDatabaseTopicPopup();
            return true;
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const selectedTopic = dbTopicMatches[dbTopicActiveIndex] || dbTopicMatches[0];
            if (selectedTopic) {
                applyDatabaseTopicFromPopup(selectedTopic);
                return true;
            }
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            hideDatabaseTopicPopup();
            return true;
        }

        return false;
    };

    const renderDatabaseOnlyResponse = async (userText, responseText) => {
        appendMessage('user', userText);

        const { bubble: responseBubble, msgDiv: responseMsgDiv } = appendMessage('model');
        const workbench = new NeuralWorkbench(responseBubble, responseMsgDiv);
        await workbench.createTodoList('nothing', false);

        workbench.updateTask('intent', 'active');
        await new Promise((resolve) => setTimeout(resolve, 420));
        workbench.updateTask('intent', 'completed');
        workbench.updateTask('synthesis', 'active');
        await new Promise((resolve) => setTimeout(resolve, 360));

        const finalArea = document.createElement('div');
        finalArea.className = 'final-answer-instant db-response-card omni-fade-in';
        finalArea.innerHTML = '<div class="db-response-chip">Local Database Response</div>';
        responseBubble.appendChild(finalArea);

        const normalizedResponse = normalizeDatabaseResponse(responseText, processDatabaseQuery(userText));
        const typingText = String(normalizedResponse || '')
            .replace(/<[^>]*>/g, '')
            .trim();
        await simulateTyping(finalArea, typingText, 6);
        await new Promise((resolve) => setTimeout(resolve, 90));
        finalArea.innerHTML = `<div class="db-response-chip">Local Database Response</div>${formatOutput(normalizedResponse)}`;

        const aiTheme = localStorage.getItem('ai_response_theme') || 'default';
        if (aiTheme && aiTheme !== 'default') {
            responseBubble.classList.add(`theme-${aiTheme}`);
            responseMsgDiv.classList.add(`theme-${aiTheme}`);
        }

        appendActionBar(responseBubble, normalizedResponse, userText, []);
        setupInteractiveElements(responseBubble);

        workbench.updateTask('synthesis', 'completed');
        workbench.destroy();
    };

    const simulateTyping = (targetElement, text, speed = 8) => {
        return new Promise((resolve) => {
            if (!text) { resolve(); return; }
            let i = 0;
            const container = document.createElement('span');
            container.className = 'typewriter-content';
            const cursor = document.createElement('span');
            cursor.className = 'typewriter-cursor';
            targetElement.appendChild(container);
            targetElement.appendChild(cursor);

            const interval = setInterval(() => {
                if (i < text.length) {
                    container.textContent += text.charAt(i);
                    i++;
                    if (i % 8 === 0) scrollToBottom();
                } else {
                    clearInterval(interval);
                    cursor.remove();
                    resolve();
                }
            }, speed);
        });
    };

    // --- Advanced TTS Controller ---
    const ttsController = {
        activeUtterance: null,
        audioElement: null,
        activeBubble: null,
        originalHTML: null,
        onStateChange: null, 
        fallbackTimer: null,
        fallbackWordIndex: 0,
        fallbackWordCount: 0,
        fallbackRunning: false,
        boundarySeen: false,

        clearHighlight() {
            if (!this.activeBubble) return;
            this.activeBubble.querySelectorAll('.tts-word').forEach(w => w.classList.remove('tts-active-word'));
        },

        setActiveWord(index) {
            if (!this.activeBubble) return;
            this.clearHighlight();
            const activeSpan = this.activeBubble.querySelector(`#tts-w-${index}`);
            if (activeSpan) activeSpan.classList.add('tts-active-word');
        },

        startFallbackHighlight(rate = 1) {
            if (!this.activeBubble || this.fallbackWordCount <= 0) return;
            this.stopFallbackHighlight();
            const intervalMs = Math.max(90, Math.round(220 / Math.max(0.5, Number(rate) || 1)));
            this.fallbackRunning = true;
            this.fallbackTimer = setInterval(() => {
                if (!this.fallbackRunning) return;
                if (this.fallbackWordIndex >= this.fallbackWordCount) {
                    this.stopFallbackHighlight();
                    return;
                }
                this.setActiveWord(this.fallbackWordIndex);
                this.fallbackWordIndex += 1;
            }, intervalMs);
        },

        pauseFallbackHighlight() {
            this.fallbackRunning = false;
        },

        resumeFallbackHighlight() {
            if (this.fallbackTimer) this.fallbackRunning = true;
        },

        stopFallbackHighlight() {
            if (this.fallbackTimer) {
                clearInterval(this.fallbackTimer);
                this.fallbackTimer = null;
            }
            this.fallbackRunning = false;
        },
        
        getState() {
            if (this.audioElement) {
                return this.audioElement.paused ? 'paused' : 'playing';
            }
            if (window.speechSynthesis.speaking) {
                return window.speechSynthesis.paused ? 'paused' : 'playing';
            }
            return 'idle';
        },

        pause() {
            if (this.audioElement) this.audioElement.pause();
            else window.speechSynthesis.pause();
            this.pauseFallbackHighlight();
            
            // Restore original professional format when pausing
            if (this.activeBubble && this.originalHTML) {
                this.activeBubble.innerHTML = this.originalHTML;
            }
            
            if (this.onStateChange) this.onStateChange('paused');
        },

        async resume() {
            // Re-apply highlighting before resuming speech
            if (this.activeBubble && this.originalHTML) {
                const ttsSettings = config.aiConfig?.tts || { provider: 'browser-speech', rate: 1, pitch: 1, highlight: true };
                
                if (ttsSettings.highlight) {
                    // Get clean text from originalHTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this.originalHTML;
                    const cleanText = tempDiv.textContent || tempDiv.innerText;
                    
                    if (cleanText) {
                        const words = cleanText.split(/\s+/);
                        this.fallbackWordCount = words.length;
                        this.activeBubble.innerHTML = words.map((w, i) => `<span class="tts-word" id="tts-w-${i}">${w}</span>`).join(' ');
                        this.setActiveWord(Math.max(0, this.fallbackWordIndex - 1));
                        
                        if (!document.getElementById('tts-highlight-style')) {
                            const style = document.createElement('style');
                            style.id = 'tts-highlight-style';
                            style.textContent = `.tts-word { transition: background 0.1s, color 0.1s; border-radius: 4px; padding: 0 2px; } .tts-active-word { background: rgba(99, 102, 241, 0.3); color: #fff; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }`;
                            document.head.appendChild(style);
                        }
                    }
                } else {
                    this.activeBubble.innerHTML = this.originalHTML;
                }
            }
            
            if (this.audioElement) this.audioElement.play();
            else window.speechSynthesis.resume();
            this.resumeFallbackHighlight();
            
            if (this.onStateChange) this.onStateChange('playing');
        },

        stop() {
            if (this.audioElement) {
                this.audioElement.pause();
                this.audioElement = null;
            }
            window.speechSynthesis.cancel();
            this.stopFallbackHighlight();
            if (this.activeBubble && this.originalHTML) {
                this.activeBubble.innerHTML = this.originalHTML;
            }
            this.activeBubble = null;
            this.originalHTML = null;
            this.fallbackWordIndex = 0;
            this.fallbackWordCount = 0;
            this.boundarySeen = false;
            if (this.onStateChange) this.onStateChange('idle');
        },

        async speakWithHighlight(bubble, text, uiCallback) {
            const state = this.getState();
            this.onStateChange = uiCallback;

            if (state === 'playing') {
                this.pause();
                return;
            } else if (state === 'paused') {
                this.resume();
                return;
            }

            this.stop();
            await loadConfig();
            const ttsSettings = config.aiConfig?.tts || { provider: 'browser-speech', rate: 1, pitch: 1, highlight: true };
            
            const lines = text.split('\n')
                .filter(l => !l.trim().startsWith('#'))
                .filter(l => !/^[^\w\d\s]+$/.test(l.trim()));
            
            const cleanText = lines.join(' ').replace(/[*_~`]/g, '').trim();
            if (!cleanText) return;

            this.activeBubble = bubble;
            this.originalHTML = bubble.innerHTML;
            
            if (ttsSettings.highlight) {
                const words = cleanText.split(/\s+/);
                this.fallbackWordCount = words.length;
                this.fallbackWordIndex = 0;
                this.boundarySeen = false;
                bubble.innerHTML = words.map((w, i) => `<span class="tts-word" id="tts-w-${i}">${w}</span>`).join(' ');
                
                if (!document.getElementById('tts-highlight-style')) {
                    const style = document.createElement('style');
                    style.id = 'tts-highlight-style';
                    style.textContent = `.tts-word { transition: background 0.1s, color 0.1s; border-radius: 4px; padding: 0 2px; } .tts-active-word { background: rgba(99, 102, 241, 0.3); color: #fff; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }`;
                    document.head.appendChild(style);
                }
            }

            if (this.onStateChange) this.onStateChange('playing');

            if (ttsSettings.provider === 'murf') {
                return this.speakMurf(bubble, cleanText, ttsSettings);
            }
            if (ttsSettings.provider === 'elevenlabs') {
                return this.speakElevenLabs(bubble, cleanText, ttsSettings);
            }
            if (ttsSettings.provider === 'sarvamai') {
                return this.speakSarvam(bubble, cleanText, ttsSettings);
            }

            const utter = new SpeechSynthesisUtterance(cleanText);
            this.activeUtterance = utter;
            const voices = window.speechSynthesis.getVoices();
            if (ttsSettings.voice) utter.voice = voices.find(v => v.name === ttsSettings.voice);
            utter.rate = ttsSettings.rate || 1;
            utter.pitch = ttsSettings.pitch || 1;

            utter.onboundary = (event) => {
                if (event.name === 'word' && ttsSettings.highlight) {
                    this.boundarySeen = true;
                    const charIdx = event.charIndex;
                    const wordIdx = cleanText.substring(0, charIdx).split(/\s+/).filter(x => x.length > 0).length;
                    this.fallbackWordIndex = wordIdx + 1;
                    this.setActiveWord(wordIdx);
                }
            };

            utter.onend = () => {
                this.stop();
            };

            if (ttsSettings.highlight) {
                setTimeout(() => {
                    if (!this.boundarySeen && this.getState() !== 'idle') {
                        this.startFallbackHighlight(utter.rate || 1);
                    }
                }, 800);
            }

            window.speechSynthesis.speak(utter);
        },

        async speakMurf(bubble, text, settings) {
            const apiKey = config.aiConfig?.keys?.murf;
            if (!apiKey) {
                bubble.innerHTML = this.originalHTML + '<br><small style="color:#ef4444">Murf API Key missing in settings.</small>';
                this.onStateChange('idle');
                return false;
            }

            try {
                const response = await fetch('https://api.murf.ai/v1/speech/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
                    body: JSON.stringify({
                        voiceId: settings.murfVoiceId || 'en-US-natalie',
                        text: text,
                        format: 'MP3',
                        rate: Math.round(settings.rate * 100) || 100,
                        pitch: Math.round(settings.pitch * 10) || 0
                    })
                });

                if (!response.ok) throw new Error("Murf API Error: " + response.status);
                const data = await response.json();
                const audioUrl = data.encodedAudio ? `data:audio/mp3;base64,${data.encodedAudio}` : data.audioUrl;
                
                if (audioUrl) {
                    this.audioElement = new Audio(audioUrl);
                    this.audioElement.onended = () => this.stop();
                    if (settings.highlight) {
                        this.startFallbackHighlight(settings.rate || 1);
                    }
                    this.audioElement.play();
                    return true;
                }
                return false;
            } catch (e) {
                bubble.innerHTML = this.originalHTML + `<br><small style="color:#ef4444">Murf API Error: ${e.message}</small>`;
                this.onStateChange('idle');
                return false;
            }
        },

        async speakElevenLabs(bubble, text, settings) {
            const apiKey = config.aiConfig?.keys?.elevenlabs;
            if (!apiKey) {
                bubble.innerHTML = this.originalHTML + '<br><small style="color:#ef4444">ElevenLabs API key missing in settings.</small>';
                this.onStateChange('idle');
                return false;
            }

            try {
                const ttsRes = await window.browserAPI.ai.generateSpeech({
                    provider: 'elevenlabs',
                    text,
                    settings: {
                        apiKey,
                        voiceId: settings?.elevenlabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb',
                        modelId: settings?.elevenlabsModelId || 'eleven_turbo_v2_5',
                        speed: settings?.rate || 1
                    }
                });

                if (!ttsRes?.success || !ttsRes?.audioBase64) {
                    throw new Error(ttsRes?.error || 'ElevenLabs returned no audio.');
                }

                const audioUrl = `data:${ttsRes.mimeType || 'audio/mpeg'};base64,${ttsRes.audioBase64}`;
                this.audioElement = new Audio(audioUrl);
                this.audioElement.onended = () => this.stop();
                if (settings.highlight) this.startFallbackHighlight(settings.rate || 1);
                await this.audioElement.play();
                return true;
            } catch (e) {
                bubble.innerHTML = this.originalHTML + `<br><small style="color:#ef4444">ElevenLabs TTS Error: ${e.message}</small>`;
                this.onStateChange('idle');
                return false;
            }
        },

        async speakSarvam(bubble, text, settings) {
            const apiKey = config.aiConfig?.keys?.sarvam;
            if (!apiKey) {
                bubble.innerHTML = this.originalHTML + '<br><small style="color:#ef4444">SarvamAI API key missing in settings.</small>';
                this.onStateChange('idle');
                return false;
            }

            try {
                const ttsRes = await window.browserAPI.ai.generateSpeech({
                    provider: 'sarvamai',
                    text,
                    settings: {
                        apiKey,
                        targetLanguageCode: settings?.sarvamTargetLanguage || 'hi-IN'
                    }
                });

                if (!ttsRes?.success || !ttsRes?.audioBase64) {
                    throw new Error(ttsRes?.error || 'SarvamAI returned no audio.');
                }

                const audioUrl = `data:${ttsRes.mimeType || 'audio/wav'};base64,${ttsRes.audioBase64}`;
                this.audioElement = new Audio(audioUrl);
                this.audioElement.onended = () => this.stop();
                if (settings.highlight) this.startFallbackHighlight(settings.rate || 1);
                await this.audioElement.play();
                return true;
            } catch (e) {
                bubble.innerHTML = this.originalHTML + `<br><small style="color:#ef4444">SarvamAI TTS Error: ${e.message}</small>`;
                this.onStateChange('idle');
                return false;
            }
        }
    };

    class NeuralWorkbench {
        constructor(container, messageEl) {
            this.container = container;
            this.messageEl = messageEl;
            this.tasks = [];
            this.el = document.createElement('div');
            this.el.className = 'neural-process omni-fade-in';
            this.container.appendChild(this.el);
            this.messageEl.classList.add('ai-generating');
        }

        async animateReasoning(reasoning) {
            if (!reasoning) return;
            
            // Create collapsible container using new system
            const container = document.createElement('div');
            container.className = 'collapsible-container reasoning';
            
            container.innerHTML = `
                <div class="container-header">
                    <div class="container-header-title">
                        <div class="container-header-icon pulsing">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                        </div>
                        <span class="container-header-text">Thought Trace</span>
                    </div>
                    <button class="toggle-btn" aria-label="Toggle reasoning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="container-content">
                    <div class="container-content-inner reasoning-content" style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #cbd5e1; line-height: 1.7; white-space: pre-wrap; word-break: break-word;"></div>
                </div>
            `;
            
            const content = container.querySelector('.reasoning-content');
            const icon = container.querySelector('.container-header-icon');
            
            this.el.appendChild(container);
            scrollToBottom();

            // Type out the reasoning content
            await simulateTyping(content, reasoning, 4);
            
            await new Promise(r => setTimeout(r, 800));
            icon.classList.remove('pulsing');
            
            // Auto-collapse after animation completes
            setTimeout(() => {
                container.classList.add('collapsed');
            }, 1200);
        }

        async animateCanvas(type, content) {
            if (!content) return;
            
            // Create collapsible code/manuscript container
            const container = document.createElement('div');
            container.className = 'collapsible-container code';
            
            let title = 'Output';
            let iconSvg = '';
            
            if (type === 'code') {
                title = 'Source Code';
                iconSvg = '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>';
            } else if (type === 'manuscript') {
                title = 'Manuscript';
                iconSvg = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>';
            }

            container.innerHTML = `
                <div class="container-header">
                    <div class="container-header-title">
                        <div class="container-header-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                                ${iconSvg}
                            </svg>
                        </div>
                        <span class="container-header-text">${title}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="btn-copy" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 6px 12px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">COPY</button>
                        <button class="toggle-btn" aria-label="Toggle code">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="container-content">
                    <div class="container-content-inner canvas-body ${type}" style="padding: 0; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; line-height: 1.6; background: rgba(0,0,0,0.3); border-radius: 8px; overflow-x: auto;"></div>
                </div>
            `;
            
            this.el.appendChild(container);
            scrollToBottom();

            const body = container.querySelector('.canvas-body');
            const copyBtn = container.querySelector('.btn-copy');
            
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(content);
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'COPIED!';
                copyBtn.style.background = 'rgba(16, 185, 129, 0.3)';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'rgba(16, 185, 129, 0.1)';
                }, 2000);
            });

            if (type === 'code') {
                const lines = content.split('\n');
                const codeHtml = lines.map((line, i) => `
                    <div class="code-line" style="display: flex; opacity: 0; transform: translateY(8px); transition: all 0.15s ease;">
                        <span class="ln" style="width: 45px; padding: 2px 12px; text-align: right; color: #475569; user-select: none; border-right: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);">${i + 1}</span>
                        <span class="code-text" style="padding: 2px 12px; color: #e2e8f0; white-space: pre;">${this.escapeHtml(line)}</span>
                    </div>
                `).join('');
                
                body.innerHTML = codeHtml;
                const codeLines = body.querySelectorAll('.code-line');
                
                // Staggered entrance animation
                for (let i = 0; i < codeLines.length; i++) {
                    await new Promise(r => setTimeout(r, 8));
                    codeLines[i].style.opacity = '1';
                    codeLines[i].style.transform = 'translateY(0)';
                    if (i % 8 === 0) scrollToBottom();
                }
            } else {
                const manuscriptHtml = this.formatManuscript(content);
                body.innerHTML = `<div class="manuscript-rich">${manuscriptHtml}</div>`;
                const blocks = body.querySelectorAll('.ms-block-reveal');
                for (let i = 0; i < blocks.length; i++) {
                    await new Promise(r => setTimeout(r, 60));
                    blocks[i].classList.add('show');
                    if (i % 3 === 0) scrollToBottom();
                }
            }
        }

        formatManuscript(content) {
            const emojis = ['✨', '🧠', '📌', '🎯', '🌟', '📘', '🔍', '🧩'];
            const safe = this.escapeHtml(String(content || ''))
                .replace(/!!([^!]+)!!/g, '<span class="ms-accent-critical">$1</span>')
                .replace(/\+\+([^\+]+)\+\+/g, '<span class="ms-accent-success">$1</span>')
                .replace(/\?\?([^\?]+)\?\?/g, '<span class="ms-accent-info">$1</span>');

            const lines = safe.split('\n');
            const parts = [];
            let inList = false;
            let listItems = [];

            const flushList = () => {
                if (!inList || listItems.length === 0) return;
                parts.push(`<ul class="ms-list ms-block-reveal">${listItems.join('')}</ul>`);
                inList = false;
                listItems = [];
            };

            lines.forEach((line, idx) => {
                const t = line.trim();
                if (!t) {
                    flushList();
                    return;
                }

                if (t.startsWith('## ')) {
                    flushList();
                    parts.push(`<h2 class="ms-headline ms-block-reveal">${t.substring(3)}</h2>`);
                    return;
                }
                if (t.startsWith('### ')) {
                    flushList();
                    parts.push(`<h3 class="ms-subhead ms-block-reveal">${t.substring(4)}</h3>`);
                    return;
                }

                const bulletMatch = t.match(/^(\*|-|\d+\.)\s+(.*)$/);
                if (bulletMatch) {
                    inList = true;
                    const emoji = emojis[listItems.length % emojis.length];
                    listItems.push(`<li class="ms-item"><span class="ms-emoji">${emoji}</span><span>${bulletMatch[2]}</span></li>`);
                    return;
                }

                flushList();
                if (/^(note|tip|insight|key point)\s*:/i.test(t)) {
                    parts.push(`<div class="ms-note ms-block-reveal">${t}</div>`);
                } else {
                    const lead = idx < 3 ? ' lead' : '';
                    parts.push(`<p class="ms-para${lead} ms-block-reveal">${t}</p>`);
                }
            });

            flushList();
            return parts.join('');
        }
        
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        async renderVideoResults(videos) {
            if (!videos || videos.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.cssText = 'grid-column: 1/-1; text-align:center; padding:40px; color:#ef4444; font-size:14px;';
                emptyMsg.textContent = 'No videos found for this query. Try a different search term.';
                this.el.appendChild(emptyMsg);
                scrollToBottom();
                return;
            }
            
            const section = document.createElement('div');
            section.className = 'grounded-section omni-fade-in';
            section.innerHTML = `<div class="section-header">Video Results</div>`;
            
            const grid = document.createElement('div');
            grid.className = 'video-grid';
            
            videos.forEach(v => {
                const card = document.createElement('div');
                card.className = 'video-card';
                
                const videoSource = v.url?.includes('youtube') || v.url?.includes('youtu.be') ? 'YouTube' : (v.source || 'Video');
                
                card.innerHTML = `
                    <div class="video-thumb-wrapper">
                        <img src="${v.thumbnail || '../../assets/icons/app.ico'}" 
                             onerror="this.src='../../assets/icons/app.ico'" 
                             alt="Video Thumbnail"
                             loading="lazy">
                        <div class="play-indicator">
                            <div class="play-circle">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div class="video-meta">
                        <h4 class="video-title" title="${v.title}">${v.title || 'Untitled Video'}</h4>
                        <span class="video-tag">${videoSource}</span>
                    </div>
                `;
                
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    window.browserAPI.openTab(v.url);
                });
                
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-4px)';
                });
                
                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                });
                
                grid.appendChild(card);
            });
            
            section.appendChild(grid);
            this.el.appendChild(section);
            scrollToBottom();
        }

        async renderGroundedImages(images) {
            if (!images || images.length === 0) return;
            const section = document.createElement('div');
            section.className = 'grounded-section grounded-images-wrap omni-fade-in';

            const card = document.createElement('div');
            card.className = 'final-answer-instant grounded-images-card';

            const header = document.createElement('div');
            header.className = 'section-header';
            header.textContent = 'Visual Context';
            card.appendChild(header);
            
            const gallery = document.createElement('div');
            gallery.className = 'image-gallery';
            
            images.forEach(img => {
                const item = document.createElement('div');
                item.className = 'gallery-item';
                item.innerHTML = `<img src="${img}" alt="Context Image" loading="lazy">`;
                item.addEventListener('click', () => {
                    const viewer = document.createElement('div');
                    viewer.className = 'image-viewer-overlay';
                    viewer.innerHTML = `
                        <button class="btn-close-viewer">&times;</button>
                        <img src="${img}">
                    `;
                    viewer.addEventListener('click', (e) => { if(e.target === viewer) viewer.remove(); });
                    viewer.querySelector('.btn-close-viewer').addEventListener('click', () => viewer.remove());
                    document.body.appendChild(viewer);
                });
                gallery.appendChild(item);
            });
            
            card.appendChild(gallery);
            section.appendChild(card);
            this.el.appendChild(section);
            scrollToBottom();
        }

        async renderWebSearchResults(results) {
            if (!results || (Array.isArray(results) && results.length === 0)) return;
            try {
                // Create collapsible search results container
                const container = document.createElement('div');
                container.className = 'collapsible-container search';
                
                const resultsCount = Array.isArray(results) ? results.length : (results.results?.length || 0);
                
                container.innerHTML = `
                    <div class="container-header">
                        <div class="container-header-title">
                            <div class="container-header-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <span class="container-header-text">Web Search Results (${resultsCount})</span>
                        </div>
                        <button class="toggle-btn" aria-label="Toggle search results">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div class="container-content">
                        <div class="container-content-inner search-results-list" style="padding: 0;"></div>
                    </div>
                `;
                
                const resultsList = container.querySelector('.search-results-list');
                
                const resultsArray = Array.isArray(results) ? results : (results.results || []);
                resultsArray.forEach((r, index) => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.style.cssText = `
                        padding: 14px 18px;
                        border-bottom: 1px solid rgba(59, 130, 246, 0.08);
                        transition: all 0.25s ease;
                        cursor: pointer;
                        animation: slideInRight 0.4s ease forwards;
                        animation-delay: ${index * 0.05}s;
                        opacity: 0;
                    `;
                    
                    const title = r.title || r.name || 'Untitled';
                    const url = r.url || r.link || '';
                    const snippet = r.snippet || r.description || r.content || '';
                    
                    let urlHostname = 'link';
                    try {
                        if (url) urlHostname = new URL(url).hostname;
                    } catch (e) {
                        urlHostname = url.substring(0, 30);
                    }
                    
                    item.innerHTML = `
                        <div style="font-weight: 600; font-size: 0.95rem; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">${title}</div>
                        <div style="font-size: 0.75rem; color: #60a5fa; font-family: 'JetBrains Mono', monospace; margin-bottom: 6px; opacity: 0.85;">${urlHostname}</div>
                        <div style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.5;">${snippet}</div>
                    `;
                    
                    if (url) {
                        item.addEventListener('click', () => window.browserAPI.openTab(url));
                        item.addEventListener('mouseenter', () => {
                            item.style.background = 'rgba(59, 130, 246, 0.08)';
                            item.style.paddingLeft = '22px';
                        });
                        item.addEventListener('mouseleave', () => {
                            item.style.background = '';
                            item.style.paddingLeft = '';
                        });
                    }
                    
                    resultsList.appendChild(item);
                });
                
                // Add animation keyframes
                if (!document.getElementById('slide-in-styles')) {
                    const style = document.createElement('style');
                    style.id = 'slide-in-styles';
                    style.textContent = `
                        @keyframes slideInRight {
                            from { opacity: 0; transform: translateX(-20px); }
                            to { opacity: 1; transform: translateX(0); }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                this.el.appendChild(container);
                scrollToBottom();
            } catch (e) {
                console.error("Web Search Results Render Error:", e);
            }
        }

        async renderWebSources(sources) {
            if (!sources || (Array.isArray(sources) && sources.length === 0)) return;
            try {
                // Create collapsible web sources container
                const container = document.createElement('div');
                container.className = 'collapsible-container tool';
                
                const sourcesCount = Array.isArray(sources) ? sources.length : (sources.sources?.length || 0);
                
                container.innerHTML = `
                    <div class="container-header">
                        <div class="container-header-title">
                            <div class="container-header-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
                                </svg>
                            </div>
                            <span class="container-header-text">Web Sources (${sourcesCount})</span>
                        </div>
                        <button class="toggle-btn" aria-label="Toggle web sources">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div class="container-content">
                        <div class="container-content-inner web-sources-list"></div>
                    </div>
                `;
                
                const sourcesList = container.querySelector('.web-sources-list');
                if (sourcesList) {
                    sourcesList.style.padding = '0';
                    sourcesList.style.maxHeight = '300px';
                    sourcesList.style.overflowY = 'auto';
                    sourcesList.style.overscrollBehavior = 'contain';
                    sourcesList.style.scrollbarWidth = 'thin';
                }
                
                const sourcesArray = Array.isArray(sources) ? sources : (sources.sources || []);
                sourcesArray.forEach((source, index) => {
                    const item = document.createElement('div');
                    item.style.cssText = `
                        padding: 12px 18px;
                        border-bottom: 1px solid rgba(245, 158, 11, 0.08);
                        transition: all 0.25s ease;
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                        animation: slideInRight 0.4s ease forwards;
                        animation-delay: ${index * 0.05}s;
                        opacity: 0;
                    `;
                    
                    let hostname = source.url || 'source';
                    try {
                        if (source.url && source.url.startsWith('http')) {
                            hostname = new URL(source.url).hostname;
                        }
                    } catch (e) {
                        hostname = source.url || 'source';
                    }
                    
                    const isCompleted = source.status === 'completed' || source.completed === true;
                    const dataPreview = typeof source.data === 'string' 
                        ? source.data.substring(0, 120) 
                        : (source.data ? JSON.stringify(source.data).substring(0, 120) : ((source.snippet || source.summary || '').substring(0, 120)));
                    
                    const statusColor = isCompleted ? '#34d399' : '#fbbf24';
                    const viaLabel = String(source.via || source.provider || source.source || 'SOURCE').replace(/[_-]+/g, ' ').toUpperCase();
                    const safeHost = this.escapeHtml(hostname || 'source');
                    const safeData = this.escapeHtml(dataPreview || 'Collecting data...');
                    const safeVia = this.escapeHtml(viaLabel);
                    
                    item.innerHTML = `
                        <div style="width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; background: ${statusColor}; ${!isCompleted ? 'animation: pulse 2s infinite;' : ''}"></div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.75rem; color: #fbbf24; font-family: 'JetBrains Mono', monospace; margin-bottom: 4px; opacity: 0.85; word-break: break-all;">${safeHost}</div>
                            <div style="font-size: 0.67rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 700; margin-bottom: 3px;">Provided Data (${safeVia})</div>
                            <div style="font-size: 0.8rem; color: #cbd5e1; line-height: 1.5; word-break: break-word; max-height: 100px; overflow-y: auto; scrollbar-width: thin;">${safeData}</div>
                        </div>
                    `;
                    
                    item.addEventListener('mouseenter', () => {
                        item.style.background = 'rgba(245, 158, 11, 0.06)';
                    });
                    item.addEventListener('mouseleave', () => {
                        item.style.background = '';
                    });
                    
                    sourcesList.appendChild(item);
                });
                
                this.el.appendChild(container);
                scrollToBottom();
            } catch (e) {
                console.error("Web Sources Render Error:", e);
            }
        }

        async renderDiagram(diagramData) {
            try {
                // Create collapsible diagram container
                const container = document.createElement('div');
                container.className = 'collapsible-container diagram';
                
                const diagramType = diagramData.type || 'mermaid';
                const content = diagramData.content || diagramData.data || diagramData;
                
                let diagramContent = '';
                if (diagramType === 'svg' || (typeof content === 'string' && content.trim().startsWith('<'))) {
                    diagramContent = `<div class="diagram-svg-content" style="display: flex; align-items: center; justify-content: center; padding: 20px;">${content}</div>`;
                } else {
                    const escapedContent = this.escapeHtml(typeof content === 'string' ? content : JSON.stringify(content));
                    diagramContent = `
                        <div class="diagram-mermaid-content" data-diagram="${escapedContent}" style="padding: 20px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                            <pre class="mermaid" style="margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">${escapedContent}</pre>
                        </div>
                    `;
                }
                
                container.innerHTML = `
                    <div class="container-header">
                        <div class="container-header-title">
                            <div class="container-header-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                </svg>
                            </div>
                            <span class="container-header-text">${diagramType === 'svg' ? 'SVG Diagram' : 'Mermaid Diagram'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button class="diagram-download" title="Download SVG" style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); color: #a78bfa; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px; font-size: 0.7rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Download
                            </button>
                            <button class="toggle-btn" aria-label="Toggle diagram">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="container-content">
                        <div class="container-content-inner diagram-inner">
                            ${diagramContent}
                        </div>
                    </div>
                `;
                
                // Add download functionality
                const downloadBtn = container.querySelector('.diagram-download');
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const svgContent = container.querySelector('.diagram-svg-content, .mermaid');
                    if (svgContent) {
                        const blob = new Blob([svgContent.innerHTML || svgContent.textContent], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `diagram-${Date.now()}.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                });
                
                this.el.appendChild(container);
                scrollToBottom();
                
                // Initialize mermaid if needed
                if (diagramType === 'mermaid' && typeof mermaid !== 'undefined') {
                    setTimeout(() => {
                        mermaid.init(undefined, container.querySelectorAll('.mermaid'));
                    }, 100);
                }
            } catch (e) {
                console.error("Diagram Render Error:", e);
            }
        }

        async renderWikiToolTrace(name, data) {
            const container = document.createElement('div');
            container.className = 'collapsible-container tool';

            const searchResults = Array.isArray(data?.results) ? data.results : [];
            const pages = Array.isArray(data?.pages) ? data.pages : [];
            const switched = Array.isArray(data?.switched_pages) ? data.switched_pages : [];

            const steps = [];
            if (name === 'SEARCH_WIKIPEDIA') {
                steps.push({ label: 'Search Wikipedia index', meta: `${searchResults.length} matches` });
                switched.forEach((entry) => {
                    steps.push({ label: `Open page: ${entry.title || 'Unknown'}`, meta: `id ${entry.page_id}` });
                });
            } else {
                steps.push({ label: `Open page: ${data?.title || 'Wikipedia page'}`, meta: `id ${data?.page_id || 'n/a'}` });
            }

            container.innerHTML = `
                <div class="container-header">
                    <div class="container-header-title">
                        <div class="container-header-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                                <path d="M3 4h18v4H3z"></path>
                                <path d="M3 10h18v10H3z"></path>
                                <path d="M8 14h8"></path>
                            </svg>
                        </div>
                        <span class="container-header-text">Wiki Tool Call: ${name}</span>
                    </div>
                    <button class="toggle-btn" aria-label="Toggle wiki trace">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="container-content">
                    <div class="wiki-trace-list"></div>
                    <div class="wiki-page-grid"></div>
                </div>
            `;

            this.el.appendChild(container);
            scrollToBottom();

            const traceList = container.querySelector('.wiki-trace-list');
            const pageGrid = container.querySelector('.wiki-page-grid');

            for (const step of steps) {
                const item = document.createElement('div');
                item.className = 'wiki-trace-step';
                item.innerHTML = `
                    <div class="wiki-step-indicator"></div>
                    <div class="wiki-step-title">${step.label}</div>
                    <div class="wiki-step-meta">${step.meta || ''}</div>
                `;
                traceList.appendChild(item);
                requestAnimationFrame(() => item.classList.add('active'));
                await new Promise((r) => setTimeout(r, 180));
                item.classList.remove('active');
                item.classList.add('done');
                scrollToBottom();
            }

            if (name === 'SEARCH_WIKIPEDIA') {
                pages.forEach((p) => {
                    const card = document.createElement('div');
                    card.className = 'wiki-page-card';
                    const preview = (p.content_preview || p.content || '').slice(0, 180);
                    card.innerHTML = `
                        <div class="wiki-page-title">${p.title || 'Untitled page'}</div>
                        <div class="wiki-page-snippet">${preview}</div>
                    `;
                    pageGrid.appendChild(card);
                });
            } else if (data?.title || data?.content) {
                const card = document.createElement('div');
                card.className = 'wiki-page-card';
                const preview = (data.content || '').slice(0, 180);
                card.innerHTML = `
                    <div class="wiki-page-title">${data.title || 'Wikipedia page'}</div>
                    <div class="wiki-page-snippet">${preview}</div>
                `;
                pageGrid.appendChild(card);
            }
        }

        async animateToolCall(name, data) {
            if ((name === 'SEARCH_WIKIPEDIA' || name === 'GET_WIKIPEDIA_PAGE') && data) {
                await this.renderWikiToolTrace(name, data);
                return;
            }

            if (name === 'SEARCH_VIDEOS' && data.videos) {
                await this.renderVideoResults(data.videos);
                return;
            }
            
            // Handle web search results from tool calls - multiple format checks
            if ((name === 'GOOGLE_SEARCH' || name === 'SERPAPI' || name === 'DUCKDUCKGO' || name === 'WEB_SEARCH') && data) {
                if (data.results && Array.isArray(data.results)) {
                    await this.renderWebSearchResults(data.results);
                    return;
                }
                if (Array.isArray(data)) {
                    await this.renderWebSearchResults(data);
                    return;
                }
            }
            
            // Handle web sources from tool calls
            if ((name === 'WEB_SOURCES' || name === 'FETCHED_SOURCES') && data) {
                if (Array.isArray(data)) {
                    await this.renderWebSources(data);
                    return;
                }
                if (data.sources && Array.isArray(data.sources)) {
                    await this.renderWebSources(data.sources);
                    return;
                }
            }
            
            // Create collapsible tool call container
            const container = document.createElement('div');
            container.className = 'collapsible-container tool';
            
            const textData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            const syntaxHighlight = (json) => {
                json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                    let cls = 'json-number';
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) {
                            cls = 'json-key';
                        } else {
                            cls = 'json-string';
                        }
                    } else if (/true|false/.test(match)) {
                        cls = 'json-boolean';
                    } else if (/null/.test(match)) {
                        cls = 'json-boolean';
                    }
                    return '<span class="' + cls + '">' + match + '</span>';
                });
            };

            container.innerHTML = `
                <div class="container-header">
                    <div class="container-header-title">
                        <div class="container-header-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                            </svg>
                        </div>
                        <span class="container-header-text">Tool: ${name}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.7rem; color: #fbbf24; font-weight: 600;">Response</span>
                        <button class="toggle-btn" aria-label="Toggle tool response">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="container-content">
                    <div class="container-content-inner" style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #cbd5e1; background: rgba(0,0,0,0.3); border-radius: 8px; overflow-x: auto;">
                        <pre style="margin: 0; padding: 16px; white-space: pre-wrap; word-break: break-word;">${syntaxHighlight(textData)}</pre>
                    </div>
                </div>
            `;
            
            this.el.appendChild(container);
            scrollToBottom();
        }

        async createTodoList(mode, hasAsset) {
            const header = document.createElement('div');
            header.className = 'process-pipeline-header';
            header.innerHTML = `
                <span class="pipeline-live-dot" aria-hidden="true"></span>
                <span class="pipeline-live-signal" aria-hidden="true"></span>
                <svg class="pipeline-live-glyph" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                Live Process
            `;
            this.el.appendChild(header);

            this.addTask('intent', 'Understand Request');
            if (hasAsset) this.addTask('vision', 'Process Attachments');
            if (mode === 'wiki') this.addTask('wiki-fetch', 'Gather Knowledge');
            if (mode === 'web' || mode === 'quick_search' || mode === 'video') this.addTask('search', 'Retrieve Sources');
            this.addTask('synthesis', 'Compose Answer');
            await new Promise(r => setTimeout(r, 100));
        }

        addTask(id, label) {
            const taskEl = document.createElement('div');
            taskEl.className = `pipeline-step pending task-type-${id}`;
            taskEl.id = `task-${id}`;
            taskEl.dataset.baseLabel = label;
            taskEl.innerHTML = `
                <div class="step-marker" aria-hidden="true">
                    <span class="step-core"></span>
                    <span class="step-fx"></span>
                    <span class="step-orbit"></span>
                </div>
                <div class="step-label">
                    <div class="step-title">${label}</div>
                    <div class="step-status">Queued</div>
                </div>
            `;
            this.el.appendChild(taskEl);
            this.tasks.push({ id, el: taskEl, label });
            return taskEl;
        }

        updateTask(id, state) {
            const task = this.tasks.find(t => t.id === id);
            if (!task) return;
            const statusEl = task.el.querySelector('.step-status');
            const titleEl = task.el.querySelector('.step-title');
            const base = task.el.dataset.baseLabel || task.label || id;
            const statusMap = {
                intent: { active: 'Parsing input', completed: 'Request understood' },
                vision: { active: 'Reading files/images', completed: 'Assets processed' },
                'wiki-fetch': { active: 'Fetching Wikipedia', completed: 'Wiki ready' },
                search: { active: 'Searching sources', completed: 'Sources collected' },
                synthesis: { active: 'Drafting response', completed: 'Answer ready' }
            };
            const fallback = { active: 'Working', completed: 'Done' };
            const statusText = statusMap[id]?.[state] || fallback[state] || 'Queued';
            if (statusEl) {
                statusEl.textContent = statusText;
                statusEl.classList.toggle('status-live', state === 'active');
            }
            if (titleEl) titleEl.textContent = base;
            
            task.el.classList.remove('pending', 'active', 'completed');
            
            if (state === 'active') {
                task.el.classList.add('active');
            } else if (state === 'completed') {
                task.el.classList.add('completed');
            } else {
                task.el.classList.add('pending');
            }
            
            scrollToBottom();
        }

        destroy() {
            this.messageEl.classList.remove('ai-generating');
        }
    }

    const formatOutput = (text) => {
        if (!text) return "";
        
        text = text.replace(/<think>([\s\S]*?)<\/think>/gi, '').trim();
        text = text.replace(/\$$[\s\S]+?\$$/g, '[Equation]')
                   .replace(/\$[^\$]+?\$/g, '[Math]');

        if (text.includes('|')) {
            const lines = text.split('\n');
            let inTable = false;
            let tableHtml = '';
            let processedText = [];
            
            lines.forEach(line => {
                if (line.trim().startsWith('|')) {
                    if (!inTable) {
                        inTable = true;
                        tableHtml = '<div class="table-wrapper"><table class="pro-table"><thead>'; 
                    }
                    
                    const cells = line.split('|').filter(c => c.trim().length > 0 || line.includes('---'));
                    if (line.includes('---')) return;
                    
                    const rowTag = !tableHtml.includes('<tbody>') ? '<tr>' : '<tr>'; 
                    const cellTag = !tableHtml.includes('<tbody>') ? '<th>' : '<td>';
                    
                    tableHtml += rowTag + cells.map(c => `${cellTag}${c.trim()}</${cellTag === '<td>' ? 'td' : 'th'}>`).join('') + '</tr>';
                    
                    if (!tableHtml.includes('<tbody>') && !line.includes('---')) {
                        tableHtml = tableHtml.replace('</thead>', '</thead><tbody>');
                    }
                } else {
                    if (inTable) {
                        inTable = false;
                        tableHtml += '</tbody></table></div>';
                        processedText.push(tableHtml);
                        tableHtml = '';
                    }
                    processedText.push(line);
                }
            });
            if (inTable) processedText.push(tableHtml + '</tbody></table></div>');
            text = processedText.join('\n');
        }

        text = text.replace(/!!([^!]+)!!/g, '<span class="mark-critical">$1</span>')
                   .replace(/\+\+([^\+]+)\+\+/g, '<span class="mark-success">$1</span>')
                   .replace(/\?\?([^\?]+)\?\?/g, '<span class="mark-info">$1</span>')
                   .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                   .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, ''); // Remove image markdown from text

        const lines = text.split('\n');
        const nonEmptyLines = lines.map(l => l.trim()).filter(Boolean);
        const shortLineRatio = nonEmptyLines.length > 0
            ? nonEmptyLines.filter(l => l.length <= 72).length / nonEmptyLines.length
            : 0;
        const hasListOrHeading = nonEmptyLines.some(l => l.startsWith('## ') || l.startsWith('### ') || /^(\*|-|\d+\.)\s+/.test(l));
        const isLikelyPoem = nonEmptyLines.length >= 4 && shortLineRatio >= 0.7 && !hasListOrHeading;

        if (isLikelyPoem) {
            const poemParts = lines.map(line => {
                const t = line.trim();
                if (!t) return '<div class="pro-poem-gap"></div>';
                return `<p class="pro-poem-line">${t}</p>`;
            }).join('');
            return `<div class="pro-poem">${poemParts}</div>`;
        }

        const htmlParts = [];
        let inList = false;
        const closeList = () => {
            if (inList) {
                htmlParts.push('</ul>');
                inList = false;
            }
        };

        lines.forEach(line => {
            const t = line.trim();
            if (!t) {
                closeList();
                return;
            }
            
            if (t.startsWith('## ')) {
                closeList();
                htmlParts.push(`<h2 class="pro-h2">${t.substring(3)}</h2>`);
                return;
            }
            if (t.startsWith('### ')) {
                closeList();
                htmlParts.push(`<h3 class="pro-h3">${t.substring(4)}</h3>`);
                return;
            }
            
            if (t.match(/^(\*|-|\d+\.)\s+(.*)$/)) {
                if (!inList) {
                    htmlParts.push('<ul class="pro-ul">');
                    inList = true;
                }
                const content = t.replace(/^(\*|-|\d+\.)\s+/, '');
                htmlParts.push(`<li class="pro-li">${content}</li>`);
                return;
            }
            
            if (t.includes('<table') || t.includes('</table>') || t.includes('<div class="pro-image-container')) {
                closeList();
                htmlParts.push(t);
                return;
            }
            
            closeList();
            htmlParts.push(`<p class="pro-p">${t}</p>`);
        });

        closeList();
        return htmlParts.join('');
    };

    const updateSerpapiQuota = async () => {
        try {
            await loadConfig();
            if (!config.aiConfig || !config.aiConfig.serpapiKey) {
                if (els.serpapiQuotaContainer) els.serpapiQuotaContainer.classList.add('hidden');
                return;
            }
            
            // Fetch quota information from SerpAPI
            const response = await fetch('https://serpapi.com/account?api_key=' + encodeURIComponent(config.aiConfig.serpapiKey));
            
            if (!response.ok) throw new Error('Failed to fetch quota');
            const data = await response.json();
            
            if (data.searches_per_month && els.serpapiQuotaContainer) {
                const limit = data.searches_per_month;
                const used = data.total_searches_per_month || data.searches_used || 0;
                const remaining = Math.max(0, limit - used);
                
                els.quotaLimit.textContent = limit.toLocaleString();
                els.quotaUsed.textContent = used.toLocaleString();
                els.quotaRemaining.textContent = remaining.toLocaleString();
                els.serpapiQuotaContainer.classList.remove('hidden');
            }
        } catch (e) {
            console.warn("SerpAPI Quota Fetch Error:", e);
            if (els.serpapiQuotaContainer) els.serpapiQuotaContainer.classList.add('hidden');
        }
    };

    const setupInteractiveElements = (container) => {
        const headers = container.querySelectorAll('.reasoning-header');
        headers.forEach(h => {
            h.addEventListener('click', () => {
                h.parentElement.classList.toggle('collapsed');
            });
        });

        const containerHeaders = container.querySelectorAll('.container-header');
        containerHeaders.forEach(h => {
            h.addEventListener('click', (e) => {
                if (e.target.closest('.diagram-download')) return;
                h.parentElement.classList.toggle('collapsed');
            });
        });
    };

    const appendMessage = (role, text = '', img = null, attachments = []) => {
        if (els.welcome) els.welcome.classList.add('hidden');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        
        // Add attachments preview
        if (attachments && attachments.length > 0) {
            const attachmentsHTML = attachments.map((asset, index) => {
                const ext = asset.fileName.split('.').pop().toLowerCase();
                const icon = asset.fileType === 'image' ? 
                    `<div class="message-attachment-preview"><img src="data:${asset.mimeType};base64,${asset.data}" alt="${asset.fileName}"></div>` :
                    `<div class="message-attachment-icon">${asset.fileType === 'text' ? '📄' : '📎'}</div>`;
                
                return `
                    <div class="message-attachment" data-index="${index}">
                        ${icon}
                        <span class="message-attachment-name" title="${asset.fileName}">${asset.fileName}</span>
                    </div>
                `;
            }).join('');
            
            bubble.innerHTML += `<div class="message-attachments-container">${attachmentsHTML}</div>`;
        }
        
        if (img) bubble.innerHTML += `<div class="pro-image-container"><img src="${img}"></div>`;
        if (role === 'user' && text) bubble.innerHTML += formatOutput(text);

        msgDiv.appendChild(bubble);
        els.messages.appendChild(msgDiv);
        scrollToBottom();
        return { bubble, msgDiv };
    };

    const escapeHtmlText = (value) => {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    };

    const toPreviewText = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value.trim();
        try {
            return JSON.stringify(value);
        } catch (e) {
            return String(value);
        }
    };

    const toHostFromUrl = (url = '') => {
        const raw = String(url || '').trim();
        if (!raw) return 'unknown';
        try {
            const parsed = raw.startsWith('http') ? new URL(raw) : new URL(`https://${raw}`);
            return parsed.hostname.replace(/^www\./i, '') || 'unknown';
        } catch (e) {
            return raw.replace(/^https?:\/\//i, '').split('/')[0] || 'unknown';
        }
    };

    const toViaLabel = (via = '') => {
        const clean = String(via || '').trim();
        if (!clean) return 'source';
        return clean.replace(/[_-]+/g, ' ').toUpperCase();
    };

    const getSourceDataPreview = (source = {}) => {
        const candidates = [
            source.data,
            source.summary,
            source.snippet,
            source.content_preview,
            source.content,
            source.excerpt
        ];
        for (const candidate of candidates) {
            const text = toPreviewText(candidate);
            if (text) return text.slice(0, 320);
        }
        return '';
    };

    const normalizeSourceLinks = (sourceLinks = []) => {
        const byUrl = new Map();
        (sourceLinks || []).forEach((s) => {
            if (!s || !s.url) return;
            const url = String(s.url).trim();
            if (!url) return;

            const existing = byUrl.get(url) || {
                title: 'Source',
                url,
                snippet: '',
                via: '',
                host: toHostFromUrl(url),
                providedData: ''
            };

            const incomingTitle = toPreviewText(s.title);
            if (incomingTitle && (existing.title === 'Source' || existing.title.length < incomingTitle.length)) {
                existing.title = incomingTitle.slice(0, 180);
            }

            const incomingSnippet = toPreviewText(s.snippet);
            if (incomingSnippet && incomingSnippet.length > (existing.snippet || '').length) {
                existing.snippet = incomingSnippet.slice(0, 320);
            }

            const incomingVia = toPreviewText(s.via || s.provider || s.source);
            if (incomingVia && !existing.via) {
                existing.via = incomingVia;
            }

            const incomingData = getSourceDataPreview(s);
            if (incomingData && incomingData.length > (existing.providedData || '').length) {
                existing.providedData = incomingData;
            }

            byUrl.set(url, existing);
        });

        return Array.from(byUrl.values()).map((s) => ({
            ...s,
            viaLabel: toViaLabel(s.via),
            host: s.host || toHostFromUrl(s.url)
        }));
    };

    const collectSourcesFromResult = (result) => {
        const acc = [];
        if (!result) return acc;

        const pushWithVia = (items = [], via = '') => {
            (items || []).forEach((item) => {
                if (!item || !item.url) return;
                acc.push({ ...item, via: item.via || via });
            });
        };

        pushWithVia(result.usedSources, 'used_source');
        pushWithVia(result.webSources, 'web_source');
        pushWithVia(result.sources, 'source');
        pushWithVia(result.searchResults, 'search_result');
        pushWithVia(result.results, 'result');

        if (Array.isArray(result.functionResponses)) {
            result.functionResponses.forEach((fr) => {
                const r = fr?.response;
                if (!r) return;
                const via = fr?.name || 'tool';
                pushWithVia(r.results, via);
                pushWithVia(r.sources, via);
                pushWithVia(r.videos, via);
                if (Array.isArray(r.pages)) {
                    r.pages.forEach((p) => {
                        if (p?.page_id) {
                            acc.push({
                                title: p.title || 'Wikipedia page',
                                url: `https://en.wikipedia.org/?curid=${p.page_id}`,
                                snippet: p.content_preview || '',
                                data: p.content_preview || '',
                                via
                            });
                        }
                    });
                }
                if (r?.page_id) {
                    acc.push({
                        title: r.title || 'Wikipedia page',
                        url: `https://en.wikipedia.org/?curid=${r.page_id}`,
                        snippet: (r.content || '').slice(0, 160),
                        data: r.content || '',
                        via
                    });
                }
            });
        }

        return normalizeSourceLinks(acc);
    };

    const normalizeOfflineToolLogs = (functionResponses = []) => {
        if (!Array.isArray(functionResponses)) return [];
        return functionResponses.map((fr, idx) => {
            const name = String(fr?.name || `TOOL_${idx + 1}`).trim().toUpperCase();
            const response = fr?.response || {};
            const status = String(response?.status || (response?.error ? 'error' : 'ok')).trim().toLowerCase();

            const parts = [];
            if (Number.isFinite(response?.count)) parts.push(`count: ${response.count}`);
            if (Number.isFinite(response?.sourcesUsed)) parts.push(`sources: ${response.sourcesUsed}`);
            if (Number.isFinite(response?.searchesExecuted)) parts.push(`searches: ${response.searchesExecuted}`);
            if (Array.isArray(response?.results)) parts.push(`results: ${response.results.length}`);
            if (Array.isArray(response?.pages)) parts.push(`pages: ${response.pages.length}`);
            if (Array.isArray(response?.videos)) parts.push(`videos: ${response.videos.length}`);
            if (response?.query) parts.push(`query: ${String(response.query).slice(0, 120)}`);
            if (response?.error) parts.push(`error: ${String(response.error).slice(0, 180)}`);

            let summary = parts.join(' | ');
            if (!summary) {
                try {
                    summary = JSON.stringify(response, null, 2).slice(0, 900);
                } catch (e) {
                    summary = String(response || '');
                }
            }

            return {
                name,
                status: status || 'ok',
                summary: summary || 'No log payload.'
            };
        });
    };

    const compactSentence = (value = '', maxLen = 220) => {
        const clean = String(value || '')
            .replace(/\s+/g, ' ')
            .replace(/\[[^\]]+\]/g, '')
            .trim();
        if (!clean) return '';
        const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || clean;
        if (firstSentence.length <= maxLen) return firstSentence;
        return `${firstSentence.slice(0, maxLen - 3).trim()}...`;
    };

    const buildSourceBackedFallbackAnswer = (query, mode, sourceLinks = [], cause = '') => {
        const normalized = normalizeSourceLinks(sourceLinks).slice(0, 8);
        if (!normalized.length) return null;

        const quick = compactSentence(
            normalized
                .map((s) => s.providedData || s.snippet)
                .filter(Boolean)
                .sort((a, b) => String(b).length - String(a).length)[0] || '',
            260
        ) || 'I collected relevant source data and synthesized the core points below.';

        const seenInsights = new Set();
        const keyInsights = [];
        for (const s of normalized) {
            const candidate = compactSentence(s.providedData || s.snippet, 180);
            if (!candidate) continue;
            const key = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!key || seenInsights.has(key)) continue;
            seenInsights.add(key);
            keyInsights.push(candidate);
            if (keyInsights.length >= 5) break;
        }

        const evidenceLines = normalized.slice(0, 5).map((s, idx) => {
            const title = s.title && s.title !== 'Source' ? s.title : s.host || 'Source';
            const host = s.host || toHostFromUrl(s.url);
            const detail = compactSentence(s.providedData || s.snippet, 120) || 'Relevant data retrieved.';
            return `${idx + 1}. **${title}** (${host}) - ${detail}`;
        });

        const modeLabel = mode === 'wiki'
            ? 'Wiki Brain retrieval'
            : mode === 'quick_search'
                ? 'Quick Search retrieval'
                : 'Web retrieval';
        const causeLine = cause ? `\n\n_Model fallback reason:_ ${cause}` : '';

        return `## Quick Answer
I could not complete the primary generation API, so I built this response from ${modeLabel} sources for: "${query}".

${quick}

## Key Findings
${(keyInsights.length ? keyInsights : ['Collected sources contain relevant information for your query.']).map((point) => `- ${point}`).join('\n')}

## Evidence Snapshot
${evidenceLines.join('\n')}

## Suggested Next Step
Tell me which finding you want expanded, and I will drill deeper into that source set.${causeLine}`;
    };

    const collectEmergencySourceLinks = async ({ query, mode, partialResult }) => {
        let sourceLinks = collectSourcesFromResult(partialResult);

        if ((mode === 'web' || mode === 'quick_search' || mode === 'wiki') && sourceLinks.length < 3 && window.browserAPI?.ai?.webSearch) {
            const searchQuery = mode === 'wiki'
                ? `${query} site:wikipedia.org`
                : query;
            const fallbackSearch = await window.browserAPI.ai.webSearch(searchQuery);
            const fallbackSources = collectSourcesFromResult(fallbackSearch);
            sourceLinks = normalizeSourceLinks([...(sourceLinks || []), ...(fallbackSources || [])]);
        }

        return normalizeSourceLinks(sourceLinks);
    };

    const appendActionBar = (container, text, originalPrompt, sourceLinks = [], offlineLogs = []) => {
        const normalizedSources = normalizeSourceLinks(sourceLinks);
        const normalizedLogs = normalizeOfflineToolLogs(offlineLogs);
        const actionBar = document.createElement('div');
        actionBar.className = 'message-actions';
        actionBar.innerHTML = `
            <button class="action-btn regen-btn" title="Regenerate">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
            <button class="action-btn speak-btn" title="Read Aloud">
                <svg class="icon-mic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                <svg class="icon-pause hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                <svg class="icon-play hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <button class="action-btn sources-btn ${normalizedSources.length ? '' : 'hidden'}" title="View Sources">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l2.92-2.92a5 5 0 0 0-7.07-7.07L11.7 5.24"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54L3.54 13.38a5 5 0 0 0 7.07 7.07l1.67-1.67"></path>
                </svg>
            </button>
            <button class="action-btn offline-logs-btn ${normalizedLogs.length ? '' : 'hidden'}" title="Offline Bot Logs">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 4h18v4H3z"></path>
                    <path d="M3 10h18v10H3z"></path>
                    <path d="M8 14h8"></path>
                </svg>
            </button>
            <button class="action-btn stop-tts-btn hidden" title="Stop">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16"></rect></svg>
            </button>
        `;

        const speakBtn = actionBar.querySelector('.speak-btn');
        const stopBtn = actionBar.querySelector('.stop-tts-btn');
        
        const regenBtn = actionBar.querySelector('.regen-btn');
        if(regenBtn) {
            regenBtn.addEventListener('click', () => {
                if (!isGenerating && originalPrompt) {
                    els.input.value = originalPrompt;
                    sendMessage();
                }
            });
        }

        const updateTtsUI = (state) => {
            const icons = {
                mic: speakBtn.querySelector('.icon-mic'),
                pause: speakBtn.querySelector('.icon-pause'),
                play: speakBtn.querySelector('.icon-play')
            };
            
            Object.values(icons).forEach(i => i?.classList.add('hidden'));
            stopBtn.classList.add('hidden');

            if (state === 'playing') {
                icons.pause?.classList.remove('hidden');
                speakBtn.classList.add('active');
            } else if (state === 'paused') {
                icons.play?.classList.remove('hidden');
                speakBtn.classList.remove('active');
            } else {
                icons.mic?.classList.remove('hidden');
                speakBtn.classList.remove('active');
            }
        };

        if(speakBtn) {
            speakBtn.addEventListener('click', () => {
                const textTarget = container.querySelector('.final-answer-instant');
                ttsController.speakWithHighlight(textTarget || container, text, updateTtsUI);
            });
        }

        if(stopBtn) {
            stopBtn.addEventListener('click', () => ttsController.stop());
        }

        const sourcesBtn = actionBar.querySelector('.sources-btn');
        if (sourcesBtn && normalizedSources.length > 0) {
            sourcesBtn.addEventListener('click', () => {
                const existing = document.querySelector('.sources-popup-overlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.className = 'sources-popup-overlay';
                overlay.innerHTML = `
                    <div class="sources-popup">
                        <div class="sources-popup-header">
                            <span>Sources Used (${normalizedSources.length})</span>
                            <button class="action-btn close-sources-btn" title="Close">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="sources-popup-subheader">Scroll to view all sources. Each card shows the data contributed by that source.</div>
                        <div class="sources-popup-list"></div>
                    </div>
                `;

                const list = overlay.querySelector('.sources-popup-list');
                normalizedSources.forEach((s) => {
                    const row = document.createElement('div');
                    row.className = 'source-link-item';
                    const title = escapeHtmlText(s.title || 'Source');
                    const url = escapeHtmlText(s.url || '');
                    const viaLabel = escapeHtmlText(s.viaLabel || 'SOURCE');
                    const host = escapeHtmlText(s.host || 'unknown');
                    const providedData = escapeHtmlText((s.providedData || s.snippet || 'No data preview returned for this source.').slice(0, 320));
                    row.innerHTML = `
                        <div class="source-link-title">${title}</div>
                        <div class="source-link-url">${url}</div>
                        <div class="source-link-meta">
                            <span class="source-link-chip">${viaLabel}</span>
                            <span class="source-link-chip host">${host}</span>
                        </div>
                        <div class="source-link-data-label">Provided Data</div>
                        <div class="source-link-data">${providedData}</div>
                    `;
                    row.addEventListener('click', () => window.browserAPI.openTab(s.url));
                    list.appendChild(row);
                });

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) overlay.remove();
                });
                overlay.querySelector('.close-sources-btn')?.addEventListener('click', () => overlay.remove());
                document.body.appendChild(overlay);
            });
        }

        const logsBtn = actionBar.querySelector('.offline-logs-btn');
        if (logsBtn && normalizedLogs.length > 0) {
            logsBtn.addEventListener('click', () => {
                const existing = document.querySelector('.sources-popup-overlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.className = 'sources-popup-overlay';
                overlay.innerHTML = `
                    <div class="sources-popup">
                        <div class="sources-popup-header">
                            <span>Offline Bot Logs (${normalizedLogs.length})</span>
                            <button class="action-btn close-sources-btn" title="Close">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="sources-popup-subheader">Execution trace from Offline Bot tools.</div>
                        <div class="sources-popup-list"></div>
                    </div>
                `;

                const list = overlay.querySelector('.sources-popup-list');
                normalizedLogs.forEach((log) => {
                    const row = document.createElement('div');
                    row.className = 'offline-log-item';
                    row.innerHTML = `
                        <div class="offline-log-head">
                            <span class="offline-log-name">${escapeHtmlText(log.name)}</span>
                            <span class="offline-log-status">${escapeHtmlText(log.status)}</span>
                        </div>
                        <div class="offline-log-summary">${escapeHtmlText(log.summary)}</div>
                    `;
                    list.appendChild(row);
                });

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) overlay.remove();
                });
                overlay.querySelector('.close-sources-btn')?.addEventListener('click', () => overlay.remove());
                document.body.appendChild(overlay);
            });
        }

        container.appendChild(actionBar);
    };

    const sendMessage = async () => {
        const text = els.input.value.trim();
        if (!text && attachedAssets.length === 0) return;
        if (isGenerating) return;

        // Check if user wants to use the response database (starts with @)
        if (shouldUseDatabase(text)) {
            const query = processDatabaseQuery(text);
            const dbResponse = findResponse(query);

            const localResponse = dbResponse || buildDatabaseFallbackResponse(query);

            if (attachedAssets.length > 0) {
                clearAssets();
            }
            hideDatabaseTopicPopup();
            lastUserQuery = text;
            els.input.value = '';
            els.input.style.height = 'auto';

            isGenerating = true;
            updateSendButtonState();
            if (els.iconSend) els.iconSend.classList.add('hidden');
            if (els.iconStop) els.iconStop.classList.remove('hidden');

            try {
                let finalResponse = localResponse;
                try {
                    const rewritten = await rewriteDatabaseResponseWithAI(text, query, localResponse);
                    if (rewritten) {
                        finalResponse = rewritten;
                    }
                } catch (rewriteError) {
                    console.warn('Database rewrite with AI failed, using local response:', rewriteError?.message || rewriteError);
                }

                await renderDatabaseOnlyResponse(text, finalResponse);
                chatHistory.push({ role: 'user', parts: [{ text }] });
                chatHistory.push({ role: 'model', parts: [{ text: finalResponse }] });
            } catch (dbRenderError) {
                console.error('Failed to render database response:', dbRenderError);
            } finally {
                finishGen();
            }
            return;
        }

        lastUserQuery = text;
        els.input.value = ''; els.input.style.height = 'auto';
        isGenerating = true; 
        updateSendButtonState();
        
        if(els.iconSend) els.iconSend.classList.add('hidden'); 
        if(els.iconStop) els.iconStop.classList.remove('hidden');

        const asset = attachedAssets.length > 0 ? attachedAssets[0] : null;
        const modeAtSend = currentMode;
        
        let visualPreview = null;
        if (asset && asset.mimeType && asset.mimeType.startsWith('image/')) visualPreview = `data:${asset.mimeType};base64,${asset.data}`;
        
        // Store all attached assets for the AI to process
        const allAssets = [...attachedAssets];
        
        clearAssets();
        appendMessage('user', text, visualPreview, allAssets);
        
        const { bubble: responseBubble, msgDiv: responseMsgDiv } = appendMessage('model');
        const workbench = new NeuralWorkbench(responseBubble, responseMsgDiv);
        await loadConfig();
        await workbench.createTodoList(modeAtSend, !!asset);

        let partialResult = null;
        try {
            workbench.updateTask('intent', 'active');
            const quickCommandMatch = text.match(/^\/quick\s+(.+)$/i);
            const quickQuery = quickCommandMatch ? quickCommandMatch[1].trim() : '';
            const quickMatch = quickQuery ? QuickBot.findMatch(quickQuery) : null;
            if (quickMatch && !asset && modeAtSend === 'nothing') {
                workbench.updateTask('intent', 'completed');
                workbench.updateTask('synthesis', 'active');
                
                const finalArea = document.createElement('div');
                finalArea.className = 'final-answer-instant omni-fade-in';
                finalArea.innerHTML = formatOutput(quickMatch);
                responseBubble.appendChild(finalArea);

                // Apply AI theme class to response bubble and parent message container
                const aiTheme = localStorage.getItem('ai_response_theme') || 'default';
                if (aiTheme && aiTheme !== 'default') {
                    responseBubble.classList.add(`theme-${aiTheme}`);
                    responseMsgDiv.classList.add(`theme-${aiTheme}`);
                }
                
                appendActionBar(responseBubble, quickMatch, quickQuery, []);
                setupInteractiveElements(responseBubble);
                workbench.updateTask('synthesis', 'completed');
                workbench.destroy();
                finishGen(); return;
            }
            workbench.updateTask('intent', 'completed');

            if (asset) {
                workbench.updateTask('vision', 'active');
                await new Promise(r => setTimeout(r, 200));
                workbench.updateTask('vision', 'completed');
            }

            const isWikiNeeded = modeAtSend === 'wiki';
            const isSearchNeeded = modeAtSend === 'web' || modeAtSend === 'quick_search';
            const isVideoNeeded = modeAtSend === 'video';
            const isQuickSearch = modeAtSend === 'quick_search';
            const isDeepSearch = modeAtSend === 'web';

            if (isWikiNeeded) workbench.updateTask('wiki-fetch', 'active');
            if (isSearchNeeded || isVideoNeeded) workbench.updateTask('search', 'active');

            workbench.updateTask('synthesis', 'active');
            
            let sysPrompt = `You are Omni, a professional AI browser intelligence agent.\n            RULES:\n            1. TONE: Be polite, well-mannered, and respectful. Use a helpful, friendly tone without slang.\n            2. LANGUAGE: Respond ONLY in clear, professional English.\n            3. FORMATTING: Use Markdown with clean structure. Use headers (##, ###) only when helpful. For short answers, skip headers. Use short paragraphs and bullets for lists.\n            4. NEURAL VISION: You have vision over any automatically attached images from SerpAPI search/grounding. Reference them when relevant.`;
            
            // Add search depth instructions
            if (isQuickSearch) {
                sysPrompt += `\n            5. SEARCH MODE: Quick Retrieval - Run exactly 5 web searches and use exactly 5 relevant sources. You must call the search_web tool before answering. Focus on only the most important facts.`;
            } else if (isDeepSearch) {
                sysPrompt += `\n            5. SEARCH MODE: Deep Intelligence - Run exactly 15 web searches for comprehensive coverage. You must call the search_web tool before answering. Collect detailed data and provide thorough analysis with multiple perspectives.`;
            }
            
            if (isVideoNeeded) {
                sysPrompt += `\n            6. VIDEO DISCOVERY: You must use the search_videos tool to find and present video content. Always call search_videos when the user requests videos or video discovery. Display video results prominently with titles and metadata.`;
            }
            
            if (isWikiNeeded) {
                sysPrompt += `\n            7. WIKI MODE: You must use Wikipedia tools in sequence. First call search_wikipedia, then call get_wikipedia_page for multiple relevant pages, compare findings, and synthesize with citations.`;
            }

            // Diagram detection logic
            const diagramKeywords = ['diagram', 'flowchart', 'chart', 'graph', 'mermaid', 'sequence', 'gantt', 'class diagram', 'entity relationship', 'er diagram', 'state diagram', 'flow', 'visualize', 'visualization'];
            const queryLower = text.toLowerCase();
            const isDiagramRequested = diagramKeywords.some(keyword => queryLower.includes(keyword));
            
            if (isDiagramRequested) {
                sysPrompt += `\n            8. DIAGRAM MODE: The user is requesting a diagram or visualization. You must generate a valid Mermaid diagram using the appropriate Mermaid syntax (flowchart, sequenceDiagram, classDiagram, stateDiagram, etc.). Wrap the Mermaid code in \`\`\`mermaid code blocks. Ensure the diagram syntax is valid and properly formatted. You may include explanatory text before or after the diagram.`;
                window.diagramMode = true;
            } else {
                window.diagramMode = false;
            }

            let finalInput = text;
            if (asset && asset.mimeType === 'text/plain') {
                finalInput = `[ATTACHED FILE: ${asset.filename}]\nCONTENT:\n${asset.textData}\n\nUSER COMMAND: ${text}`;
            }

            const contents = [...chatHistory, { role: 'user', parts: [{ text: finalInput || "(Analyze visual content)" }] }];
            if (asset && asset.mimeType.startsWith('image/')) {
                contents[contents.length-1].parts.push({ inlineData: { data: asset.data, mimeType: asset.mimeType } });
            }

            const result = await window.browserAPI.ai.performTask({
                contents, 
                configOverride: config, 
                systemInstruction: sysPrompt,
                searchMode: isSearchNeeded,
                wikiMode: isWikiNeeded,
                videoMode: isVideoNeeded,
                searchDepth: isQuickSearch ? 'quick' : isDeepSearch ? 'deep' : 'standard'
            });
            partialResult = result;

            if (result.error) throw new Error(result.error);

            const rawText = result.text || "";
            console.log("Omni Response Result Structure:", { 
                hasText: !!rawText, 
                hasWebSources: !!(result.webSources || result.sources),
                hasSearchResults: !!(result.searchResults || result.results),
                hasFunctionResponses: !!result.functionResponses,
                webSourcesCount: (result.webSources || result.sources || []).length,
                searchResultsCount: (result.searchResults || result.results || []).length
            });
            
            // Extract and display reasoning if available
            const thoughtMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
            if (thoughtMatch) {
                console.log("Found thought trace, rendering reasoning...");
                await workbench.animateReasoning(thoughtMatch[1].trim());
            }

            // Display grounded images if available
            if (result.groundedImages && result.groundedImages.length > 0) {
                console.log("Rendering grounded images:", result.groundedImages.length);
                await workbench.renderGroundedImages(result.groundedImages);
            }

            const isOfflineProvider = String(result.provider || '').toLowerCase() === 'offline';
            const offlineLogs = isOfflineProvider ? (result.functionResponses || []) : [];

            // Display web sources if available - skip inline log panels for offline provider
            if (!isOfflineProvider && result.webSources && result.webSources.length > 0) {
                console.log("Rendering web sources (webSources):", result.webSources.length);
                await workbench.renderWebSources(result.webSources);
            } else if (!isOfflineProvider && result.sources && Array.isArray(result.sources) && result.sources.length > 0) {
                console.log("Rendering web sources (sources):", result.sources.length);
                await workbench.renderWebSources(result.sources);
            }

            // Display search results if available - skip inline log panels for offline provider
            if (!isOfflineProvider && result.searchResults && result.searchResults.length > 0) {
                console.log("Rendering search results (searchResults):", result.searchResults.length);
                await workbench.renderWebSearchResults(result.searchResults);
            } else if (!isOfflineProvider && result.results && Array.isArray(result.results) && result.results.length > 0) {
                console.log("Rendering search results (results):", result.results.length);
                await workbench.renderWebSearchResults(result.results);
            }

            // Handle function responses / tool calls (hide inline tool logs for offline provider)
            if (!isOfflineProvider && result.functionResponses && result.functionResponses.length > 0) {
                console.log("Processing function responses:", result.functionResponses.length);
                for (const fr of result.functionResponses) {
                    await workbench.animateToolCall(fr.name.toUpperCase(), fr.response);
                }
            }

            let mainResponseText = rawText.replace(/<think>([\s\S]*?)<\/think>/gi, '').trim();
            const codeBlockRegex = /```[a-z]*\n([\s\S]*?)```/gi;
            const codeBlocks = [...mainResponseText.matchAll(codeBlockRegex)];
            
            const lowerQuery = text.toLowerCase();
            const isCreative = lowerQuery.includes('poem') || lowerQuery.includes('story') || lowerQuery.includes('write a') || lowerQuery.includes('compose');

            if (codeBlocks.length > 0) {
                for (const match of codeBlocks) {
                    await workbench.animateCanvas('code', match[1].trim());
                    mainResponseText = mainResponseText.replace(match[0], '');
                }
            } else if (isCreative) {
                // Keep creative output directly in the main answer area.
                // (No separate manuscript container)
            }

            // Extract and render Mermaid diagrams
            const mermaidBlockRegex = /```mermaid\n([\s\S]*?)```/gi;
            const mermaidMatches = [...mainResponseText.matchAll(mermaidBlockRegex)];
            
            if (mermaidMatches.length > 0) {
                for (const match of mermaidMatches) {
                    const diagramContent = match[1].trim();
                    await workbench.renderDiagram({
                        type: 'mermaid',
                        content: diagramContent
                    });
                    mainResponseText = mainResponseText.replace(match[0], '');
                }
            }

            // Apply AI theme class to response bubble and parent message container
            const aiTheme = localStorage.getItem('ai_response_theme') || 'default';
            if (aiTheme && aiTheme !== 'default') {
                responseBubble.classList.add(`theme-${aiTheme}`);
                responseMsgDiv.classList.add(`theme-${aiTheme}`);
            }

            const finalArea = document.createElement('div');
            finalArea.className = 'final-answer-instant omni-fade-in';
            finalArea.innerHTML = formatOutput(mainResponseText || "Omni was unable to generate a text response.");
            responseBubble.appendChild(finalArea);

            // ATTACH VIDEOS IF VIDEO MODE IS ENABLED
            if (isVideoNeeded) {
                try {
                    const keywords = lastUserQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3).join(' ');
                    const foundVideos = await searchVideosForResponse(keywords || text);
                    
                    if (foundVideos && foundVideos.length > 0) {
                        const videosSection = document.createElement('div');
                        videosSection.style.cssText = `
                            margin-top: 16px;
                            padding-top: 16px;
                            border-top: 1px solid rgba(16,185,129,0.2);
                        `;
                        
                        const videoLabel = document.createElement('div');
                        videoLabel.style.cssText = `
                            font-size: 10px;
                            font-weight: 900;
                            color: #10b981;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            margin-bottom: 12px;
                        `;
                        videoLabel.textContent = '🎬 RELATED VIDEOS';
                        videosSection.appendChild(videoLabel);

                        const videosContainer = document.createElement('div');
                        videosContainer.style.cssText = `
                            display: flex;
                            flex-wrap: wrap;
                            gap: 12px;
                        `;

                        foundVideos.forEach(video => {
                            const card = createResponseVideoCard(video);
                            if (card) videosContainer.appendChild(card);
                        });

                        videosSection.appendChild(videosContainer);
                        finalArea.appendChild(videosSection);
                    }
                } catch (e) {
                    console.error("Video attachment error:", e);
                }
            }

            if (isSearchNeeded || isVideoNeeded) workbench.updateTask('search', 'completed');
            if (isWikiNeeded) workbench.updateTask('wiki-fetch', 'completed');
            workbench.updateTask('synthesis', 'completed');
            workbench.destroy();
            
            let sourceLinks = collectSourcesFromResult(result);
            if ((isSearchNeeded || isDeepSearch || isQuickSearch) && sourceLinks.length === 0) {
                try {
                    const fallbackSearch = await window.browserAPI.ai.webSearch(text);
                    if (fallbackSearch?.sources?.length) {
                        sourceLinks = normalizeSourceLinks([...(sourceLinks || []), ...fallbackSearch.sources]);
                    }
                } catch (fallbackErr) {
                    console.warn("Source fallback fetch failed:", fallbackErr?.message || fallbackErr);
                }
            }
            appendActionBar(responseBubble, mainResponseText, text, sourceLinks, offlineLogs);
            setupInteractiveElements(responseBubble);
            
            chatHistory.push({ role: 'user', parts: [{ text: text }] });
            chatHistory.push({ role: 'model', parts: [{ text: rawText }] });
        } catch (e) {
            if (responseBubble) {
                console.error("Omni Render Fail:", e);
                const isResilientMode = modeAtSend === 'web' || modeAtSend === 'quick_search' || modeAtSend === 'wiki';

                if (isResilientMode) {
                    try {
                        if (modeAtSend === 'web' || modeAtSend === 'quick_search') {
                            workbench.updateTask('search', 'active');
                        }
                        if (modeAtSend === 'wiki') {
                            workbench.updateTask('wiki-fetch', 'active');
                        }
                        workbench.updateTask('synthesis', 'active');

                        const sourceLinks = await collectEmergencySourceLinks({
                            query: text,
                            mode: modeAtSend,
                            partialResult
                        });

                        if (sourceLinks.length > 0) {
                            await workbench.renderWebSources(sourceLinks);
                        }

                        const fallbackText = buildSourceBackedFallbackAnswer(
                            text,
                            modeAtSend,
                            sourceLinks,
                            e?.message || 'API failure'
                        );

                        if (fallbackText) {
                            const finalArea = document.createElement('div');
                            finalArea.className = 'final-answer-instant omni-fade-in';
                            finalArea.innerHTML = formatOutput(fallbackText);
                            responseBubble.appendChild(finalArea);

                            appendActionBar(responseBubble, fallbackText, text, sourceLinks);
                            setupInteractiveElements(responseBubble);

                            if (modeAtSend === 'web' || modeAtSend === 'quick_search') {
                                workbench.updateTask('search', 'completed');
                            }
                            if (modeAtSend === 'wiki') {
                                workbench.updateTask('wiki-fetch', 'completed');
                            }
                            workbench.updateTask('synthesis', 'completed');
                            workbench.destroy();

                            chatHistory.push({ role: 'user', parts: [{ text }] });
                            chatHistory.push({ role: 'model', parts: [{ text: fallbackText }] });
                            return;
                        }
                    } catch (fallbackError) {
                        console.warn('Emergency source fallback failed:', fallbackError?.message || fallbackError);
                    }
                }

                workbench.destroy();
                const errDiv = document.createElement('div');
                errDiv.className = 'error-message';
                errDiv.innerHTML = `<strong>System Error:</strong> ${e.message}`;
                responseBubble.appendChild(errDiv);
            }
        } finally { finishGen(); }
    };

    const finishGen = () => {
        isGenerating = false; 
        updateSendButtonState();
        if(els.iconSend) els.iconSend.classList.remove('hidden'); 
        if(els.iconStop) els.iconStop.classList.add('hidden');
        ensureInputActive();
        scrollToBottom();
    };

    const clearAssets = () => { 
        attachedAssets = [];
        if (els.attachedAssetsPreview) {
            els.attachedAssetsPreview.classList.add('hidden');
        }
        if (els.attachmentsList) {
            els.attachmentsList.innerHTML = '';
        }
        if (els.attachmentCount) {
            els.attachmentCount.textContent = '0';
        }
        updateSendButtonState();
    };

    const removeAsset = (index) => {
        if (index >= 0 && index < attachedAssets.length) {
            attachedAssets.splice(index, 1);
            renderAttachments();
        }
    };

    const getFileIcon = (fileType) => {
        const icons = {
            image: '🖼️',
            text: '📄',
            binary: '📎',
            pdf: '📕',
            code: '💻',
            document: '📝',
            archive: '📦',
            video: '🎬',
            audio: '🎵',
            default: '📄'
        };
        return icons[fileType] || icons.default;
    };

    const getFileTypeLabel = (ext, fileType) => {
        if (fileType === 'image') return 'IMAGE';
        if (fileType === 'text') return 'TEXT';
        if (fileType === 'binary') return ext.toUpperCase() || 'FILE';
        return ext.toUpperCase() || 'FILE';
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const renderAttachments = () => {
        if (!els.attachmentsList || !els.attachedAssetsPreview || !els.attachmentCount) return;

        // Update count
        els.attachmentCount.textContent = attachedAssets.length;

        // Show/hide popup
        if (attachedAssets.length === 0) {
            els.attachedAssetsPreview.classList.add('hidden');
            els.attachmentsList.innerHTML = '';
            return;
        }

        els.attachedAssetsPreview.classList.remove('hidden');

        // Render each attachment
        els.attachmentsList.innerHTML = attachedAssets.map((asset, index) => {
            const ext = asset.fileName.split('.').pop().toLowerCase();
            const size = asset.data ? formatFileSize(asset.data.length) : '';
            const typeLabel = getFileTypeLabel(ext, asset.fileType);
            const icon = getFileIcon(asset.fileType);

            let previewHTML = '';
            if (asset.fileType === 'image' && asset.data) {
                previewHTML = `<div class="attachment-preview"><img src="data:${asset.mimeType};base64,${asset.data}" alt="${asset.fileName}"></div>`;
            } else {
                previewHTML = `<div class="attachment-preview"><div class="file-icon">${icon}</div></div>`;
            }

            return `
                <div class="attachment-item ${asset.fileType}">
                    ${previewHTML}
                    <div class="attachment-info">
                        <div class="attachment-name" title="${asset.fileName}">${asset.fileName}</div>
                        <div class="attachment-meta">
                            <span class="attachment-type">${typeLabel}</span>
                            ${size ? `<span class="attachment-size">${size}</span>` : ''}
                        </div>
                    </div>
                    <div class="attachment-actions">
                        <button class="attachment-btn remove" onclick="removeAsset(${index})" title="Remove attachment">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Make removeAsset available globally for onclick handlers
    window.removeAsset = removeAsset;

    // Clear all attachments button
    if (els.clearAllAttachments) {
        els.clearAllAttachments.addEventListener('click', clearAssets);
    }

    // Use addEventListener instead of onclick
    if (els.btnPlus) {
        els.btnPlus.addEventListener('click', async (e) => {
            e.stopPropagation();
            await loadConfig();
            els.abilitiesPopup.classList.toggle('hidden');
            els.btnPlus.classList.toggle('active');
            // Update buttons when popup opens
            if (!els.abilitiesPopup.classList.contains('hidden')) {
                updateAbilityButtons();
                updateSerpapiQuota();
            }
        });
    }

    const updateAbilityButtons = () => {
        const modeButtons = {
            'nothing': els.btnAbilityNothing,
            'quick_search': els.btnToggleQuickSearch,
            'web': els.btnToggleSearch,
            'wiki': els.btnToggleWiki,
            'video': els.btnToggleVideo
        };
        
        Object.entries(modeButtons).forEach(([mode, btn]) => {
            if (btn) {
                if (currentMode === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    };

    function syncOfflineModeLock() {
        offlineModeLocked = String(config?.provider || '').toLowerCase() === 'offline';
        const modeButtons = [
            els.btnToggleQuickSearch,
            els.btnToggleSearch,
            els.btnToggleWiki,
            els.btnToggleVideo
        ];

        modeButtons.forEach((btn) => {
            if (!btn) return;
            btn.disabled = offlineModeLocked;
            btn.classList.toggle('disabled', offlineModeLocked);
            btn.title = offlineModeLocked
                ? 'Disabled in Offline Bot mode. Offline Scraper workflow is used automatically.'
                : '';
        });

        if (offlineModeLocked && currentMode !== 'nothing') {
            currentMode = 'nothing';
            updateModeUI();
        }
        updateAbilityButtons();
    }

    const setMode = (mode) => {
        if (offlineModeLocked && mode !== 'nothing') {
            currentMode = 'nothing';
            updateModeUI();
            updateAbilityButtons();
            if (els.abilitiesPopup) els.abilitiesPopup.classList.add('hidden');
            if (els.btnPlus) els.btnPlus.classList.remove('active');
            return;
        }
        // Toggle: if clicking same mode, turn it off (go to nothing)
        if (currentMode === mode) {
            currentMode = 'nothing';
        } else {
            currentMode = mode;
        }
        
        updateModeUI();
        updateAbilityButtons();
        if (els.abilitiesPopup) els.abilitiesPopup.classList.add('hidden');
        if (els.btnPlus) els.btnPlus.classList.remove('active');
    };
    
    if (els.btnAbilityNothing) els.btnAbilityNothing.addEventListener('click', () => setMode('nothing'));
    if (els.btnToggleQuickSearch) els.btnToggleQuickSearch.addEventListener('click', () => setMode('quick_search'));
    if (els.btnToggleSearch) els.btnToggleSearch.addEventListener('click', () => setMode('web'));
    if (els.btnToggleWiki) els.btnToggleWiki.addEventListener('click', () => setMode('wiki'));
    if (els.btnToggleVideo) els.btnToggleVideo.addEventListener('click', () => setMode('video'));

    if (els.btnAttach) {
        els.btnAttach.addEventListener('click', async () => {
            if (els.abilitiesPopup) els.abilitiesPopup.classList.add('hidden');
            if (els.btnPlus) els.btnPlus.classList.remove('active');
            try {
                // Open file dialog with all file types allowed
                const filePath = await window.browserAPI.files.selectFile([{ name: 'All Files', extensions: ['*'] }]);
                if (filePath) {
                    const fileName = filePath.split(/[/\\]/).pop();
                    const ext = fileName.split('.').pop().toLowerCase();
                    
                    // Determine file type and process accordingly
                    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
                    const textExts = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'py', 'java', 'c', 'cpp', 'cs', 'ts', 'go', 'rb', 'php', 'swift', 'kotlin', 'sql', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv'];
                    
                    if (imageExts.includes(ext)) {
                        // Handle image files
                        const dataUrl = await window.browserAPI.files.read(filePath);
                        if (dataUrl) {
                            const [header, base64Data] = dataUrl.split(',');
                            const mimeType = header.match(/:(.*?);/)[1];
                            const newAsset = {
                                data: base64Data,
                                mimeType: mimeType,
                                fileName: fileName,
                                fileType: 'image'
                            };
                            attachedAssets.push(newAsset);
                            renderAttachments();
                        }
                    } else if (textExts.includes(ext)) {
                        // Handle text/code files
                        const content = await window.browserAPI.files.read(filePath);
                        if (content) {
                            const newAsset = {
                                data: content,
                                fileName: fileName,
                                fileType: 'text'
                            };
                            attachedAssets.push(newAsset);
                            renderAttachments();
                        }
                    } else {
                        // Handle binary files (PDF, documents, etc.)
                        const newAsset = {
                            filePath: filePath,
                            fileName: fileName,
                            fileType: 'binary'
                        };
                        attachedAssets.push(newAsset);
                        renderAttachments();
                    }
                }
            } catch (e) {
                console.error("Attach File Failed", e);
            }
        });
    }

    if (els.btnEnhance) {
        els.btnEnhance.addEventListener('click', async () => {
            const text = els.input.value.trim();
            if (!text) return;
            if (els.abilitiesPopup) els.abilitiesPopup.classList.add('hidden');
            if (els.btnPlus) els.btnPlus.classList.remove('active');
            
            const originalText = els.input.value;
            els.input.value = "Enhancing prompt...";
            els.input.disabled = true;

            try {
                await loadConfig();
                
                // Enhanced system instruction for better prompt refinement
                const enhanceSystemPrompt = `You are an expert prompt engineer. Your task is to improve and refine user prompts for maximum effectiveness.

ENHANCEMENT GUIDELINES:
1. CLARITY: Make the request unambiguous and specific
2. DETAIL: Add relevant context, constraints, and requirements
3. SPECIFICITY: Include desired format, tone, and scope
4. ACTIONABILITY: Ensure the prompt leads to concrete, measurable results
5. STRUCTURE: Organize complex requests into logical steps
6. CONTEXT: Add background information that helps the AI understand intent

IMPORTANT RULES:
- Return ONLY the final enhanced prompt
- NO explanations, thinking, or reasoning
- NO <think>, <thinking>, <reasoning>, or <analysis> tags
- NO meta-commentary about what you changed
- NO introductions like "Here is the enhanced prompt" or "Improved version:"
- NO bullet points explaining the improvements
- Output ONLY the prompt text itself`;
                
                const result = await window.browserAPI.ai.performTask({
                    text: `Improve and enhance this prompt for clarity, detail, and effectiveness: "${originalText}"`,
                    configOverride: config,
                    systemInstruction: enhanceSystemPrompt
                });
                
                if (result && result.text) {
                    let enhancedText = result.text.trim();
                    
                    // Remove thinking/reasoning sections if present
                    const thinkingPatterns = [
                        /<thinking>[ -￿]*?<\/thinking>/gi,
                        /<reasoning>[ -￿]*?<\/reasoning>/gi,
                        /\*\*Thinking:\*\*[ -￿]*?(?=\*\*|$)/gi,
                        /Thinking:[\s\S]*?(?=\n\n|$)/i,
                        /Here is the enhanced prompt:?\s*/gi,
                        /Improved version:?\s*/gi,
                        /Enhanced prompt:?\s*/gi,
                        /^\s*\d+\.[\s\S]*?(?=\n\n[A-Z]|$)/m,
                    ];
                    
                    thinkingPatterns.forEach(pattern => {
                        enhancedText = enhancedText.replace(pattern, '');
                    });
                    
                    // Remove lines that start with common reasoning phrases
                    const reasoningLines = [
                        /^I\s+improved/i,
                        /^I\s+enhanced/i,
                        /^I\s+added/i,
                        /^I\s+made/i,
                        /^Changes\s+made/i,
                        /^Improvements/i,
                        /^Key\s+enhancements/i,
                        /^Enhancement\s+details/i,
                    ];
                    
                    const lines = enhancedText.split('\n');
                    const cleanLines = [];
                    let skipRest = false;
                    
                    for (const line of lines) {
                        if (skipRest) break;
                        
                        const isReasoningLine = reasoningLines.some(pattern => pattern.test(line));
                        if (isReasoningLine) {
                            skipRest = true;
                            continue;
                        }
                        
                        cleanLines.push(line);
                    }
                    
                    enhancedText = cleanLines.join('\n').trim();
                    
                    // Remove surrounding quotes if present
                    if ((enhancedText.startsWith('"') && enhancedText.endsWith('"')) ||
                        (enhancedText.startsWith("'") && enhancedText.endsWith("'"))) {
                        enhancedText = enhancedText.slice(1, -1).trim();
                    }
                    
                    // Final safety cleanup: strip any leaked reasoning/thinking sections and wrappers.
                    enhancedText = String(enhancedText || '').trim();

                    const leakedReasoningBlocks = [
                        /<\s*(think|thinking|reasoning|analysis)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
                        /```(?:thinking|reasoning|analysis|thoughts?|cot)[^\n]*\n[\s\S]*?```/gi
                    ];
                    leakedReasoningBlocks.forEach((pattern) => {
                        enhancedText = enhancedText.replace(pattern, '');
                    });

                    // If the model emitted a labeled final section, keep only the prompt content after it.
                    const finalPromptLabels = [
                        /(?:^|\n)\s*(?:#+\s*)?(?:final\s+(?:enhanced\s+)?prompt|enhanced\s+prompt|improved\s+prompt|rewritten\s+prompt)\s*:\s*/gi,
                        /(?:^|\n)\s*(?:here(?:'s| is)\s+)?(?:the\s+)?(?:enhanced|improved)\s+prompt\s*:\s*/gi
                    ];
                    let finalLabelCut = -1;
                    for (const pattern of finalPromptLabels) {
                        pattern.lastIndex = 0;
                        let match;
                        while ((match = pattern.exec(enhancedText)) !== null) {
                            finalLabelCut = match.index + match[0].length;
                        }
                    }
                    if (finalLabelCut >= 0) {
                        enhancedText = enhancedText.slice(finalLabelCut).trim();
                    }

                    // Drop top meta/explanation lines if they leak into output.
                    const metaHeadings = /^(?:#+\s*)?(?:thinking|reasoning|analysis|thought\s*process|changes\s+made|improvements?|key\s+enhancements?|enhancement\s+details)\b[:\-]?\s*$/i;
                    const metaLine = /^(?:I\s+(?:improved|enhanced|added|made|rewrote)\b|This\s+prompt\s+(?:adds|improves)\b|(?:Key\s+)?Improvements?\b[:\-]?|(?:Here(?:'s| is)|Below is)\b)/i;
                    const bulletLine = /^(?:[-*]\s+|\d+\.\s+)/;
                    const cleanedLines = [];
                    let insideMeta = false;
                    for (let line of enhancedText.split(/\r?\n/)) {
                        const trimmed = line.trim();
                        if (!trimmed) {
                            if (!insideMeta && cleanedLines.length && cleanedLines[cleanedLines.length - 1] !== '') cleanedLines.push('');
                            continue;
                        }
                        if (metaHeadings.test(trimmed)) {
                            insideMeta = true;
                            continue;
                        }
                        if (insideMeta) {
                            const finalHeader = /^(?:#+\s*)?(?:final|enhanced|improved|rewritten)\s+prompt\b[:\-]?\s*/i;
                            if (finalHeader.test(trimmed)) {
                                line = line.replace(finalHeader, '');
                                insideMeta = false;
                            } else if (metaLine.test(trimmed) || bulletLine.test(trimmed)) {
                                continue;
                            } else {
                                insideMeta = false;
                            }
                        }
                        const hasPromptContent = cleanedLines.some((l) => l.trim().length > 0);
                        if (!hasPromptContent && (metaLine.test(trimmed) || /^```(?:text|prompt|markdown)?$/i.test(trimmed))) {
                            continue;
                        }
                        cleanedLines.push(line);
                    }
                    enhancedText = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

                    // Unwrap generic fenced output and remove surrounding quotes again after cleanup.
                    enhancedText = enhancedText
                        .replace(/^```(?:text|prompt|markdown)?\s*/i, '')
                        .replace(/\s*```$/i, '')
                        .trim();
                    if ((enhancedText.startsWith('"') && enhancedText.endsWith('"')) ||
                        (enhancedText.startsWith("'") && enhancedText.endsWith("'"))) {
                        enhancedText = enhancedText.slice(1, -1).trim();
                    }

                    els.input.value = enhancedText || originalText;
                } else {
                    els.input.value = originalText;
                }
            } catch (e) {
                console.error("Prompt enhancement failed:", e);
                els.input.value = originalText;
            } finally {
                els.input.disabled = false;
                els.input.focus();
                els.input.style.height = 'auto';
                els.input.style.height = Math.min(els.input.scrollHeight, 100) + 'px';
                ensureInputActive();
            }
        });
    }
    
    if (els.input) {
        els.input.addEventListener('input', () => { 
            els.input.style.height = 'auto'; 
            els.input.style.height = Math.min(els.input.scrollHeight, 100) + 'px'; 
            renderDatabaseTopicPopup();
            updateSendButtonState();
        });
        els.input.addEventListener('focus', renderDatabaseTopicPopup);
        els.input.addEventListener('keydown', (e) => {
            if (handleDatabaseTopicPopupKeydown(e)) {
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (els.btnSend) els.btnSend.addEventListener('click', sendMessage);
    
    if (els.btnNewChat) {
        els.btnNewChat.addEventListener('click', () => {
            chatHistory = [];
            if (els.messages) els.messages.innerHTML = '';
            if (els.welcome) els.welcome.classList.remove('hidden');
            clearAssets();
            currentMode = 'nothing';
            updateModeUI();
        });
    }

    if (els.btnSettings) {
        els.btnSettings.addEventListener('click', () => {
            window.browserAPI.openTab(new URL('../../html/pages/ai-settings.html', window.location.href).href);
        });
    }

    if (els.btnOpenLlama) {
        els.btnOpenLlama.addEventListener('click', async () => {
            await loadConfig();
            const url = resolveLlamaWebUrl();
            window.browserAPI.openTab(url);
        });
    }

    // Modal Events
    if (els.btnWikiCancel) els.btnWikiCancel.addEventListener('click', () => els.wikiModal.classList.add('hidden'));

    // Global Close for Popups
    document.addEventListener('click', (e) => {
        if (els.abilitiesPopup && !els.abilitiesPopup.classList.contains('hidden') && !els.btnPlus.contains(e.target) && !els.abilitiesPopup.contains(e.target)) {
            els.abilitiesPopup.classList.add('hidden');
            els.btnPlus.classList.remove('active');
            // Ensure input can receive focus after popup closes
            ensureInputActive();
        }
        if (dbTopicPopup && !dbTopicPopup.classList.contains('hidden') && els.input && !els.input.contains(e.target) && !dbTopicPopup.contains(e.target)) {
            hideDatabaseTopicPopup();
        }
    });

    // Bind to Init Image from main process (text from selection)
    if (window.browserAPI && typeof window.browserAPI.onInitImage === 'function') {
      window.browserAPI.onInitImage((payload) => {
        try {
          const text = payload && payload.text ? payload.text : '';
          if (!text) return;
          const filename = payload.filename || `Snippet-${Date.now()}.txt`;
          const asset = { data: text, fileName: filename, mimeType: 'text/plain', fileType: 'text' };
          attachedAssets.push(asset);
          renderAttachments();
          // Focus input and show attachment
          if (els.input) {
            els.input.focus();
          }
        } catch (err) {
          console.error('Failed to attach text from init-image', err);
        }
      });
    }

    updateModeUI();
    updateAbilityButtons();
    await loadConfig();
});

function applyChatWindowMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') !== 'chat') return;
    document.body.classList.add('ai-chat-window-mode');
    setupChatWindowContextMenu();
}

function setupChatWindowContextMenu() {
    let menu = document.getElementById('ai-chat-window-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'ai-chat-window-context-menu';
        menu.style.position = 'fixed';
        menu.style.zIndex = '9999';
        menu.style.background = 'rgba(10,10,14,0.96)';
        menu.style.border = '1px solid rgba(255,255,255,0.08)';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 12px 30px rgba(0,0,0,0.45)';
        menu.style.padding = '6px';
        menu.style.minWidth = '180px';
        menu.style.display = 'none';
        menu.innerHTML = `
            <button data-action="minimize" style="width:100%; text-align:left; background:transparent; border:none; color:#e4e4e7; padding:8px 10px; border-radius:6px; cursor:pointer;">Minimize</button>
            <button data-action="maximize" style="width:100%; text-align:left; background:transparent; border:none; color:#e4e4e7; padding:8px 10px; border-radius:6px; cursor:pointer;">Maximize/Restore</button>
            <button data-action="devtools" style="width:100%; text-align:left; background:transparent; border:none; color:#e4e4e7; padding:8px 10px; border-radius:6px; cursor:pointer;">Dev Tools</button>
            <button data-action="close" style="width:100%; text-align:left; background:transparent; border:none; color:#e4e4e7; padding:8px 10px; border-radius:6px; cursor:pointer;">Close</button>
        `;
        document.body.appendChild(menu);
    }

    const hideMenu = () => { menu.style.display = 'none'; };
    document.addEventListener('click', hideMenu);
    document.addEventListener('scroll', hideMenu, true);
    window.addEventListener('blur', hideMenu);

    document.addEventListener('contextmenu', (e) => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') !== 'chat') return;
        e.preventDefault();
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.display = 'block';
    });

    menu.querySelectorAll('button[data-action]').forEach(btn => {
        btn.onclick = () => {
            hideMenu();
            const action = btn.getAttribute('data-action');
            const win = window.browserAPI?.window;
            if (!win) return;
            if (action === 'minimize') win.minimize();
            if (action === 'maximize') win.toggleMaximize();
            if (action === 'close') win.close();
            if (action === 'devtools' && win.toggleDevTools) win.toggleDevTools();
        };
    });
}
