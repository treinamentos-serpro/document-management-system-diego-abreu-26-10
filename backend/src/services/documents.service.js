const { randomUUID } = require('node:crypto');
const repository = require('../repositories/documents.repository');

function publicMetadata({ id, originalName, size, uploadedAt, owner }) {
  return { id, originalName, size, uploadedAt, owner };
}

async function upload(file, owner) {
  try {
    if (file.size === 0) {
      throw Object.assign(new Error('O arquivo não pode estar vazio.'), {
        code: 'BAD_REQUEST',
      });
    }

    return publicMetadata(repository.save({
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
      path: file.path,
    }));
  } catch (error) {
    try {
      await repository.removeFile(file.path);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Falha ao remover upload rejeitado.');
    }
    throw error;
  }
}

function list(owner) {
  return repository.findByOwner(owner)
    .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt)
      || first.id.localeCompare(second.id))
    .map(publicMetadata);
}

async function getDownload(id, owner) {
  const document = repository.findById(id);
  if (!document || document.owner !== owner
    || !await repository.isFileAvailable(document.path)) {
    throw Object.assign(new Error('Documento não encontrado.'), { code: 'NOT_FOUND' });
  }
  return document;
}

module.exports = {
  prepareStorage: repository.prepareStorage,
  upload,
  list,
  getDownload,
};
