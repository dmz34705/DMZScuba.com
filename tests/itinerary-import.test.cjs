const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../workers/dmz-media-api/src/index.js'), 'utf8');
  const { handleItineraryImport, readItineraryParts, uploadGeminiFile, validateItineraryImport, ITINERARY_IMPORT_SCHEMA: schema } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const blank = { title: null, provider: null, reference: null, from: null, to: null, startDate: null, startTime: null, endDate: null, endTime: null, dives: null, seat: null, notes: null };

  // Every kind of booking is cleaned field by field: bad codes, dates and times become blanks, never guesses.
  const { items } = validateItineraryImport({ items: [
    { ...blank, type: 'flight', title: 'ua 1234', provider: 'United', reference: 'kx7q2m', from: 'ord', to: 'IAH', startDate: '2026-11-07', startTime: '06:00', endDate: '2026-11-07', endTime: '08:45', seat: '23c' },
    { ...blank, type: 'stay', title: '  Casa   Mexicana  ', provider: 'Booking.com', reference: '4012.559.873', from: 'Av. Melgar 457', startDate: '2026-11-07', startTime: '15:00', endDate: '2026-11-14', endTime: '12:00', notes: 'Deluxe ocean view' },
    { ...blank, type: 'car', title: 'Compact SUV', provider: 'Hertz', from: 'CZM airport', to: 'CZM airport', startDate: '2026-11-07', endDate: 'Nov 14', seat: '1A' },
    { ...blank, type: 'liveaboard', title: 'Galapagos Aggressor III', startDate: '2027-05-13', endDate: '2027-05-20', dives: 20 },
    { ...blank, type: 'diving', title: 'Palancar 2-tank', dives: 400 },
    { ...blank, type: 'submarine', title: 'Atlantis sub tour', startDate: '2026-11-11' },
    { ...blank, type: 'flight', title: 'Flight twelve', from: 'Houston', to: 'CZM', startTime: '10:05 AM' },
    { ...blank, type: 'other' },
  ] });
  assert.equal(items.length, 6, 'Items left with no name, provider or route are dropped — including a flight whose number and origin were junk.');
  assert.deepEqual([items[0].title, items[0].from, items[0].reference, items[0].seat], ['UA 1234', 'ORD', 'KX7Q2M', '23C']);
  assert.equal(items[1].title, 'Casa Mexicana', 'Whitespace is tidied.');
  assert.equal(items[1].reference, '4012.559.873', 'Hotel booking numbers keep their dots.');
  assert.equal(items[2].endDate, '', 'Unparseable dates are blank.');
  assert.equal(items[2].seat, '', 'Only flights have seats.');
  assert.equal(items[3].dives, 20);
  assert.equal(items[4].dives, null, 'Implausible dive counts are dropped.');
  assert.equal(items[5].type, 'other', 'Unknown types become other.');
  const partial = validateItineraryImport({ items: [{ ...blank, type: 'flight', title: 'UA 1500', from: 'Houston', to: 'CZM', startTime: '10:05 AM' }] }).items[0];
  assert.deepEqual([partial.title, partial.from, partial.to, partial.startTime], ['UA 1500', '', 'CZM', '10:05'], 'A flight keeps only valid codes; a 12-hour time is converted.');
  const loose = validateItineraryImport({ items: [{ kind: 'liveaboard', title: 'Sea Spirit', startDate: '13 Mar 2026', startTime: '4:00 PM', endDate: 'Wed, March 18, 2026', endTime: '2026-03-18T17:00:00' }] }).items[0];
  assert.deepEqual([loose.startDate, loose.startTime, loose.endDate, loose.endTime], ['2026-03-13', '16:00', '2026-03-18', '17:00'], 'Dates and times in other formats are converted, not dropped.');
  const aliased = validateItineraryImport({ items: [{ kind: 'stay', name: 'Casa Azul', checkIn: '2026-11-07', checkOut: '14 Nov 2026', confirmationNumber: 'ab1234' }] }).items[0];
  assert.deepEqual([aliased.title, aliased.startDate, aliased.endDate, aliased.reference], ['Casa Azul', '2026-11-07', '2026-11-14', 'AB1234'], 'Other names for the same fields are accepted, not dropped.');
  const nonsense = validateItineraryImport({ items: [{ kind: 'stay', title: 'Hotel', startDate: '31 Foo 2026', startTime: '25:00', endDate: '03/04/2026', endTime: '4' }] }).items[0];
  assert.deepEqual([nonsense.startDate, nonsense.startTime, nonsense.endDate, nonsense.endTime], ['', '', '', ''], 'Ambiguous or invalid values are still blank.');
  assert.throws(() => validateItineraryImport(null));
  assert.throws(() => validateItineraryImport({ items: 'hotel' }));
  assert.equal(validateItineraryImport({ items: Array.from({ length: 30 }, () => ({ kind: 'activity', title: 'Tour' })) }).items.length, 20, 'At most 20 items, enforced here rather than in the answer format.');
  assert.equal(validateItineraryImport({ items: [{ kind: 'car', title: 'SUV' }] }).items[0].type, 'car', 'Answers name the booking type kind.');
  assert.deepEqual(schema.properties.items.items.required, ['kind'], 'A small answer format: Gemini refuses ones with too many shapes.');
  assert.deepEqual(schema.properties.items.items.properties.kind.enum, ['flight', 'stay', 'car', 'liveaboard', 'diving', 'activity', 'transfer', 'ferry', 'other']);

  // Signed-in customers only; the model is never called for anyone else.
  const originalFetch = global.fetch;
  const modelCalls = [];
  try {
    global.fetch = async (url) => { if (String(url).includes('generativelanguage')) modelCalls.push(url); return Response.json({}); };
    const request = (headers = {}) => new Request('https://example.test/api/planner/itinerary/parse', { method: 'POST', headers, body: JSON.stringify({ text: 'Hotel check-in Nov 7' }) });
    const env = { GEMINI_API_KEY: 'test-only', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
    assert.equal((await handleItineraryImport(request(), {})).status, 500);
    assert.equal((await handleItineraryImport(request(), env)).status, 401);
    const forged = await handleItineraryImport(request({ Authorization: 'Bearer not-a-real-token' }), env);
    assert.ok([401, 503].includes(forged.status), `Forged tokens are refused (got ${forged.status}).`);
    assert.equal(modelCalls.length, 0, 'The model is never called without a valid sign-in.');
  } finally {
    global.fetch = originalFetch;
  }
  // Large PDFs: uploaded to Gemini's Files API, read from there. And overload is retried.
  {
    const saved = global.fetch;
    try {
      global.fetch = async (url, options = {}) => {
        const u = String(url);
        if (u.includes('/upload/v1beta/files')) return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.example/session' } });
        if (u === 'https://upload.example/session') {
          assert.equal(options.body.length, 5, 'The PDF bytes are uploaded, decoded from base64.');
          return Response.json({ file: { name: 'files/abc', uri: 'https://gemini.example/files/abc', state: 'ACTIVE' } });
        }
        throw new Error('unexpected ' + u);
      };
      const uploaded = await uploadGeminiFile('test-only', Buffer.from('%PDF-').toString('base64'), 'application/pdf', Date.now() + 30000);
      assert.deepEqual(uploaded, { uri: 'https://gemini.example/files/abc', name: 'files/abc', mimeType: 'application/pdf' });

      let attempt = 0;
      global.fetch = async (url, options) => {
        attempt++;
        if (attempt === 1) return Response.json({ error: { message: 'This model is currently experiencing high demand.' } }, { status: 503 });
        const payload = JSON.parse(options.body);
        assert.equal(payload.generationConfig.responseSchema, undefined, 'No strict answer format.');
        assert.equal(payload.contents[0].parts[1].fileData.fileUri, 'https://gemini.example/files/abc');
        return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [{ kind: 'liveaboard', title: 'Sea Spirit', startDate: '13 Mar 2026', endDate: '2026-03-18' }] }) }] } }] });
      };
      const response = await readItineraryParts('test-only', [{ text: 'prompt' }, { fileData: { mimeType: 'application/pdf', fileUri: uploaded.uri } }], Date.now() + 30000);
      const data = await response.json();
      assert.equal(attempt, 2, 'A busy answer is retried.');
      assert.deepEqual([data.items[0].title, data.items[0].startDate, data.items[0].endDate], ['Sea Spirit', '2026-03-13', '2026-03-18']);

      // Quota used up (429): reported at once, not retried — retries would spend more quota.
      let quotaCalls = 0;
      global.fetch = async () => { quotaCalls++; return Response.json({ error: { message: 'You exceeded your current quota' } }, { status: 429 }); };
      const quota = await readItineraryParts('test-only', [{ text: 'prompt' }], Date.now() + 30000);
      assert.equal(quotaCalls, 1, 'A quota error is not retried.');
      assert.equal(quota.status, 429);
      assert.equal((await quota.json()).code, 'AI_QUOTA');
    } finally {
      global.fetch = saved;
    }
  }
  console.log('Itinerary import endpoint checks passed: all booking types validated, junk dropped, sign-in required.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
