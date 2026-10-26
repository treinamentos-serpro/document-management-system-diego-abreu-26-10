import { useState } from 'react';
import { uploadDocument } from '../services/api.js';

export default function UploadComponent({ userId, onUploaded }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get('file');
    setIsUploading(true);
    setError('');
    setMessage('');
    try {
      const document = await uploadDocument(file, userId);
      form.reset();
      setMessage(`Documento "${document.originalName}" enviado com sucesso.`);
      onUploaded();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section aria-labelledby="upload-heading">
      <h2 id="upload-heading">Enviar documento</h2>
      <form onSubmit={handleSubmit} aria-busy={isUploading}>
        <label htmlFor="document-file">Arquivo</label>{' '}
        <input id="document-file" name="file" type="file" required disabled={isUploading} />{' '}
        <button type="submit" disabled={isUploading}>
          {isUploading ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
