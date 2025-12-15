
const AntivirusEngine = require('./antivirus/AntivirusEngine');
const WebFirewall = require('./firewall/WebFirewall');
const path = require('path');
const { pathToFileURL } = require('url');

class SecurityManager {
  constructor(session, settings, mainWindow) {
    this.session = session;
    this.settings = settings;
    this.mainWindow = mainWindow;
    
    this.antivirus = new AntivirusEngine(settings);
    this.firewall = new WebFirewall(settings);
    
    // Resolve absolute path to defense page
    this.defensePagePath = path.resolve(__dirname, '../../../html/pages/security-defense.html');
    
    this.init();
  }

  updateSettings(newSettings) {
    this.settings = newSettings;
    this.antivirus.updateSettings(newSettings);
    this.firewall.updateSettings(newSettings);
    this.applyNetworkFilters();
  }

  init() {
    this.applyNetworkFilters();
    this.setupDownloadScanning();
  }

  createDefenseUrl(type, originalUrl, reason) {
    try {
        // Use pathToFileURL to handle Windows drive letters and separators correctly
        const fileUrl = pathToFileURL(this.defensePagePath);
        
        // Construct URL object to safely append params
        const safeUrl = new URL(fileUrl.href);
        safeUrl.searchParams.append('type', type);
        safeUrl.searchParams.append('url', originalUrl);
        safeUrl.searchParams.append('reason', reason || 'Security Policy');
        
        return safeUrl.toString();
    } catch (e) {
        console.error("Failed to construct defense URL:", e);
        return 'about:blank';
    }
  }

  notifySecurityBlock(data) {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          console.log(`[Security] Blocking ${data.originalUrl} -> Redirecting to Defense Page`);
          this.mainWindow.webContents.send('security-block', data);
      }
  }

  applyNetworkFilters() {
    this.session.webRequest.onBeforeRequest(null);
    this.session.webRequest.onHeadersReceived(null);

    const filter = { urls: ["*://*/*"] };

    this.session.webRequest.onBeforeRequest(filter, async (details, callback) => {
       const result = await this.firewall.analyzeRequest(details);
       
       if (result.action === 'block') {
           // Cancel request immediately to stop the network activity
           callback({ cancel: true });
           
           // Notify UI to navigate to the defense page locally
           const defenseUrl = this.createDefenseUrl(result.type || 'policy', details.url, result.reason);
           
           this.notifySecurityBlock({
               webContentsId: details.webContentsId,
               url: defenseUrl,
               originalUrl: details.url,
               reason: result.reason,
               type: result.type
           });

       } else if (result.action === 'cancel') {
           // Silent cancel (ads, trackers)
           callback({ cancel: true });
       } else if (result.action === 'redirect') {
           callback({ redirectURL: result.url });
       } else {
           callback({ cancel: false });
       }
    });

    this.session.webRequest.onHeadersReceived(filter, (details, callback) => {
        const result = this.firewall.analyzeHeaders(details);
        if (result.cancel) {
            callback({ cancel: true });
        } else {
            callback({ 
                responseHeaders: result.responseHeaders || details.responseHeaders,
                statusLine: details.statusLine 
            });
        }
    });
  }

  setupDownloadScanning() {
    this.session.on('will-download', async (event, item, webContents) => {
        const scanResult = await this.antivirus.scanDownload(item);
        
        if (!scanResult.safe) {
            event.preventDefault();
            console.log(`[Antivirus] Blocked download: ${item.getFilename()}. Reason: ${scanResult.reason}`);
            
            const defenseUrl = this.createDefenseUrl('download', item.getURL(), scanResult.reason);
            this.notifySecurityBlock({
                url: defenseUrl,
                type: 'download',
                reason: scanResult.reason
            });
            
            return;
        }

        item.once('done', async (e, state) => {
            if (state === 'completed') {
                const savePath = item.getSavePath();
                const postScan = await this.antivirus.postDownloadScan(savePath);
                
                if (!postScan.safe) {
                    console.log(`[Antivirus] Quarantine: ${item.getFilename()}. Reason: ${postScan.reason}`);
                    this.antivirus.quarantineFile(savePath);
                    
                    const defenseUrl = this.createDefenseUrl('malware', item.getURL(), postScan.reason);
                    this.notifySecurityBlock({
                        url: defenseUrl,
                        type: 'malware',
                        reason: postScan.reason
                    });
                }
            }
        });
    });
  }
}

module.exports = SecurityManager;
