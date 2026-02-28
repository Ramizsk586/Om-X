
// Layer 3: Educational & Medical Allowlist (v2.0)
// Enhanced safe domains list with categorization
// These domains are biased toward SAFE status to prevent false positives
// Last updated: January 2026

const EDUCATION_ALLOWLIST = [
  // Encyclopedias & Reference
  "wikipedia.org",
  "wiktionary.org",
  "britannica.com",
  "dictionary.com",
  "merriam-webster.com",

  // Medical & Health
  "ncbi.nlm.nih.gov",      // PubMed
  "who.int",               // WHO
  "cdc.gov",               // CDC
  "mayoclinic.org",
  "plannedparenthood.org",
  "webmd.com",
  "healthline.com",
  "medlineplus.gov",
  "nih.gov",
  "nhs.uk",
  "clevelandclinic.org",
  "hopkinsmedicine.org",
  "umm.edu",               // University of Maryland Medical
  "stanford.edu/medicine", // Stanford Medicine
  "jhu.edu",              // Johns Hopkins

  // Education & MOOCs
  "khanacademy.org",
  "coursera.org",
  "edx.org",
  "udemy.com",
  "quizlet.com",
  "duolingo.com",
  "archive.org",
  "scholar.google.com",
  "masterclass.com",
  "skillshare.com",

  // Science & Academic
  "sciencemag.org",
  "nature.com",
  "nationalgeographic.com",
  "scientificamerican.com",
  "arxiv.org",             // Scientific preprints
  "researchgate.net",      // Academic collaboration
  "pubmed.ncbi.nlm.nih.gov",

  // News & Media
  "bbc.com",
  "bbc.co.uk",
  "cnn.com",
  "nytimes.com",
  "theguardian.com",
  "reuters.com",
  "apnews.com",
  "bbc.com/news",
  "aljazeera.com",
  "npr.org",

  // Universities (Broad)
  ".edu",
  ".ac.uk",
  ".edu.au",
  ".edu.br",
  ".edu.cn",
  
  // Major Universities (Explicit)
  "harvard.edu",
  "stanford.edu",
  "berkeley.edu",
  "mit.edu",
  "caltech.edu",
  "cambridge.ac.uk",
  "oxford.ac.uk",
  "sorbonne.fr",
  "tokyo.ac.jp"
];

// Category mapping for better organization
const ALLOWLIST_CATEGORIES = {
  'medical': ['ncbi.nlm.nih.gov', 'who.int', 'cdc.gov', 'mayoclinic.org', 'webmd.com'],
  'educational': ['khanacademy.org', 'coursera.org', 'edx.org', 'udemy.com', 'duolingo.com'],
  'science': ['sciencemag.org', 'nature.com', 'nationalgeographic.com', 'arxiv.org'],
  'news': ['bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com', 'reuters.com'],
  'reference': ['wikipedia.org', 'britannica.com', 'dictionary.com', 'archive.org']
};

/**
 * Check if a domain is in the education allowlist
 * @param {string} domain - Domain to check
 * @returns {boolean} True if domain is allowed
 */
function isEducationalDomain(domain) {
  if (!domain) return false;
  
  return EDUCATION_ALLOWLIST.some(allowed => {
    if (domain === allowed) return true;
    if (domain.endsWith('.' + allowed)) return true;
    // Handle broad TLDs like .edu
    if (allowed.startsWith('.') && domain.endsWith(allowed)) return true;
  });
}

/**
 * Get category information for an allowed domain
 * @param {string} domain - Domain to analyze
 * @returns {object} Category information
 */
function getDomainCategory(domain) {
  if (!domain) return null;
  
  for (const [category, domains] of Object.entries(ALLOWLIST_CATEGORIES)) {
    if (domains.some(d => domain.endsWith(d))) {
      return {
        domain: domain,
        category: category,
        isAllowed: true
      };
    }
  }
  
  return {
    domain: domain,
    category: 'general',
    isAllowed: true
  };
}

/**
 * Get all domains in a specific category
 * @param {string} category - Category name
 * @returns {array} List of domains in category
 */
function getDomainsInCategory(category) {
  return ALLOWLIST_CATEGORIES[category] || [];
}

module.exports = { 
  EDUCATION_ALLOWLIST,
  ALLOWLIST_CATEGORIES,
  isEducationalDomain,
  getDomainCategory,
  getDomainsInCategory
};
