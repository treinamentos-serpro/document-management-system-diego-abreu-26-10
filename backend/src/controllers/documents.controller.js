const { randomUUID } = require('node:crypto');
const multer = require('multer');
const service = require('../services/documents.service');
const { maxFileSizeBytes } = require('../config');

const receiveFile = multer({
  defParamCharset: 'utf8',
  storage: multer.diskStorage({
    destination(req, file, callback) {
      service.prepareStorage().then(
        (directory) => callback(null, directory),
        (error) => callback(error),
      );
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  }),
  // O Busboy dispara o limite ao atingi-lo; o byte extra torna o máximo inclusivo.
  limits: { fileSize: maxFileSizeBytes + 1 },
}).single('file');

function validateOwner(req, res, next) {
  const owner = req.get('X-User-Id')?.trim();
  if (!owner) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Informe o cabeçalho X-User-Id.' },
    });
  }
  res.locals.owner = owner;
  next();
}

function receiveUpload(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Envie um arquivo usando multipart/form-data.' },
    });
  }

  receiveFile(req, res, (error) => {
    if (error && [
      'Multipart: Boundary not found',
      'Unexpected end of form',
      'Unexpected end of file',
      'Malformed part header',
    ].includes(error.message)) {
      error.code = 'BAD_REQUEST';
    }
    next(error);
  });
}

async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Informe um arquivo no campo file.' },
    });
  }
  res.status(201).json(await service.upload(req.file, res.locals.owner));
}

function list(req, res) {
  res.json(service.list(res.locals.owner));
}

async function download(req, res, next) {
  const document = await service.getDownload(req.params.id, res.locals.owner);
  res.download(document.path, document.originalName, (error) => {
    if (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        error.code = 'NOT_FOUND';
      }
      next(error);
    }
  });
}

function handleError(error, req, res, next) {
  let code = error.code;
  if (error instanceof multer.MulterError) {
    code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'BAD_REQUEST';
  } else if (error.type === 'entity.parse.failed') {
    code = 'BAD_REQUEST';
  } else if (error.type === 'entity.too.large') {
    code = 'FILE_TOO_LARGE';
  }
  if (error.storageErrors?.length) {
    code = 'INTERNAL_ERROR';
  }

  const errors = {
    BAD_REQUEST: [400, 'Requisição inválida. Verifique o cabeçalho e o arquivo enviado.'],
    NOT_FOUND: [404, 'Documento não encontrado.'],
    FILE_TOO_LARGE: [413, 'O arquivo excede o limite permitido.'],
    INTERNAL_ERROR: [500, 'Não foi possível concluir a operação.'],
  };
  if (!Object.hasOwn(errors, code)) {
    code = 'INTERNAL_ERROR';
  }
  if (code === 'INTERNAL_ERROR' || res.headersSent) {
    console.error('Falha ao processar documento:', error);
  }
  if (res.headersSent) {
    return next(error);
  }
  const [status, message] = errors[code];
  res.status(status).json({ error: { code, message } });
}

module.exports = { validateOwner, receiveUpload, upload, list, download, handleError };
