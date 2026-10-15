const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const port = Number(process.env.PORT || 3000);
const projectUrl = process.env.SUPABASE_URL || 'https://bapvqzcwofbbmtipmtbc.supabase.co';
const root = process.env.NODE_ENV === 'production' ? path.join(__dirname, 'dist') : __dirname;
const sourceRoot = __dirname;
const maxBodyBytes = 256 * 1024;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(message);
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function secureCookieFlags(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const isHttps = forwarded === 'https' || String(req.headers.host || '').includes('manus.computer');
  return isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
}

function createSessionToken() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  const issuedAt = Date.now();
  const payload = `${issuedAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function isValidSession(req) {
  const secret = process.env.ADMIN_PASSWORD;
  const token = parseCookies(req).freshers_admin;
  if (!secret || !token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [issuedAt, signature] = decoded.split('.');
    if (!issuedAt || !signature || Date.now() - Number(issuedAt) > 8 * 60 * 60 * 1000) return false;
    const expected = crypto.createHmac('sha256', secret).update(issuedAt).digest('base64url');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireAdmin(req, res) {
  if (isValidSession(req)) return true;
  sendJson(res, 401, { ok: false, error: 'Admin login required.' });
  return false;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function digits(value) {
  return clean(value).replace(/\D/g, '');
}

function validConsent(value) {
  return value === true || value === 'Accepted' || value === 'on' || value === 'true';
}

function mapContestant(data) {
  const row = {
    full_name: clean(data.fullName, 60),
    roll_number: clean(data.rollNumber, 40),
    category: clean(data.category, 30),
    year: clean(data.year, 20),
    phone: clean(data.phone, 30),
    consent: validConsent(data.consent)
  };
  if (row.full_name.length < 2 || row.roll_number.length < 1 || !['Mr Freshers', 'Miss Freshers'].includes(row.category) || row.year !== '2nd year' || digits(row.phone).length !== 10 || !row.consent) {
    throw new Error('Please provide a valid second-year contestant entry.');
  }
  return row;
}

function mapPerformance(data) {
  const row = {
    performance_name: clean(data.performanceName, 60),
    lead_name: clean(data.leadName, 60),
    phone: clean(data.phone, 30),
    member_count: Number(data.memberCount),
    member_names: clean(data.memberNames, 1000),
    performance_type: clean(data.performanceType, 60),
    duration: Number(data.duration),
    description: clean(data.description, 200),
    needs: clean(data.needs, 200),
    lead_branch_year: clean(data.leadBranchYear, 100),
    consent: validConsent(data.consent)
  };
  const memberLines = row.member_names.split('\n').map((line) => line.trim()).filter(Boolean);
  if (row.performance_name.length < 2 || row.lead_name.length < 2 || digits(row.phone).length !== 10 || row.member_count < 1 || row.member_count > 15 || (row.member_count > 1 && memberLines.length < row.member_count) || !row.performance_type || row.duration < 1 || row.duration > 5 || !row.lead_branch_year || !row.consent) {
    throw new Error('Please complete the performance entry with valid details.');
  }
  return row;
}

async function supabaseRequest(endpoint, options = {}) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Database service key is not configured.');
  const response = await fetch(`${projectUrl}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = Array.isArray(body) ? body[0]?.message : body?.message || body?.hint;
    throw new Error(detail || `Supabase request failed (${response.status}).`);
  }
  return body;
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, databaseConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), adminConfigured: Boolean(process.env.ADMIN_PASSWORD) });
  }

  if (pathname === '/api/registrations' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      const type = body.type === 'contest' ? 'contest' : body.type === 'performance' ? 'performance' : null;
      if (!type) return sendJson(res, 400, { ok: false, error: 'Unknown registration type.' });
      const row = type === 'contest' ? mapContestant(body.data || {}) : mapPerformance(body.data || {});
      const table = type === 'contest' ? 'contestant_registrations' : 'performance_registrations';
      const created = await supabaseRequest(table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
      const first = Array.isArray(created) ? created[0] : created;
      return sendJson(res, 201, { ok: true, id: first?.id, created_at: first?.created_at });
    } catch (error) {
      const status = /configured|service key/i.test(error.message) ? 503 : /valid|complete/i.test(error.message) ? 400 : 502;
      return sendJson(res, status, { ok: false, error: error.message });
    }
  }

  if (pathname === '/api/admin/session' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, authenticated: isValidSession(req) });
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      const password = String(body.password || '');
      const expected = process.env.ADMIN_PASSWORD || '';
      const matches = password.length === expected.length && expected.length > 0 && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
      if (!matches) return sendJson(res, 401, { ok: false, error: 'That password did not match.' });
      const token = createSessionToken();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': `freshers_admin=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly; ${secureCookieFlags(req)}` });
      return res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': `freshers_admin=; Path=/; Max-Age=0; HttpOnly; ${secureCookieFlags(req)}` });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (pathname === '/api/admin/registrations' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      const [contestants, performances] = await Promise.all([
        supabaseRequest('contestant_registrations?select=*&order=created_at.desc&limit=500'),
        supabaseRequest('performance_registrations?select=*&order=created_at.desc&limit=500')
      ]);
      return sendJson(res, 200, { ok: true, contestants: contestants || [], performances: performances || [] });
    } catch (error) {
      return sendJson(res, 503, { ok: false, error: error.message });
    }
  }

  const updateMatch = pathname.match(/^\/api\/admin\/registrations\/(contestant|performance)\/([0-9a-f-]+)$/i);
  if (updateMatch && req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJson(req);
      const status = ['new', 'shortlisted', 'confirmed', 'rejected'].includes(body.status) ? body.status : null;
      if (!status) return sendJson(res, 400, { ok: false, error: 'Invalid registration status.' });
      const table = updateMatch[1].toLowerCase() === 'contestant' ? 'contestant_registrations' : 'performance_registrations';
      await supabaseRequest(`${table}?id=eq.${encodeURIComponent(updateMatch[2])}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status, admin_notes: clean(body.admin_notes, 1000) }) });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 503, { ok: false, error: error.message });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'API route not found.' });
}

function staticPath(pathname) {
  if (pathname === '/admin' || pathname === '/admin/') return path.join(root, 'admin.html');
  if (pathname === '/manus-routes.json') {
    const built = path.join(root, 'manus-routes.json');
    return fs.existsSync(built) ? built : path.join(sourceRoot, 'public', 'manus-routes.json');
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  return path.resolve(root, relative);
}

async function handleRequest(req, res) {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
  const filePath = staticPath(pathname);
  if (!filePath.startsWith(root) && !filePath.startsWith(sourceRoot)) return sendText(res, 403, 'Forbidden');
  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (pathname !== '/' && !path.extname(pathname)) {
        const fallback = path.join(root, 'index.html');
        fs.readFile(fallback, (fallbackError, fallbackData) => {
          if (fallbackError) return sendText(res, 500, 'Server error');
          res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-cache' });
          return res.end(fallbackData);
        });
        return;
      }
      return sendText(res, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Unexpected server error.' });
    console.error(error);
  });
});

server.listen(port, '0.0.0.0', () => console.log(`Freshers site listening on http://0.0.0.0:${port}`));
