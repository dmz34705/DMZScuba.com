const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../workers/dmz-media-api/src/index.js'), 'utf8');
  const { handleItineraryImport, validateItineraryImport, ITINERARY_IMPORT_SCHEMA: schema } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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
  assert.deepEqual([partial.title, partial.from, partial.to, partial.startTime], ['UA 1500', '', 'CZM', ''], 'A flight keeps only valid codes and times.');
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
  console.log('Itinerary import endpoint checks passed: all booking types validated, junk dropped, sign-in required.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
