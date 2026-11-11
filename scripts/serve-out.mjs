// Serve out/ locally the way Vercel does for this site: trailing-slash directories, gzip, and the vercel.json headers.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT = path.resolve('out')
const PORT = Number(process.env.PORT ?? 4321)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain' }
const headers = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers.find(h => h.source === '/(.*)').headers

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  let file = path.join(OUT, decodeURIComponent(url.pathname))
  if (!file.startsWith(OUT)) { res.writeHead(400).end(); return }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
  let status = 200
  if (!fs.existsSync(file)) { file = path.join(OUT, '404.html'); status = 404 }
  const body = fs.readFileSync(file)
  const h = { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }
  for (const { key, value } of headers) h[key] = value
  if (/\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    h['Content-Encoding'] = 'gzip'
    res.writeHead(status, h).end(zlib.gzipSync(body))
  }
  else res.writeHead(status, h).end(body)
}).listen(PORT, () => console.log(`serving out/ on http://localhost:${PORT}`))
