const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const APP_SECRET = 'fluorite';
const MIN_VERSION = '1.85';
const LATEST_VERSION = '1.85';
const DOWNLOAD_LINK = 'https://fultonew-2.onrender.com/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function json(res, obj, code) {
  res.writeHead(code || 200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function fail(res, message) {
  json(res, { status: 'error', message: message, is_banned: false, ban_reason: '' });
}

function fmt(d) {
  const p = function (n) { return String(n).padStart(2, '0'); };
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if ((urlPath === '/api/v1/software/init' || urlPath === '/api/v1/soft/init') && req.method === 'POST') {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let data = {};
      try { data = JSON.parse(body); } catch (e) { console.log('[init] bad body: ' + body); }
      console.log('[init] sig: ' + (req.headers['x-emerite-sig'] || 'missing'));
      console.log('[init] body: ' + body);

      const key = data.license_key || data.key || '';
      if (!key) return fail(res, 'key not found.');

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);

      json(res, {
        status: 'ok',
        message: 'Auth Success! Plan: MONTH | Expiry: ' + fmt(expiry),
        plan: 'MONTH',
        expiry: expiry.toISOString(),
        expiry_formatted: fmt(expiry),
        is_banned: false,
        ban_reason: '',
        required_min_version: MIN_VERSION,
        latest_version: LATEST_VERSION,
        download_package_url: DOWNLOAD_LINK,
        hwid: data.hwid || ''
      });
    });
    return;
  }

  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, function () {
  console.log('Fluorite Server running on port ' + PORT);
});