import { useEffect, useState } from 'react';
import { listDocuments } from '../services/api.js';
import DownloadButton from './DownloadButton.jsx';

export default function DocumentList({ userId, revision, onRefresh }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    setDocuments([]);

    async function loadDocuments() {
      try {
        const items = await listDocuments(userId, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setDocuments(items);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadDocuments();
    return () => controller.abort();
  }, [userId, revision]);

  return (
    <section aria-labelledby="documents-heading">
      <h2 id="documents-heading">Meus documentos</h2>
      <button type="button" onClick={onRefresh} disabled={isLoading}>Atualizar lista</button>
      {isLoading && <p role="status">Carregando documentos…</p>}
      {error && <p role="alert">{error}</p>}
      {!isLoading && !error && (
        documents.length === 0 ? <p>Nenhum documento encontrado.</p> : (
          <ul>
            {documents.map((document) => (
              <li key={document.id}>
                <strong>{document.originalName}</strong>
                {' — '}{document.size.toLocaleString('pt-BR')} bytes
                {' — '}
                <time dateTime={document.uploadedAt}>
                  {new Date(document.uploadedAt).toLocaleString('pt-BR')}
                </time>{' '}
                <DownloadButton document={document} userId={userId} />
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
