async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, options)
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.json()
}

export function getInfo() {
  return request('/info')
}

export function getData() {
  return request('/data')
}

export function saveData(data) {
  return request('/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function uploadFile(file, dest, key) {
  const form = new FormData()
  form.append('file', file)
  form.append('dest', dest)
  form.append('key', key)
  return request('/upload', { method: 'POST', body: form })
}

export function deleteFile(pathValue) {
  return request(`/file?path=${encodeURIComponent(pathValue)}`, { method: 'DELETE' })
}

export function assetUrl(pathValue) {
  return `/api/file?path=${encodeURIComponent(pathValue)}`
}