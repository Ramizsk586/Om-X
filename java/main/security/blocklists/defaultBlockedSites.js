// Default auto-block list for Security Firewall.
// Includes high-risk adult domains and known malicious/phishing domains.
// Last updated: February 2026

const DEFAULT_PORN_DOMAINS = [
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'tube8.com',
  'spankbang.com',
  'beeg.com',
  'brazzers.com',
  'chaturbate.com',
  'stripchat.com',
  'cam4.com',
  'livejasmin.com',
  'youjizz.com',
  'sunporno.com',
  'eporner.com',
  'nudegirls.com',
  'hqporner.com',
  'adultfriendfinder.com'
];

const DEFAULT_MALICIOUS_DOMAINS = [
  'malware.test',
  'eicar.org',
  'test-malware.com',
  'phishing-login.com',
  'account-verify-security.net',
  'official-support-microsoft.tech',
  'your-pc-is-infected.site',
  'bank-secure-login.com',
  'wallet-connect-auth.net',
  'system-critical-alert.xyz',
  'verify-your-account-now.com',
  'confirm-identity-instantly.net',
  'secure-payment-verification.io',
  'urgent-action-required.xyz',
  'dark-web.xyz',
  'update-browser-critical.com',
  'get-adobe-reader.info',
  'win-error-fixer.pro',
  'driver-update-critical.net',
  'system-optimizer-pro.com',
  'pc-cleaner-free.xyz',
  'free-crypto-giveaway.org',
  'monero-miner.net',
  'crypto-mining-pool.xyz',
  'bitcoin-doubler.io',
  'botnet-command.net',
  'zombie-network.xyz',
  'c2-server.io',
  'emotet-tracker.net',
  'mirai-botnet.xyz',
  'locky-ransomware.com',
  'wannacry-payload.net',
  'notpetya-distribution.xyz',
  'data-harvester.xyz',
  'identity-stealer.io'
];

const DEFAULT_BLOCKED_SITES = Array.from(
  new Set([...DEFAULT_PORN_DOMAINS, ...DEFAULT_MALICIOUS_DOMAINS])
);

module.exports = {
  DEFAULT_PORN_DOMAINS,
  DEFAULT_MALICIOUS_DOMAINS,
  DEFAULT_BLOCKED_SITES
};

