const API_PREFIX = '/api';

async function request(path, userId, options = {}) {
  const owner = userId?.trim();
  if (!owner) {
    throw new Error('Informe o identificador do usuário.');
  }

  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...options,
      headers: { 'X-User-Id': owner },
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.', { cause: error });
  }

  if (!response.ok) {
    let message = `Não foi possível concluir a operação (HTTP ${response.status}).`;
    if (response.headers.get('Content-Type')?.includes('application/json')) {
      const body = await readJson(response);
      if (typeof body?.error?.message === 'string' && body.error.message.trim()) {
        message = body.error.message;
      }
    }
    throw new Error(message);
  }
  return response;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new Error('O servidor retornou uma resposta inválida.', { cause: error });
  }
}

export async function listDocuments(userId, { signal } = {}) {
  const response = await request('/documents', userId, { signal });
  return readJson(response);
}

export async function uploadDocument(file, userId) {
  if (!file || file.size === 0) {
    throw new Error('Selecione um arquivo não vazio.');
  }
  const body = new FormData();
  body.append('file', file);
  const response = await request('/upload', userId, { method: 'POST', body });
  return readJson(response);
}

export async function downloadDocument(id, userId) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`, userId);
  try {
    return await response.blob();
  } catch (error) {
    throw new Error('Não foi possível receber o arquivo. Tente novamente.', { cause: error });
  }
}
