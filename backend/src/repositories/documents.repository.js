const fs = require('node:fs/promises');
const { storageDir } = require('../config');

const documents = new Map();

async function prepareStorage() {
  await fs.mkdir(storageDir, { recursive: true });
  return storageDir;
}

function save(document) {
  documents.set(document.id, { ...document });
  return { ...document };
}

function findById(id) {
  const document = documents.get(id);
  return document ? { ...document } : undefined;
}

function findByOwner(owner) {
  return [...documents.values()]
    .filter((document) => document.owner === owner)
    .map((document) => ({ ...document }));
}

async function isFileAvailable(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return false;
    }
    throw error;
  }
}

async function removeFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  prepareStorage,
  save,
  findById,
  findByOwner,
  isFileAvailable,
  removeFile,
};
