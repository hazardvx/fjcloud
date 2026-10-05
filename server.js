const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const INLINE_SCRIPT = "document.documentElement.classList.add('js')";
const SCRIPT_HASH = "'sha256-" + crypto.createHash('sha256').update(INLINE_SCRIPT, 'utf8').digest('base64') + "'";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "script-src 'self' " + SCRIPT_HASH,
  "connect-src 'self'",
  "manifest-src 'self'"
].join('; ');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function baseHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': CSP
  };
}

function cacheHeader(urlPath) {
  if (urlPath === '/' || urlPath.endsWith('.html') || urlPath === '/sw.js' || urlPath === '/manifest.json') {
    return 'no-cache';
  }
  if (/^\/(js|fonts|icons)\//.test(urlPath)) {
    return 'max-age=60, stale-while-revalidate=86400';
  }
  return 'no-cache';
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    const headers = baseHeaders();
    headers['Cache-Control'] = cacheHeader(urlPath);
    if (err) {
      headers['Content-Type'] = 'text/html; charset=utf-8';
      res.writeHead(404, headers);
      res.end('<!DOCTYPE html><html lang="es"><meta charset="utf-8"><title>404</title><body style="font-family:system-ui;padding:60px;text-align:center"><h1>404 — Página no encontrada</h1><p><a href="/">Volver al inicio</a></p></body></html>');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    headers['Content-Type'] = TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('FJcloud.app dev server → http://127.0.0.1:' + PORT);
});
