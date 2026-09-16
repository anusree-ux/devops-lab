import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function App() {
  const [files, setFiles] = useState([]);
  const [health, setHealth] = useState({ backend: 'checking', database: 'checking' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [fileResponse, healthResponse] = await Promise.all([fetch('/api/files'), fetch('/api/health')]);
      if (!fileResponse.ok) throw new Error('Unable to load files.');
      setFiles(await fileResponse.json());
      setHealth(await healthResponse.json());
    } catch (error) {
      setMessage(error.message);
      setHealth({ backend: 'down', database: 'down' });
    }
  };
  useEffect(() => { load(); }, []);

  const upload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setBusy(true); setMessage('');
    const form = new FormData(); form.append('file', file);
    try {
      const response = await fetch('/api/files', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed.');
      setFiles((current) => [result, ...current]);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); event.target.value = ''; }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this file?')) return;
    const response = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (response.ok) setFiles((current) => current.filter((file) => file.id !== id));
    else setMessage('Delete failed.');
  };

  return <main>
    <header><div><h1>File manager</h1><p>Simple local file storage</p></div>
      <label className="upload"><input type="file" onChange={upload} disabled={busy} />{busy ? 'Uploading…' : 'Upload file'}</label>
    </header>
    <section className="status"><span>Backend <b className={health.backend}>{health.backend}</b></span><span>PostgreSQL <b className={health.database}>{health.database}</b></span></section>
    {message && <p className="error">{message}</p>}
    <section className="files"><h2>{files.length} {files.length === 1 ? 'file' : 'files'}</h2>
      {files.length === 0 ? <p className="empty">No files uploaded yet.</p> : <ul>{files.map((file) => <li key={file.id}>
        <div><strong>{file.name}</strong><small>{formatSize(file.size)} · {new Date(file.createdAt).toLocaleString()}</small></div>
        <nav><a href={file.viewUrl} target="_blank" rel="noreferrer">View</a><a href={file.downloadUrl}>Download</a><button onClick={() => remove(file.id)}>Delete</button></nav>
      </li>)}</ul>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
