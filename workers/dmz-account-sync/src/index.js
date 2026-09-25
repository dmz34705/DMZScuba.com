const KINDS = new Set(['dive', 'computerLog', 'gear', 'setup', 'preferences']);
const ID = /^[a-zA-Z0-9_-]{1,120}$/;
const MAX_BYTES = 1500000;
const INCLUDE_ROWS = 250;
const INCLUDE_BYTES = 4000000;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const record = (row) => row ? ({ kind: row.kind, id: row.id, revision: row.revision, deleted: !!row.deleted,
  mutationId: row.mutation_id, updatedAt: row.updated_at, data: JSON.parse(row.data) }) : null;

export async function identity(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer \S+$/.test(authorization)) return { error: json({ ok: false, error: 'Sign in to access your diving data.' }, 401) };
  // Reuse the existing verified JWT + active-account checks. Never trust a client-supplied owner.
  if (!env.ACCOUNT_API) return { error: json({ ok: false, error: 'Account verification is temporarily unavailable.' }, 503) };
  const response = await env.ACCOUNT_API.fetch(new Request('https://dmz-media-api.internal/api/account', {
    headers: { Authorization: authorization, Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
  }));
  if (!response.ok) return { error: json({ ok: false, error: response.status === 403 ? 'This account is inactive.' : 'Your session could not be verified.' }, [401, 403].includes(response.status) ? response.status : 503) };
  const data = await response.json();
  const userId = data?.profile?.userId;
  if (!data.ok || !userId) return { error: json({ ok: false, error: 'Your session could not be verified.' }, 401) };
  return { userId };
}

export async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/health') return json({ ok: true, environment: 'dev', protocol: 1 });
  if (!url.pathname.startsWith('/api/account/sync')) return json({ ok: false, error: 'Not found.' }, 404);
  const auth = await identity(request, env);
  if (auth.error) return auth.error;
  const owner = auth.userId;
  const parts = url.pathname.slice('/api/account/sync'.length).split('/').filter(Boolean);
  const [kind, id] = parts;
  if (!kind && request.method === 'GET' && url.searchParams.has('include')) {
    // Records with their data in one pass (the website's logbook and gear locker), instead of one
    // request — and one account verification — per record. Pages by row count and response size.
    const kinds = [...new Set(url.searchParams.get('include').split(','))].filter((k) => KINDS.has(k));
    if (!kinds.length) return json({ ok: false, error: 'Invalid record kinds.' }, 400);
    const after = url.searchParams.get('after') || '';
    const rows = await env.DB.prepare(`SELECT * FROM sync_records WHERE user_id = ? AND kind IN (${kinds.map(() => '?').join(',')})
      AND (kind || '/' || id) > ? ORDER BY kind,id LIMIT ${INCLUDE_ROWS + 1}`).bind(owner, ...kinds, after).all();
    const page = []; let bytes = 0;
    for (const row of rows.results.slice(0, INCLUDE_ROWS)) {
      bytes += row.deleted ? 0 : row.data.length;
      if (page.length && bytes > INCLUDE_BYTES) break;
      page.push(row);
    }
    const more = page.length < rows.results.length;
    return json({ ok: true, protocol: 1, records: page.map((row) => row.deleted
      ? { kind: row.kind, id: row.id, revision: row.revision, deleted: true, updatedAt: row.updated_at, data: null } : record(row)),
    next: more ? `${page.at(-1).kind}/${page.at(-1).id}` : null });
  }
  if (!kind && request.method === 'GET') {
    const after = url.searchParams.get('after') || '';
    const rows = await env.DB.prepare(`SELECT kind,id,revision,deleted,updated_at FROM sync_records
      WHERE user_id = ? AND (kind || '/' || id) > ? ORDER BY kind,id LIMIT 501`).bind(owner, after).all();
    const page = rows.results.slice(0, 500);
    return json({ ok: true, protocol: 1, records: page.map((r) => ({ kind: r.kind, id: r.id, revision: r.revision, deleted: !!r.deleted, updatedAt: r.updated_at })),
      next: rows.results.length > 500 ? `${page.at(-1).kind}/${page.at(-1).id}` : null });
  }
  if (parts.length !== 2 || !KINDS.has(kind) || !ID.test(id || '')) return json({ ok: false, error: 'Invalid record.' }, 400);
  const load = () => env.DB.prepare('SELECT * FROM sync_records WHERE user_id = ? AND kind = ? AND id = ?').bind(owner, kind, id).first();
  if (request.method === 'GET') {
    const row = await load();
    return row ? json({ ok: true, record: record(row) }) : json({ ok: false, error: 'Record not found.' }, 404);
  }
  if (request.method !== 'PUT') return json({ ok: false, error: 'Method not allowed.' }, 405);
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) return json({ ok: false, error: 'This record is too large to sync.' }, 413);
  // Bound the streamed body even when Content-Length is absent or incorrect.
  const reader = request.body?.getReader();
  if (!reader) return json({ ok: false, error: 'A record is required.' }, 400);
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); return json({ ok: false, error: 'This record is too large to sync.' }, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ ok: false, error: 'Invalid JSON.' }, 400); }
  if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0 || !ID.test(body.mutationId || '') || typeof body.deleted !== 'boolean'
      || !body.data || typeof body.data !== 'object' || Array.isArray(body.data) || body.data.id !== id) {
    return json({ ok: false, error: 'Invalid record or revision.' }, 400);
  }
  const now = new Date().toISOString();
  // A compare-and-swap in one SQL statement prevents concurrent clients from overwriting each other.
  let result;
  if (body.baseRevision === 0) {
    result = await env.DB.prepare(`INSERT OR IGNORE INTO sync_records
      (user_id,kind,id,revision,mutation_id,deleted,data,updated_at) VALUES (?,?,?,1,?,?,?,?)`)
      .bind(owner, kind, id, body.mutationId, body.deleted ? 1 : 0, JSON.stringify(body.data), now).run();
  } else {
    result = await env.DB.prepare(`UPDATE sync_records SET revision=revision+1,mutation_id=?,deleted=?,data=?,updated_at=?
      WHERE user_id=? AND kind=? AND id=? AND revision=?`)
      .bind(body.mutationId, body.deleted ? 1 : 0, JSON.stringify(body.data), now, owner, kind, id, body.baseRevision).run();
  }
  const saved = await load();
  if (!result.meta.changes && saved?.mutation_id !== body.mutationId) {
    return json({ ok: false, code: 'SYNC_CONFLICT', error: 'This record changed on another device. Both versions have been kept.', record: record(saved) }, 409);
  }
  return json({ ok: true, record: record(saved) });
}

export default { async fetch(request, env) {
  try { return await handle(request, env); }
  catch { return json({ ok: false, error: 'Sync is temporarily unavailable. Your device data is safe.' }, 503); }
} };
