const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Mock signature DB (In real world, this would be a large binary DB)
const KNOWN_MALWARE_HASHES = [
  "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f", // EICAR Test String (SHA256)
  "44d88612fea8a8f36de82e1278abb02f" // EICAR (MD5)
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.scr', '.bat', '.cmd', '.vbs', '.js', '.msi', '.pif', '.com', '.jar', '.ps1', '.sh', '.reg', '.hta'
];

const TRUSTED_SOURCES = [
  'microsoft.com',
  'google.com',
  'github.com',
  'mozilla.org',
  'adobe.com',
  'apple.com',
  'dropbox.com',
  'office.com',
  'nvidia.com',
  'intel.com',
  'amd.com',
  'oracle.com',
  'java.com',
  'steamstatic.com'
];

class AntivirusEngine {
  constructor(settings) {
    this.enabled = settings?.features?.enableAntivirus ?? true;
    this.reputationCache = new Map(); // Simple memory-based reputation cache
  }

  updateSettings(settings) {
    this.enabled = settings?.features?.enableAntivirus ?? true;
  }

  /**
   * Scans a download item before it completes.
   * @param {DownloadItem} item 
   * @returns {Promise<{safe: boolean, reason: string}>}
   */
  async scanDownload(item) {
    if (!this.enabled) return { safe: true };

    try {
      const filename = item.getFilename().toLowerCase();
      const url = item.getURL();
      const mimeType = item.getMimeType();
      
      let domain = 'unknown';
      try {
        domain = new URL(url).hostname;
      } catch (e) {
        return { safe: true }; // Fail open
      }

      // 1. MIME Validation vs Extension
      // Prevents "image.png" being an actual "application/x-msdownload"
      if (this.isMimeMismatch(filename, mimeType)) {
        return { safe: false, reason: "File extension and MIME-type mismatch (Detection: Extension Spoofing)" };
      }

      // 2. Double Extension Check
      if (this.hasDoubleExtension(filename)) {
        return { safe: false, reason: "Dangerous double extension detected (Detection: Masking)" };
      }

      // 3. Dangerous Extension & Source Check
      const ext = path.extname(filename);
      if (DANGEROUS_EXTENSIONS.includes(ext)) {
        const isTrusted = TRUSTED_SOURCES.some(trusted => domain === trusted || domain.endsWith('.' + trusted));
        if (!isTrusted) {
          // Warn for unknown-source executables, but do not hard-block by default.
          return { safe: true, warning: "Potentially unwanted executable from an untrusted source" };
        }
      }

      return { safe: true };
    } catch (err) {
      console.error("Antivirus Pre-Scan Error (Open-Fail):", err);
      return { safe: true };
    }
  }

  /**
   * Verifies file integrity after download but before user access.
   * @param {string} filePath 
   */
  async postDownloadScan(filePath) {
    if (!this.enabled) return { safe: true };

    try {
      if (!fs.existsSync(filePath)) return { safe: true };

      // 4. Reputation Check (Fast lookup)
      if (this.reputationCache.has(filePath)) {
        return this.reputationCache.get(filePath);
      }

      // 5. Hash Check
      const hash = await this.calculateFileHash(filePath);
      if (KNOWN_MALWARE_HASHES.includes(hash)) {
        return { safe: false, reason: "Known malicious file signature detected" };
      }

      // 6. Entropy Check (Heuristic for packing/obfuscation)
      const ext = path.extname(filePath).toLowerCase();
      if (['.exe', '.dll', '.so', '.bin'].includes(ext)) {
          const entropy = await this.calculateEntropy(filePath);
          // Executables with extremely high entropy often indicate malware packers/encrypters
          if (entropy > 7.7) {
             return { safe: false, reason: "Extremely high entropy detected (Detection: Malicious Obfuscation)" };
          }
      }

      const result = { safe: true };
      this.reputationCache.set(filePath, result);
      return result;

    } catch (e) {
      console.error("Antivirus Post-Scan Error (Open-Fail):", e);
      return { safe: true }; // Fail open
    }
  }

  isMimeMismatch(filename, mimeType) {
    if (!mimeType) return false;
    const ext = path.extname(filename).toLowerCase();
    
    const binaryTypes = [
        'application/x-msdownload', 
        'application/octet-stream', 
        'application/x-executable', 
        'application/x-sh', 
        'application/x-python'
    ];
    
    // Check for spoofing pairs (common document/image extensions used as covers)
    if (['.png', '.jpg', '.jpeg', '.pdf', '.docx', '.txt'].includes(ext)) {
      if (binaryTypes.some(bt => mimeType.includes(bt))) {
        return true;
      }
    }
    return false;
  }

  hasDoubleExtension(filename) {
    const parts = filename.split('.');
    if (parts.length < 3) return false;
    const lastExt = '.' + parts[parts.length - 1];
    const secondLastExt = '.' + parts[parts.length - 2];
    
    const docTypes = ['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.mp4', '.zip'];
    if (DANGEROUS_EXTENSIONS.includes(lastExt) && docTypes.includes(secondLastExt)) {
      return true;
    }
    return false;
  }

  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => resolve('io-error')); // Fail open on IO error
      } catch (e) { resolve('io-error'); }
    });
  }

  async calculateEntropy(filePath) {
    return new Promise((resolve) => {
      try {
        fs.open(filePath, 'r', (err, fd) => {
          if (err) return resolve(0);
          const buffer = Buffer.alloc(16384); // 16KB sample for accurate entropy
          fs.read(fd, buffer, 0, 16384, 0, (err, bytesRead) => {
            fs.close(fd, () => {});
            if (err || bytesRead === 0) return resolve(0);
            
            const frequencies = new Array(256).fill(0);
            for (let i = 0; i < bytesRead; i++) frequencies[buffer[i]]++;
            
            let entropy = 0;
            for (let i = 0; i < 256; i++) {
              if (frequencies[i] > 0) {
                const p = frequencies[i] / bytesRead;
                entropy -= p * Math.log2(p);
              }
            }
            resolve(entropy);
          });
        });
      } catch (e) { resolve(0); }
    });
  }

  quarantineFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) return null;
      const quarantinePath = filePath + '.quarantine';
      fs.renameSync(filePath, quarantinePath);
      return quarantinePath;
    } catch(e) {
      console.error("Quarantine operation failed", e);
      return null;
    }
  }
}

module.exports = AntivirusEngine;
