const path = require('node:path');

const backendDir = path.resolve(__dirname, '..');
const maxFileSizeBytes = Number(process.env.MAX_FILE_SIZE_BYTES || 10485760);

if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}

module.exports = {
  storageDir: path.resolve(backendDir, process.env.STORAGE_DIR || 'storage'),
  maxFileSizeBytes,
};
