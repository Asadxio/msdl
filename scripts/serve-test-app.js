// @ts-check
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8081;
const DIST_DIR = path.resolve(__dirname, '../frontend/dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveFilePath(urlPath) {
  const cleanPath = urlPath.split('?')[0].split('#')[0];
  let relativePath = decodeURIComponent(cleanPath).replace(/^\/+/, '');

  if (!relativePath || relativePath === '') {
    return path.join(DIST_DIR, 'index.html');
  }

  // 1. Direct file check
  let candidate = path.join(DIST_DIR, relativePath);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // 2. Append .html check
  candidate = path.join(DIST_DIR, relativePath + '.html');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // 3. (tabs)/ prefix check for tab routes
  candidate = path.join(DIST_DIR, '(tabs)', relativePath + '.html');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // 4. Directory index.html check
  candidate = path.join(DIST_DIR, relativePath, 'index.html');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // 5. Dynamic routes: check for [id].html
  const parts = relativePath.split('/');
  if (parts.length > 1) {
    const parentDir = parts.slice(0, -1).join('/');
    candidate = path.join(DIST_DIR, parentDir, '[id].html');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // 6. SPA fallback
  const fallback = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(fallback)) {
    return fallback;
  }

  return null;
}

const server = http.createServer((req, res) => {
  // Enable CORS for testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/_health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT }));
    return;
  }

  const filePath = resolveFilePath(req.url || '/');
  if (!filePath || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Playwright Test Server] Serving ${DIST_DIR} on http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
