try {
  require('dotenv').config();
} catch (e) {
  // dotenv might not be installed, or file missing
  console.log('[Om-X] Note: .env loading skipped or failed.');
}
require('./java/main/mainProcess');