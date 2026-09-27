const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../workers/dmz-media-api/src/index.js'), 'utf8');
  const { handleFlightImport, validateFlightImport, FLIGHT_IMPORT_SCHEMA: schema } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

  // The model's answer is cleaned field by field: bad codes, dates and times become blanks, never guesses.
  const clean = validateFlightImport({
    confirmation: 'kx7q2m',
    flights: [
      { airline: 'United', flightNumber: 'ua 1234', from: 'ord', to: 'IAH', departDate: '2026-11-07', departTime: '06:00', arriveDate: '2026-11-07', arriveTime: '08:45', seat: '23c' },
      { airline: 'United', flightNumber: 'Flight twelve', from: 'Houston', to: 'CZM', departDate: 'Nov 7', departTime: '10:05 AM', arriveDate: null, arriveTime: '25:00', seat: 'window' },
      { airline: null, flightNumber: null, from: null, to: null, departDate: null, departTime: null, arriveDate: null, arriveTime: null, seat: null },
    ],
  });
  assert.equal(clean.confirmation, 'KX7Q2M');
  assert.equal(clean.flights.length, 1, 'Flights with neither a number nor a route are dropped.');
  assert.deepEqual(clean.flights[0], { airline: 'United', flightNumber: 'UA 1234', from: 'ORD', to: 'IAH', departDate: '2026-11-07', departTime: '06:00', arriveDate: '2026-11-07', arriveTime: '08:45', seat: '23C' });
  const loose = validateFlightImport({ confirmation: 'receipt-0012345678', flights: [{ flightNumber: 'Flight twelve', from: 'IAH', to: 'CZM', departDate: 'Nov 7', departTime: '10:05 AM' }] });
  assert.equal(loose.confirmation, '', 'A ticket or receipt number is not a confirmation code.');
  assert.deepEqual([loose.flights[0].flightNumber, loose.flights[0].departDate, loose.flights[0].departTime], ['', '', ''], 'Unparseable values are blank, not guessed.');
  assert.throws(() => validateFlightImport(null));
  assert.throws(() => validateFlightImport({ flights: 'UA 1' }));
  assert.equal(schema.properties.flights.maxItems, 12);

  // Signed-in customers only; the model is never called for anyone else.
  const originalFetch = global.fetch;
  let modelCalls = 0;
  try {
    global.fetch = async () => { modelCalls++; return Response.json({}); };
    const request = (headers = {}) => new Request('https://example.test/api/planner/flights/parse', { method: 'POST', headers, body: JSON.stringify({ text: 'UA 1234 ORD IAH' }) });
    const noKey = await handleFlightImport(request(), {});
    assert.equal(noKey.status, 500);
    const anonymous = await handleFlightImport(request(), { GEMINI_API_KEY: 'test-only', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
    assert.equal(anonymous.status, 401);
    const forged = await handleFlightImport(request({ Authorization: 'Bearer not-a-real-token' }), { GEMINI_API_KEY: 'test-only', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' });
    assert.ok([401, 503].includes(forged.status), `Forged tokens are refused (got ${forged.status}).`);
    assert.equal(modelCalls <= 1, true, 'Only the key-set lookup may be fetched; the model never is.');
  } finally {
    global.fetch = originalFetch;
  }
  console.log('Flight import endpoint checks passed: field validation, confirmation filtering, and sign-in required.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
