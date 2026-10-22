// External requests (Google Fonts, CDNs …) are never sent by Chromium directly
// (the sandbox has no direct internet, and requests to local servers must not
// go through the proxy). Instead they are routed here:
//   NET=cache   (default) fetch once with curl (honours HTTPS_PROXY), cache in tests/.netcache
//   NET=offline abort every non-local request (simulates the iPad without internet)
const { execFile } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CACHE = path.join(__dirname, '..', '.netcache');
const UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const inflight = new Map();

const isLocal = (u) => /^(data:|blob:|about:)/.test(u) || /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//.test(u);

function curl(url, file) {
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '-L', '-m', '20', '-A', UA, '-o', file, '-D', file + '.h', '-w', '%{http_code} %{content_type}', url],
      (err, stdout) => {
        if (err) return resolve(null);
        const [status, ...ct] = stdout.trim().split(' ');
        const meta = { status: Number(status), contentType: ct.join(' ') || 'application/octet-stream' };
        fs.writeFileSync(file + '.json', JSON.stringify(meta));
        resolve(meta);
      });
  });
}

async function fetchCached(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex'));
  if (fs.existsSync(file + '.json')) return { ...JSON.parse(fs.readFileSync(file + '.json', 'utf8')), file };
  if (!inflight.has(url)) inflight.set(url, curl(url, file));
  const meta = await inflight.get(url);
  return meta ? { ...meta, file } : null;
}

async function installNetwork(context, mode = process.env.NET || 'cache') {
  const external = [];
  await context.route((u) => !isLocal(u.toString()), async (route) => {
    const url = route.request().url();
    external.push(url);
    if (mode === 'offline') return route.abort('internetdisconnected');
    const r = await fetchCached(url);
    if (!r || r.status >= 400) return route.abort('failed');
    return route.fulfill({ status: r.status, contentType: r.contentType, body: fs.readFileSync(r.file),
      headers: { 'access-control-allow-origin': '*' } });
  });
  return external;
}

module.exports = { installNetwork, isLocal };
