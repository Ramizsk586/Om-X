/**
 * OMNI UNIFIED TRANSLATION ENGINE
 * Simplified Settings UI & Backend Router
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

export const UnifiedTranslator = {
    async perform(data) {
        const settings = await window.browserAPI.settings.get();
        const translatorSettings = settings.translator || { protocol: 'chromium', defaultTarget: 'en' };
        const baseConfig = settings.llm || translatorSettings.api || settings.writer?.api || {};
        const config = {
            provider: baseConfig.provider || settings.activeProvider || 'google',
            model: String(baseConfig.model || '').trim()
        };

        if ((config.provider || '').toLowerCase() === 'sarvamai') {
            return await window.browserAPI.translator.perform(data);
        }
        
        try {
            const result = await window.browserAPI.ai.performTask({
                text: `Directly translate to ${data.target || translatorSettings.defaultTarget || 'en'}: ${data.text}`,
                configOverride: config
            });
            return result;
        } catch (e) {
            return await window.browserAPI.translator.perform(data);
        }
    }
};

export async function mountTranslatorPanel(mountPoint) {
    if (!mountPoint || mountPoint.dataset.mounted) return;
    mountPoint.dataset.mounted = "true";

    try {
        const res = await fetch('./translate.html');
        if (!res.ok) throw new Error('Template not found');
        setSafeTemplateHtml(mountPoint, await res.text());
    } catch (e) {
        mountPoint.innerHTML = `<div style="color:#ef4444; padding:20px;">Interface Load Error</div>`;
        return;
    }

    const els = {
        targetLang: mountPoint.querySelector('#trans-default-lang'),
        langButtons: mountPoint.querySelectorAll('.lang-btn'),
        btnSave: mountPoint.querySelector('#btn-save-translator'),
        status: mountPoint.querySelector('#trans-status')
    };

    els.btnSave.onclick = async () => {
        const full = await window.browserAPI.settings.get();
        const localConfig = {
            ...(full.translator || {}),
            protocol: full.translator?.protocol || 'chromium',
            defaultTarget: els.targetLang.value
        };
        await window.browserAPI.settings.save({ ...full, translator: localConfig });
    };

    const load = async () => {
        const s = await window.browserAPI.settings.get();
        const localConfig = s.translator || { protocol: 'chromium', defaultTarget: 'en' };
        
        els.targetLang.value = localConfig.defaultTarget || 'en';
        els.langButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.lang === els.targetLang.value);
        });
    };

    load();
}
