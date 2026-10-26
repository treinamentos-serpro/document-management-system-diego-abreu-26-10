import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/api.js';

test('listagem usa /api, identifica o usuário e encaminha cancelamento', async (t) => {
  const documents = [{ id: 'document-1', originalName: 'relatório.txt' }];
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(documents));

  assert.deepEqual(await listDocuments(' usuario-123 ', { signal: controller.signal }), documents);
  assert.deepEqual(fetch.mock.calls[0].arguments, [
    '/api/documents',
    { headers: { 'X-User-Id': 'usuario-123' }, signal: controller.signal },
  ]);
});

test('upload envia um arquivo no campo file sem fixar Content-Type', async (t) => {
  const document = { id: 'document-1', originalName: 'relatório.txt' };
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(document, { status: 201 }));
  const file = new File(['conteúdo'], document.originalName);

  assert.deepEqual(await uploadDocument(file, 'usuario-123'), document);
  const [path, options] = fetch.mock.calls[0].arguments;
  assert.equal(path, '/api/upload');
  assert.equal(options.method, 'POST');
  assert.deepEqual(options.headers, { 'X-User-Id': 'usuario-123' });
  assert.deepEqual([...options.body.keys()], ['file']);
  assert.equal(options.body.get('file').name, file.name);
  assert.equal(await options.body.get('file').text(), 'conteúdo');
});

test('download usa fetch autenticado pela identidade de demonstração e retorna bytes', async (t) => {
  const bytes = new Uint8Array([0, 255, 42]);
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(bytes));

  const blob = await downloadDocument('id/ especial', 'usuario-123');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  assert.deepEqual(fetch.mock.calls[0].arguments, [
    '/api/documents/id%2F%20especial/download',
    { headers: { 'X-User-Id': 'usuario-123' } },
  ]);
});

test('rejeita usuário ausente e arquivo vazio antes de enviar requisição', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  await assert.rejects(listDocuments('   '), /identificador do usuário/);
  await assert.rejects(uploadDocument(null, 'usuario-123'), /arquivo não vazio/);
  await assert.rejects(uploadDocument(new File([], 'vazio.txt'), 'usuario-123'), /arquivo não vazio/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('expõe erros JSON do backend em todas as operações', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(
    { error: { code: 'NOT_FOUND', message: 'Documento não encontrado.' } },
    { status: 404 },
  ));
  await assert.rejects(listDocuments('usuario-123'), /Documento não encontrado/);
  await assert.rejects(uploadDocument(new File(['a'], 'a.txt'), 'usuario-123'), /Documento não encontrado/);
  await assert.rejects(downloadDocument('id', 'usuario-123'), /Documento não encontrado/);
});

test('informa status HTTP quando proxy retorna erro não JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Bad gateway', { status: 502 }));
  await assert.rejects(listDocuments('usuario-123'), /HTTP 502/);
});

test('informa resposta JSON inválida explicitamente', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('inválido', {
    headers: { 'Content-Type': 'application/json' },
  }));
  await assert.rejects(listDocuments('usuario-123'), /resposta inválida/);
});

test('informa status HTTP quando erro JSON não contém uma mensagem válida', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(null, { status: 500 }));
  await assert.rejects(listDocuments('usuario-123'), /HTTP 500/);
});

test('informa falha ao receber os bytes do download', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) {
      controller.error(new Error('Conexão interrompida'));
    },
  })));
  await assert.rejects(downloadDocument('id', 'usuario-123'), /receber o arquivo/);
});

test('traduz falha de rede e preserva cancelamento', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(listDocuments('usuario-123'), /conectar ao servidor/);
  const aborted = new DOMException('Cancelado', 'AbortError');
  fetch.mock.mockImplementation(async () => { throw aborted; });
  await assert.rejects(listDocuments('usuario-123'), (error) => error === aborted);
});
