const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const APP_SECRET = 'bd0978603fb74aa5ac5e0c24d76a206333060cb910c5424e8ce173c9743b0dcd';
const XOR_KEY = Buffer.from('7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c', 'ascii');
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

function xorEncode(buf) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ XOR_KEY[i % XOR_KEY.length];
  return out;
}

function xorDecode(buf) {
  return xorEncode(buf);
}

function relayToOriginal(body, cb) {
  const postData = Buffer.from(body, 'utf8');
  const req = https.request({
    hostname: 'spacex.emerite.store',
    path: '/api/v1/software/init',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
      'X-Emerite-Sig': 'true'
    }
  }, function (res) {
    let data = '';
    res.on('data', function (c) { data += c; });
    res.on('end', function () {
      cb(null, res.statusCode, data);
    });
  });
  req.on('error', function (e) { cb(e); });
  req.write(postData);
  req.end();
}

function tryDecode(s) {
  let out = '';
  try {
    out = xorDecode(Buffer.from(s, 'base64')).toString('utf8');
    JSON.parse(out);
  } catch (e) {
    return null;
  }
  return out;
}

function sendEncoded(res, obj) {
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(xorEncode(plain).toString('base64'));
}

function logReq(rec) {
  try {
    fs.appendFileSync(path.join(ROOT, 'debug.jsonl'), JSON.stringify(rec) + '\n');
  } catch (e) {}
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/debug/last' && req.method === 'GET') {
    let dump = '';
    try {
      const lines = fs.readFileSync(path.join(ROOT, 'debug.jsonl'), 'utf8').trim().split('\n');
      dump = lines.slice(-30).join('\n');
    } catch (e) {}
    fs.appendFileSync(path.join(ROOT, 'debug.jsonl'), JSON.stringify({ t: new Date().toISOString(), m: 'GET', u: '/debug/last', ip: req.socket.remoteAddress }) + '\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(dump || '(no requests captured yet)');
    return;
  }

  if ((urlPath === '/api/v1/software/init' || urlPath === '/api/v1/soft/init') && req.method === 'POST') {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      let data = {};
      try { data = JSON.parse(body); } catch (e) { console.log('[init] raw body not json, trying decode'); }
      if (!data || !data.app_secret) {
        try {
          const decoded = JSON.parse(xorDecode(Buffer.from(body, 'base64')).toString('utf8'));
          data = decoded;
        } catch (e2) {
          console.log('[init] decode failed too: ' + e2.message);
        }
      }
      console.log('[init] sig: ' + (req.headers['x-emerite-sig'] || 'missing'));
      console.log('[init] decoded body: ' + JSON.stringify(data));
      logReq({ t: new Date().toISOString(), m: req.method, u: urlPath, ip: req.socket.remoteAddress, sig: req.headers['x-emerite-sig'] || '', body: body, decoded: data });

      relayToOriginal(body, function (err, statusCode, upstream) {
        if (!err && upstream) {
          const decoded = tryDecode(upstream);
          console.log('[relay] upstream status: ' + statusCode);
          console.log('[relay] upstream raw: ' + upstream.slice(0, 400));
          console.log('[relay] upstream decoded: ' + (decoded || '(not xored json)'));
          logReq({ t: new Date().toISOString(), m: 'RELAY', u: '/upstream', status: statusCode, body: body, response: upstream, decodedResponse: decoded || '' });
          res.writeHead(statusCode || 200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(upstream);
          return;
        }
        console.log('[relay] failed: ' + (err ? err.message : 'no upstream'));
        sendEncoded(res, {
          success: true,
          message: 'Initialized successfully',
          version: '1.0',
          min_version: '1.0',
          status: 'online',
          is_maintenance: false,
          maintenance_message: '',
          update_required: false,
          download_url: ''
        });
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