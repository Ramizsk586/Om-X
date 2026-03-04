
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    coachAnalyze: (fen) => ipcRenderer.invoke('coach-analyze', fen),
    coachAsk: (payload) => ipcRenderer.invoke('coach-ask', payload),
    coachCheckBlunder: (payload) => ipcRenderer.invoke('coach-check-blunder', payload),
    coachMove: (fen) => ipcRenderer.invoke('coach-move', fen),
    coachVerifyKey: (payload) => ipcRenderer.invoke('coach-verify-key', payload),
    coachIdleChatter: (personaId) => ipcRenderer.invoke('coach-idle-chatter', personaId),
    coachGetPersona: (personaId) => ipcRenderer.invoke('coach-get-persona', personaId),
    getPanelHtml: (panelName) => ipcRenderer.invoke('get-panel-html', panelName),
    // Engine Settings
    browseEngine: () => ipcRenderer.invoke('settings-browse-engine'),
    getEnginePath: () => ipcRenderer.invoke('settings-get-engine'),
    setEnginePath: (path) => ipcRenderer.invoke('settings-set-engine', path)
});
