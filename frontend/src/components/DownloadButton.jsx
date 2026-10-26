import { useState } from 'react';
import { downloadDocument } from '../services/api.js';

export default function DownloadButton({ document: item, userId }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleDownload() {
    setIsDownloading(true);
    setError('');
    setMessage('');
    try {
      const blob = await downloadDocument(item.id, userId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = item.originalName;
        document.body.append(link);
        link.click();
      } finally {
        link.remove();
        // Aguarda o navegador iniciar o download antes de liberar o recurso.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage('Download iniciado.');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        aria-label={`Baixar ${item.originalName}`}
      >
        {isDownloading ? 'Baixando…' : 'Baixar'}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </>
  );
}
