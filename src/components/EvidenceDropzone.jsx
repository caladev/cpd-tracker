import React, { useRef, useState } from 'react'
import { UploadIcon, TrashIcon, EyeIcon, LinkIcon, FileIcon } from './Icons.jsx'
import { uploadFile, deleteFile, assetUrl } from '../api.js'

const isImage = (name) => /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(name)

function EvidenceItem({ ev, onRemove }) {
  const handleRemove = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove()
  }

  if (ev.kind === 'url') {
    return (
      <div className="ev-item">
        <LinkIcon width={15} height={15} />
        <a className="ev-value" href={ev.value} target="_blank" rel="noreferrer" title={ev.value}>
          {ev.value}
        </a>
        <button type="button" className="icon-btn icon-btn--danger" title="Remove" onClick={handleRemove}>
          <TrashIcon width={14} height={14} />
        </button>
      </div>
    )
  }
  return (
    <div className="ev-item">
      {isImage(ev.value) ? (
        <img className="ev-thumb" src={assetUrl(ev.value)} alt="evidence" />
      ) : (
        <FileIcon width={16} height={16} />
      )}
      <a className="ev-value" href={assetUrl(ev.value)} target="_blank" rel="noreferrer" title={ev.value}>
        <EyeIcon width={13} height={13} />
        {ev.filename || ev.value.split('/').pop()}
      </a>
      <button type="button" className="icon-btn icon-btn--danger" title="Remove" onClick={handleRemove}>
        <TrashIcon width={14} height={14} />
      </button>
    </div>
  )
}

export default function EvidenceDropzone({ entryId, evidence, onChange }) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const addFiles = async (files) => {
    setErr(null)
    const pics = Array.from(files)
    if (!pics.length) return
    setBusy(true)
    try {
      const added = []
      for (const file of pics) {
        const res = await uploadFile(file, 'evidence', entryId)
        added.push({ kind: 'file', value: res.value, filename: res.filename, size: res.size })
      }
      onChange([...evidence, ...added])
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (ev) => {
    if (ev.kind === 'file') {
      try {
        await deleteFile(ev.value)
      } catch {
        /* ignore missing */
      }
    }
    onChange(evidence.filter((x) => x !== ev))
  }

  return (
    <div className="ev-drop">
      <div
        className={`dropzone${drag ? ' dropzone--drag' : ''}${busy ? ' dropzone--busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon width={22} height={22} />
        <div className="drop-title">{busy ? 'Uploading…' : 'Drop evidence here'}</div>
        <div className="drop-sub">Images or PDFs · or click to browse</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="ev-list">
        {evidence.map((ev, i) => (
          <EvidenceItem key={i} ev={ev} onRemove={() => remove(ev)} />
        ))}
      </div>

      {err && <div className="field-err">{err}</div>}
    </div>
  )
}
