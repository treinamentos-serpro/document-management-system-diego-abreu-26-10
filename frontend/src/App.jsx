import { useState } from 'react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';

export default function App() {
  const [userId, setUserId] = useState('');
  const [revision, setRevision] = useState(0);

  function selectUser(event) {
    event.preventDefault();
    setUserId(new FormData(event.currentTarget).get('userId').trim());
    refreshDocuments();
  }

  function refreshDocuments() {
    setRevision((value) => value + 1);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Document Management System</h1>
      <p>Envie, consulte e baixe seus documentos.</p>
      <form onSubmit={selectUser}>
        <label htmlFor="user-id">Identificador do usuário</label>{' '}
        <input id="user-id" name="userId" required pattern=".*\S.*" />{' '}
        <button type="submit">Carregar documentos</button>
      </form>
      <p>Identificação de demonstração: não substitui autenticação.</p>
      {userId && (
        <div key={userId}>
          <p>Usuário selecionado: <strong>{userId}</strong></p>
          <UploadComponent userId={userId} onUploaded={refreshDocuments} />
          <DocumentList
            userId={userId}
            revision={revision}
            onRefresh={refreshDocuments}
          />
        </div>
      )}
    </main>
  );
}
