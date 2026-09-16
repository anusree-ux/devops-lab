import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const fmtSize = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`

function App() {
  const [files, setFiles] = useState([])
  const [health, setHealth] = useState('checking')
  const [db, setDb] = useState('checking')
  const [message, setMessage] = useState('')
  const load = async () => {
    try {
      const [list, h, d] = await Promise.all([fetch('/api/files'), fetch('/api/health'), fetch('/api/db-status')])
      setFiles(await list.json()); setHealth(h.ok ? 'ok' : 'error'); setDb(d.ok ? 'ok' : 'error')
    } catch { setHealth('error'); setDb('error'); setMessage('Backend is unavailable') }
  }
  useEffect(() => { load() }, [])
  const upload = async e => {
    const file = e.target.files[0]; if (!file) return
    const body = new FormData(); body.append('file', file); setMessage('Uploading…')
    const res = await fetch('/api/files', { method: 'POST', body })
    setMessage(res.ok ? 'Upload complete' : (await res.json()).error || 'Upload failed'); e.target.value = ''; load()
  }
  const remove = async id => { if (!confirm('Delete this file?')) return; const res = await fetch(`/api/files/${id}`, { method: 'DELETE' }); setMessage(res.ok ? 'File deleted' : 'Delete failed'); load() }
  return <main><header><h1>File manager</h1><div className="status">Backend: <b className={health}>{health}</b> · MySQL: <b className={db}>{db}</b></div></header>
    <section className="toolbar"><label className="button">Upload file<input type="file" onChange={upload} /></label>{message && <span>{message}</span>}</section>
    <section className="card">{files.length === 0 ? <p className="empty">No files uploaded yet.</p> : <table><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th /></tr></thead><tbody>{files.map(f => <tr key={f.id}><td>{f.name}</td><td>{f.mimeType}</td><td>{fmtSize(f.size)}</td><td>{new Date(f.uploadedAt).toLocaleString()}</td><td className="actions"><a href={f.viewUrl} target="_blank">View</a><a href={f.downloadUrl}>Download</a><button onClick={() => remove(f.id)}>Delete</button></td></tr>)}</tbody></table>}</section>
  </main>
}
createRoot(document.getElementById('root')).render(<App />)
