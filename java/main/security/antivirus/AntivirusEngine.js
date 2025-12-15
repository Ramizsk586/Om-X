
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Mock signature DB (In real world, this would be a large binary DB)
const KNOWN_MALWARE_HASHES = [
  "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f", // EICAR Test String (SHA256)
  "44d88612fea8a8f36de82e1278abb02f" // EICAR (MD5)
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.scr', '.bat', '.cmd', '.vbs', '.js', '.msi', '.pif', '.com', '.jar', '.ps1'
];

const TRUSTED_SOURCES = [
  'microsoft.com',
  'google.com',
  'github.com',
  'mozilla.org',
  'adobe.com'
];

class AntivirusEngine {
  constructor(settings) {
    this.enabled = settings?.features?.enableAntivirus ?? true;
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

    const filename = item.getFilename().toLowerCase();
    const url = item.getURL();
    const domain = new URL(url).hostname;

    // 1. Double Extension Check
    // e.g. "invoice.pdf.exe"
    if (this.hasDoubleExtension(filename)) {
      return { safe: false, reason: "Double extension detected (Masking)" };
    }

    // 2. Dangerous Extension & Source Check
    const ext = path.extname(filename);
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      const isTrusted = TRUSTED_SOURCES.some(trusted => domain.endsWith(trusted));
      if (!isTrusted) {
        // We don't block immediately, but we flag it for deep inspection or warning
        // For strict security: Block executable from unknown source
        return { safe: false, reason: "Executable from untrusted source" };
      }
    }

    // Note: Deep content scanning (hashing) usually requires the file to be written partially
    // Electron's download API writes to a temp path. We can scan that on 'done' if we pause it,
    // but here we are implementing pre-validation heuristics.
    
    return { safe: true };
  }

  /**
   * Verifies file integrity after download but before user access.
   * @param {string} filePath 
   */
  async postDownloadScan(filePath) {
    if (!this.enabled) return { safe: true };

    try {
      // 3. Hash Check
      const hash = await this.calculateFileHash(filePath);
      if (KNOWN_MALWARE_HASHES.includes(hash)) {
        return { safe: false, reason: "Known malware signature detected" };
      }

      // 4. Entropy Check (Heuristic for packing/encryption)
      // Highly entropy in a non-compressed format usually means encrypted payload
      const entropy = await this.calculateEntropy(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // Executables with high entropy often indicate packers like UPX (or malware obfuscation)
      if (['.exe', '.dll'].includes(ext) && entropy > 7.5) {
         return { safe: false, reason: "High entropy executable (Suspicious Packing)" };
      }

      return { safe: true };

    } catch (e) {
      console.error("AV Scan Error:", e);
      return { safe: true }; // Fail open on IO error to avoid breaking UX
    }
  }

  hasDoubleExtension(filename) {
    const parts = filename.split('.');
    if (parts.length < 3) return false;
    const lastExt = '.' + parts[parts.length - 1];
    const secondLastExt = '.' + parts[parts.length - 2];
    
    // Check if ends with executable but preceded by document type
    const docTypes = ['.pdf', '.txt', '.doc', '.docx', '.xls', '.jpg', '.png'];
    if (DANGEROUS_EXTENSIONS.includes(lastExt) && docTypes.includes(secondLastExt)) {
      return true;
    }
    return false;
  }

  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async calculateEntropy(filePath) {
    // Read first 4KB for header analysis to be fast
    return new Promise((resolve) => {
      fs.open(filePath, 'r', (err, fd) => {
        if (err) return resolve(0);
        const buffer = Buffer.alloc(4096);
        fs.read(fd, buffer, 0, 4096, 0, (err, bytesRead, buffer) => {
          fs.close(fd, () => {});
          
          if (bytesRead === 0) return resolve(0);
          
          const frequencies = new Array(256).fill(0);
          for (let i = 0; i < bytesRead; i++) {
            frequencies[buffer[i]]++;
          }
          
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
    });
  }

  quarantineFile(filePath) {
    try {
      const quarantinePath = filePath + '.quarantine';
      fs.renameSync(filePath, quarantinePath);
      return quarantinePath;
    } catch(e) {
      console.error("Quarantine failed", e);
      return null;
    }
  }
}

module.exports = AntivirusEngine;
