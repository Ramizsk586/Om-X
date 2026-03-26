const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_PATHS = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '.env')
];

for (const envPath of ENV_PATHS) {
  try {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false, quiet: true });
  } catch (_) {}
}

