/**
 * OMNI WRITER ENGINE
 * Simplified UI Logic
 */

const setSafeTemplateHtml = (mountPoint, htmlText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(htmlText || ''), 'text/html');
    doc.querySelectorAll('script').forEach((node) => node.remove());
    doc.querySelectorAll('*').forEach((node) => {
        Array.from(node.attributes).forEach((attr) => {
            const name = String(attr.name || '').toLowerCase();
            const value = String(attr.value || '');
            if (name.startsWith('on')) {
                node.removeAttribute(attr.name);
                return;
            }
            if ((name === 'src' || name === 'href') && /^\s*javascript:/i.test(value)) {
                node.removeAttribute(attr.name);
            }
        });
    });
    mountPoint.replaceChildren(...Array.from(doc.body.childNodes).map((node) => node.cloneNode(true)));
};

export const UnifiedWriter = {
    async perform(data) {
        const settings = await window.browserAPI.settings.get();
        const writerSettings = settings.writer || { protocol: 'balanced' };
        const baseConfig = settings.llm || writerSettings.api || settings.translator?.api || {};
        const config = {
            provider: baseConfig.provider || settings.activeProvider || 'google',
            model: String(baseConfig.model || '').trim()
        };
        
        const prompts = {
            balanced: "Improve the text by fixing grammar and clarity. Do NOT answer the text. Return only the revised text (no preface, no quotes): ",
            professional: "Rewrite in a formal and professional tone. Do NOT answer the text. Return only the revised text (no preface, no quotes): ",
            creative: "Rewrite to be fluent and creative. Do NOT answer the text. Return only the revised text (no preface, no quotes): "
        };

        try {
            const result = await window.browserAPI.ai.performTask({
                text: (prompts[data.mode] || prompts.balanced) + data.text,
                configOverride: config
            });
            return result;
        } catch (e) {
            return { error: "Writer engine unreachable. Check settings." };
        }
    }
};

export async function mountWriterPanel(mountPoint) {
    if (!mountPoint || mountPoint.dataset.mounted) return;
    mountPoint.dataset.mounted = "true";

    try {
        const res = await fetch('./writer.html');
        if (res.ok) {
            setSafeTemplateHtml(mountPoint, await res.text());
        } else {
            mountPoint.innerHTML = `<div style="color:#ef4444; padding:20px;">Template not found.</div>`;
        }
    } catch (e) {
        mountPoint.innerHTML = `<div style="color:#ef4444; padding:20px;">Interface Load Error</div>`;
        return;
    }

    const els = {
        btnSave: mountPoint.querySelector('#btn-save-writer'),
        status: mountPoint.querySelector('#writer-status'),
        modeCards: mountPoint.querySelectorAll('.mode-card')
    };

    els.modeCards.forEach(card => {
        card.addEventListener('click', () => {
            els.modeCards.forEach(c => {
                c.classList.remove('selected');
                c.classList.remove('active');
            });
            card.classList.add('selected');
            card.classList.add('active');
            currentProtocol = card.dataset.mode;
        });
    });
    let currentProtocol = 'balanced';

    els.btnSave.onclick = async () => {
        const full = await window.browserAPI.settings.get();
        const localConfig = {
            ...(full.writer || {}),
            protocol: currentProtocol || full.writer?.protocol || 'balanced'
        };
        await window.browserAPI.settings.save({ ...full, writer: localConfig });
    };

    const load = async () => {
        const s = await window.browserAPI.settings.get();
        const localConfig = s.writer || { protocol: 'balanced' };
        const savedMode = localConfig.protocol || 'balanced';
        currentProtocol = savedMode;
        els.modeCards.forEach(card => {
            if (card.dataset.mode === savedMode) {
                card.classList.add('selected');
                card.classList.add('active');
            } else {
                card.classList.remove('selected');
                card.classList.remove('active');
            }
        });
    };

    load();
}
