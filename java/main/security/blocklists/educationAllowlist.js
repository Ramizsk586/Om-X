
// Layer 3: Educational & Medical Allowlist
// These domains are strongly biased toward SAFE status to prevent false positives
// on content related to biology, health, and medicine.

const EDUCATION_ALLOWLIST = [
  // Encyclopedias & Reference
  "wikipedia.org",
  "wiktionary.org",
  "britannica.com",
  "dictionary.com",
  "merriam-webster.com",

  // Medical & Health
  "ncbi.nlm.nih.gov", // PubMed
  "who.int",          // WHO
  "cdc.gov",          // CDC
  "mayoclinic.org",
  "plannedparenthood.org",
  "webmd.com",
  "healthline.com",
  "medlineplus.gov",
  "nih.gov",
  "nhs.uk",
  "clevelandclinic.org",
  "hopkinsmedicine.org",

  // Education & MOOCs
  "khanacademy.org",
  "coursera.org",
  "edx.org",
  "udemy.com",
  "quizlet.com",
  "duolingo.com",
  "archive.org",
  "scholar.google.com",

  // Science & News
  "sciencemag.org",
  "nature.com",
  "nationalgeographic.com",
  "scientificamerican.com",
  "bbc.com",
  "bbc.co.uk",
  "cnn.com",
  "nytimes.com",
  "theguardian.com",
  "reuters.com",

  // Universities (Broad)
  ".edu"
];

module.exports = { EDUCATION_ALLOWLIST };
