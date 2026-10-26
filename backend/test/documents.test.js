const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { execFileSync } = require('node:child_process');

const backendDir = path.resolve(__dirname, '..');

test('contratos HTTP dos documentos com armazenamento local', async (t) => {
  const fixtureDir = await fs.mkdtemp(path.join(backendDir, 'storage', 'test-'));
  const storageDir = path.join(fixtureDir, 'uploads');
  const originalStorage = process.env.STORAGE_DIR;
  const originalLimit = process.env.MAX_FILE_SIZE_BYTES;
  process.env.STORAGE_DIR = storageDir;
  process.env.MAX_FILE_SIZE_BYTES = '32';

  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    await fs.rm(fixtureDir, { recursive: true, force: true });
    if (originalStorage === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = originalStorage;
    if (originalLimit === undefined) delete process.env.MAX_FILE_SIZE_BYTES;
    else process.env.MAX_FILE_SIZE_BYTES = originalLimit;
  });
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  function request(route, owner = 'alice', options = {}) {
    return fetch(`${baseUrl}${route}`, {
      ...options,
      headers: {
        ...(owner === null ? {} : { 'X-User-Id': owner }),
        ...options.headers,
      },
    });
  }

  function uploadBody(content = 'conteudo', name = 'relatorio.txt', field = 'file') {
    const body = new FormData();
    body.append(field, new Blob([content]), name);
    return body;
  }

  async function expectError(response, status, code) {
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const payload = await response.json();
    assert.deepEqual(Object.keys(payload), ['error']);
    assert.deepEqual(Object.keys(payload.error).sort(), ['code', 'message']);
    assert.equal(payload.error.code, code);
    assert.equal(typeof payload.error.message, 'string');
    assert.ok(!JSON.stringify(payload).includes(fixtureDir));
  }

  let document;
  let storedFile;

  await t.test('preserva health e retorna lista vazia', async () => {
    assert.deepEqual(await (await request('/health', null)).json(), { status: 'ok' });
    assert.deepEqual(await (await request('/documents')).json(), []);
  });

  await t.test('exige usuário em todas as rotas antes de gravar', async () => {
    for (const owner of [null, '   ']) {
      await expectError(await request('/documents', owner), 400, 'BAD_REQUEST');
      await expectError(await request('/documents/id/download', owner), 400, 'BAD_REQUEST');
      await expectError(await request('/upload', owner, {
        method: 'POST', body: uploadBody(),
      }), 400, 'BAD_REQUEST');
    }
    assert.deepEqual(await fs.readdir(fixtureDir), []);
  });

  await t.test('grava bytes locais e retorna somente os metadados públicos', async () => {
    const response = await request('/upload', ' alice ', {
      method: 'POST', body: uploadBody(),
    });
    assert.equal(response.status, 201);
    document = await response.json();
    assert.deepEqual(Object.keys(document).sort(),
      ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.match(document.id, /^[0-9a-f-]{36}$/);
    assert.equal(document.originalName, 'relatorio.txt');
    assert.equal(document.owner, 'alice');
    assert.equal(document.size, Buffer.byteLength('conteudo'));
    assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
    const files = await fs.readdir(storageDir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^[0-9a-f-]{36}$/);
    assert.notEqual(files[0], document.originalName);
    storedFile = path.join(storageDir, files[0]);
    assert.equal(await fs.readFile(storedFile, 'utf8'), 'conteudo');
  });

  await t.test('lista por proprietário e baixa bytes com nome original', async () => {
    assert.deepEqual(await (await request('/documents')).json(), [document]);
    assert.deepEqual(await (await request('/documents', 'bob')).json(), []);
    const response = await request(`/documents/${document.id}/download`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /attachment; filename="relatorio.txt"/);
    assert.ok(response.headers.get('content-type'));
    assert.equal(await response.text(), 'conteudo');
  });

  await t.test('não revela documento de outro usuário ou IDs inválidos/inexistentes', async () => {
    await expectError(await request(`/documents/${document.id}/download`, 'bob'),
      404, 'NOT_FOUND');
    for (const id of ['invalido', randomUUID(), '..%2F..%2Fpackage.json']) {
      await expectError(await request(`/documents/${id}/download`), 404, 'NOT_FOUND');
    }
  });

  await t.test('rejeita uploads inválidos sem deixar arquivos ou metadados', async () => {
    const filesBefore = await fs.readdir(storageDir);
    const cases = [
      { body: new FormData() },
      { body: uploadBody('') },
      { body: uploadBody('conteudo', 'outro.txt', 'document') },
      { body: 'texto', headers: { 'Content-Type': 'text/plain' } },
      { body: 'invalid', headers: { 'Content-Type': 'multipart/form-data' } },
      { body: '--broken', headers: { 'Content-Type': 'multipart/form-data; boundary=broken' } },
      {
        body: '--broken\r\nContent-Disposition: form-data; name="file"; filename="a.txt"'
          + '\r\nContent-Type: text/plain\r\n\r\nincompleto',
        headers: { 'Content-Type': 'multipart/form-data; boundary=broken' },
      },
    ];
    const multiple = uploadBody();
    multiple.append('file', new Blob(['segundo']), 'segundo.txt');
    cases.push({ body: multiple });

    for (const options of cases) {
      await expectError(await request('/upload', 'alice', {
        method: 'POST', ...options,
      }), 400, 'BAD_REQUEST');
      assert.deepEqual(await fs.readdir(storageDir), filesBefore);
      assert.deepEqual(await (await request('/documents')).json(), [document]);
    }
  });

  await t.test('aceita exatamente o limite e rejeita um byte acima', async () => {
    const response = await request('/upload', 'alice', {
      method: 'POST', body: uploadBody(Buffer.alloc(32), 'limite.bin'),
    });
    assert.equal(response.status, 201);
    const atLimit = await response.json();
    assert.equal(atLimit.size, 32);
    const download = await request(`/documents/${atLimit.id}/download`);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), Buffer.alloc(32));
    const filesBefore = await fs.readdir(storageDir);
    await expectError(await request('/upload', 'alice', {
      method: 'POST', body: uploadBody(Buffer.alloc(33)),
    }), 413, 'FILE_TOO_LARGE');
    assert.deepEqual(await fs.readdir(storageDir), filesBefore);
    const listed = await (await request('/documents')).json();
    assert.deepEqual(listed, [atLimit, document].sort((first, second) =>
      second.uploadedAt.localeCompare(first.uploadedAt) || first.id.localeCompare(second.id)));
  });

  await t.test('retorna 404 quando o arquivo físico não está mais disponível', async () => {
    await fs.unlink(storedFile);
    await expectError(await request(`/documents/${document.id}/download`), 404, 'NOT_FOUND');
  });

  await t.test('falha de gravação retorna 500 seguro e é registrada', async () => {
    const movedDir = path.join(fixtureDir, 'saved-uploads');
    await fs.rename(storageDir, movedDir);
    await fs.writeFile(storageDir, 'não é um diretório');
    const logs = [];
    t.mock.method(console, 'error', (...args) => logs.push(args));
    try {
      await expectError(await request('/upload', 'alice', {
        method: 'POST', body: uploadBody(),
      }), 500, 'INTERNAL_ERROR');
      assert.equal(logs.length, 1);
      assert.equal((await (await request('/documents')).json()).length, 2);
    } finally {
      t.mock.restoreAll();
      await fs.unlink(storageDir);
      await fs.rename(movedDir, storageDir);
    }
  });

  await t.test('retorna JSON para corpo JSON malformado', async () => {
    await expectError(await request('/upload', 'alice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    }), 400, 'BAD_REQUEST');
  });

  await t.test('preserva nomes Unicode e não sobrescreve arquivos com nomes iguais', async () => {
    const documents = [];
    for (const content of ['primeiro', 'segundo']) {
      const response = await request('/upload', 'unicode', {
        method: 'POST', body: uploadBody(content, 'relatório-€.txt'),
      });
      assert.equal(response.status, 201);
      const uploaded = await response.json();
      assert.equal(uploaded.originalName, 'relatório-€.txt');
      documents.push(uploaded);
      const download = await request(`/documents/${uploaded.id}/download`, 'unicode');
      assert.equal(download.status, 200);
      assert.match(download.headers.get('content-disposition'),
        /filename\*=UTF-8''relat%C3%B3rio-%E2%82%AC.txt/);
      assert.equal(await download.text(), content);
    }
    assert.notEqual(documents[0].id, documents[1].id);
    assert.equal(await (await request(`/documents/${documents[0].id}/download`, 'unicode')).text(),
      'primeiro');
  });

  await t.test('reiniciar o processo não recupera metadados do filesystem', () => {
    const output = execFileSync(process.execPath, ['-e',
      "console.log(JSON.stringify(require('./src/services/documents.service').list('alice')))"],
    { cwd: backendDir, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), []);
  });
});

test('ordena metadados por data decrescente e desempata por identificador', () => {
  const repository = require('../src/repositories/documents.repository');
  const service = require('../src/services/documents.service');
  const owner = 'ordering-test';
  for (const [id, uploadedAt] of [
    ['b', '2026-10-26T12:00:00.000Z'],
    ['c', '2026-10-25T12:00:00.000Z'],
    ['a', '2026-10-26T12:00:00.000Z'],
  ]) {
    repository.save({ id, uploadedAt, owner, path: '/internal', originalName: 'a.txt', size: 1 });
  }
  assert.deepEqual(service.list(owner).map((document) => document.id), ['a', 'b', 'c']);
  assert.ok(service.list(owner).every((document) => !Object.hasOwn(document, 'path')));
});

test('configuração usa caminhos relativos ao backend e valida limite', () => {
  const script = "console.log(JSON.stringify(require('./backend/src/config')))";
  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: path.dirname(backendDir),
    env: { ...process.env, STORAGE_DIR: 'storage/custom', MAX_FILE_SIZE_BYTES: '64' },
    encoding: 'utf8',
  });
  assert.deepEqual(JSON.parse(output), {
    storageDir: path.join(backendDir, 'storage/custom'),
    maxFileSizeBytes: 64,
  });
  for (const limit of ['0', '-1', 'abc', '1.5', 'Infinity']) {
    assert.throws(() => execFileSync(process.execPath, ['-e', script], {
      cwd: path.dirname(backendDir),
      env: { ...process.env, MAX_FILE_SIZE_BYTES: limit },
      stdio: 'pipe',
    }), /MAX_FILE_SIZE_BYTES/);
  }
});
