const { parentPort } = require('worker_threads');
const { runInbuiltCppProgram } = require('./InbuiltCppBasicRunner');

if (!parentPort) {
  process.exit(1);
}

parentPort.on('message', async (payload) => {
  const options = (payload && typeof payload === 'object') ? (payload.options || {}) : {};
  try {
    const result = await runInbuiltCppProgram(options);
    parentPort.postMessage({ type: 'result', result });
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: error?.message || String(error)
    });
  }
});
