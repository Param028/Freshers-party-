const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const normalizeCrewPhone = require('./contact-phone');

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
  if (req.body !== undefined) {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
      const serialized = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {});
      if (Buffer.byteLength(serialized) > maxBodyBytes) return Promise.reject(new Error('Request body too large.'));
      return Promise.resolve(typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : rawBody);
    } catch (error) {
      return Promise.reject(error.message === 'Request body too large.' ? error : new Error('Invalid JSON.'));
    }
  }
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

function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
  if (row.performance_name.length < 2 || row.lead_name.length < 2 || digits(row.phone).length !== 10 || row.member_count < 1 || row.member_count > 15 || (row.member_count > 1 && memberLines.length < row.member_count) || !row.performance_type || row.duration < 1 || row.duration > 5 || row.lead_branch_year !== 'Data Science / 1st year' || !row.consent) {
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

async function getEventVenue() {
  const rows = await supabaseRequest('event_settings?select=venue&setting_key=eq.global&limit=1');
  const row = Array.isArray(rows) ? rows[0] : rows;
  return clean(row?.venue, 120) || 'TO BE ANNOUNCED';
}

function mapEventContact(data) {
  if (!isJsonObject(data)) throw new Error('Please provide a valid crew contact.');
  const phone = normalizeCrewPhone(data.phone);
  const contact = {
    name: clean(data.name, 60),
    role: clean(data.role, 60),
    phone
  };
  if (contact.name.length < 2 || contact.role.length < 2 || !contact.phone) {
    throw new Error('Please provide a valid crew contact.');
  }
  return contact;
}

async function getEventContacts() {
  const rows = await supabaseRequest('event_contacts?select=id,name,role,phone,sort_order&order=sort_order.asc,created_at.asc&limit=100');
  return Array.isArray(rows) ? rows : [];
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, databaseConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), adminConfigured: Boolean(process.env.ADMIN_PASSWORD) });
  }

  if (pathname === '/api/event-settings' && req.method === 'GET') {
    try {
      return sendJson(res, 200, { ok: true, venue: await getEventVenue() });
    } catch {
      return sendJson(res, 503, { ok: false, error: 'Event location is temporarily unavailable.' });
    }
  }

  if (pathname === '/api/event-contacts' && req.method === 'GET') {
    try {
      return sendJson(res, 200, { ok: true, contacts: await getEventContacts() });
    } catch {
      return sendJson(res, 503, { ok: false, error: 'Crew contacts are temporarily unavailable.' });
    }
  }

  if (pathname === '/api/registrations' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (!isJsonObject(body)) return sendJson(res, 400, { ok: false, error: 'A valid registration object is required.' });
      const type = body.type === 'contest' ? 'contest' : body.type === 'performance' ? 'performance' : null;
      if (!type) return sendJson(res, 400, { ok: false, error: 'Unknown registration type.' });
      const row = type === 'contest' ? mapContestant(body.data || {}) : mapPerformance(body.data || {});
      const table = type === 'contest' ? 'contestant_registrations' : 'performance_registrations';
      const created = await supabaseRequest(table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
      const first = Array.isArray(created) ? created[0] : created;
      return sendJson(res, 201, { ok: true, id: first?.id, created_at: first?.created_at });
    } catch (error) {
      const status = /configured|service key/i.test(error.message) ? 503 : /invalid json|valid|complete/i.test(error.message) ? 400 : 502;
      return sendJson(res, status, { ok: false, error: error.message });
    }
  }

  if (pathname === '/api/admin/session' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, authenticated: isValidSession(req) });
  }

  if (pathname === '/api/admin/event-settings' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      return sendJson(res, 200, { ok: true, venue: await getEventVenue() });
    } catch {
      return sendJson(res, 503, { ok: false, error: 'Could not load the event location.' });
    }
  }

  if (pathname === '/api/admin/event-settings' && req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJson(req);
      if (!isJsonObject(body)) return sendJson(res, 400, { ok: false, error: 'A valid settings object is required.' });
      const venue = typeof body.venue === 'string' ? body.venue.trim() : '';
      if (!venue || venue.length > 120) return sendJson(res, 400, { ok: false, error: 'Enter a location of 1–120 characters.' });
      const rows = await supabaseRequest('event_settings?on_conflict=setting_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ setting_key: 'global', venue })
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return sendJson(res, 200, { ok: true, venue: clean(row?.venue, 120) || venue });
    } catch (error) {
      return sendJson(res, error.message === 'Invalid JSON.' ? 400 : 503, { ok: false, error: error.message === 'Invalid JSON.' ? 'A valid settings object is required.' : 'Could not save the event location.' });
    }
  }

  if (pathname === '/api/admin/event-contacts' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    try {
      return sendJson(res, 200, { ok: true, contacts: await getEventContacts() });
    } catch {
      return sendJson(res, 503, { ok: false, error: 'Could not load crew contacts.' });
    }
  }

  if (pathname === '/api/admin/event-contacts' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJson(req);
      const contact = mapEventContact(body);
      const lastRows = await supabaseRequest('event_contacts?select=sort_order&order=sort_order.desc&limit=1');
      const sortOrder = (Array.isArray(lastRows) && lastRows.length ? Number(lastRows[0].sort_order) || 0 : 0) + 10;
      const rows = await supabaseRequest('event_contacts', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ ...contact, sort_order: sortOrder })
      });
      const saved = Array.isArray(rows) ? rows[0] : rows;
      return sendJson(res, 201, { ok: true, contact: saved });
    } catch (error) {
      const duplicate = /duplicate key/i.test(error.message);
      const invalid = ['Please provide a valid crew contact.', 'Invalid JSON.'].includes(error.message);
      return sendJson(res, invalid ? 400 : duplicate ? 409 : 503, { ok: false, error: invalid ? 'Enter a name, role and a 10-digit Indian number or international number with +country code.' : duplicate ? 'That crew contact is already listed.' : 'Could not add the crew contact.' });
    }
  }

  const contactMatch = pathname.match(/^\/api\/admin\/event-contacts\/([0-9a-f-]{36})$/i);
  if (contactMatch && req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJson(req);
      const contact = mapEventContact(body);
      const rows = await supabaseRequest(`event_contacts?id=eq.${encodeURIComponent(contactMatch[1])}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(contact)
      });
      const saved = Array.isArray(rows) ? rows[0] : rows;
      if (!saved) return sendJson(res, 404, { ok: false, error: 'Crew contact not found.' });
      return sendJson(res, 200, { ok: true, contact: saved });
    } catch (error) {
      const duplicate = /duplicate key/i.test(error.message);
      const invalid = ['Please provide a valid crew contact.', 'Invalid JSON.'].includes(error.message);
      return sendJson(res, invalid ? 400 : duplicate ? 409 : 503, { ok: false, error: invalid ? 'Enter a name, role and a 10-digit Indian number or international number with +country code.' : duplicate ? 'That crew contact is already listed.' : 'Could not save the crew contact.' });
    }
  }

  if (contactMatch && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    try {
      const rows = await supabaseRequest(`event_contacts?id=eq.${encodeURIComponent(contactMatch[1])}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' }
      });
      if (!Array.isArray(rows) || !rows.length) return sendJson(res, 404, { ok: false, error: 'Crew contact not found.' });
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 503, { ok: false, error: 'Could not remove the crew contact.' });
    }
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (!isJsonObject(body)) return sendJson(res, 400, { ok: false, error: 'A valid login object is required.' });
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
      if (!isJsonObject(body)) return sendJson(res, 400, { ok: false, error: 'A valid registration update object is required.' });
      const status = ['new', 'shortlisted', 'confirmed', 'rejected'].includes(body.status) ? body.status : null;
      if (!status) return sendJson(res, 400, { ok: false, error: 'Invalid registration status.' });
      const table = updateMatch[1].toLowerCase() === 'contestant' ? 'contestant_registrations' : 'performance_registrations';
      await supabaseRequest(`${table}?id=eq.${encodeURIComponent(updateMatch[2])}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status, admin_notes: clean(body.admin_notes, 1000) }) });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, error.message === 'Invalid JSON.' ? 400 : 503, { ok: false, error: error.message === 'Invalid JSON.' ? 'A valid registration update object is required.' : error.message });
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

function applicationHandler(req, res) {
  return handleRequest(req, res).catch((error) => {
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Unexpected server error.' });
    console.error(error);
  });
}

module.exports = applicationHandler;

if (require.main === module) {
  const server = http.createServer(applicationHandler);
  server.listen(port, '0.0.0.0', () => console.log(`Freshers site listening on http://0.0.0.0:${port}`));
}
