const assert = require('node:assert/strict');

(async () => {
  const originalFetch = global.fetch;
  const worker = await import('../src/index.js');

  assert.equal(worker.localAiEnabled({ AI_PROVIDER: 'local' }), true);
  assert.equal(worker.localAiEnabled({ AI_PROVIDER: 'LOCAL' }), true);
  assert.equal(worker.localAiEnabled({ AI_PROVIDER: 'gemini' }), false);
  assert.equal(worker.localAiEnabled({}), false);
  assert.equal(worker.lensLocalAiEnabled({ AI_PROVIDER: 'local' }), false);
  assert.equal(worker.lensLocalAiEnabled({ AI_PROVIDER: 'local', LENS_AI_PROVIDER: 'gemini' }), false);
  assert.equal(worker.lensLocalAiEnabled({ LENS_AI_PROVIDER: 'Local' }), true);
  assert.deepEqual(worker.sanitizeLensContext({
    waterType: 'fresh', siteName: 'Lake Superior', month: 10, latitude: 46.46, longitude: -86.6,
    nearbySpecies: [{ commonName: 'Burbot', scientificName: 'Lota lota', records: 5 }, { scientificName: {} }],
  }), {
    waterType: 'fresh', siteName: 'Lake Superior', month: 10,
    nearbySpecies: [{ commonName: 'Burbot', scientificName: 'Lota lota', records: 5 }],
  });

  let called;
  global.fetch = async (url, options) => {
    called = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ ok: true, result: { value: 'reef' } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await worker.requestLocalStructured({
      LOCAL_AI_ORIGIN_URL: 'https://ai-origin.dmzscuba.com/',
      LOCAL_AI_SHARED_SECRET: 'private-test-secret',
    }, {
      prompt: 'Identify the image.',
      schema: { type: 'OBJECT', properties: { value: { type: 'STRING' } }, required: ['value'] },
      imageBase64: 'YWJj',
      specialist: { type: 'fishial', context: { waterType: 'fresh', nearbySpecies: [{ commonName: 'Burbot', scientificName: 'Lota lota', records: 5 }] } },
      timeoutMs: 1000,
      requestId: 'lens-test-123',
      feature: 'dive-lens',
    });

    assert.deepEqual(result, { value: 'reef' });
    assert.equal(called.url, 'https://ai-origin.dmzscuba.com/v1/structured');
    assert.equal(called.options.headers.Authorization, 'Bearer private-test-secret');
    assert.equal(called.options.headers['X-DMZ-Request-ID'], 'lens-test-123');
    assert.equal(called.options.headers['X-DMZ-Feature'], 'dive-lens');
    assert.equal(called.body.imageBase64, 'YWJj');
    assert.equal(called.body.prompt, 'Identify the image.');
    assert.equal(called.body.specialist.type, 'fishial');
    assert.equal(called.body.specialist.context.nearbySpecies[0].scientificName, 'Lota lota');

    const documentResult = await worker.requestLocalStructured({
      LOCAL_AI_ORIGIN_URL: 'https://ai-origin.dmzscuba.com/',
      LOCAL_AI_SHARED_SECRET: 'private-test-secret',
    }, {
      prompt: 'Extract the itinerary.',
      schema: { type: 'OBJECT', properties: { value: { type: 'STRING' } }, required: ['value'] },
      pdfBase64: 'JVBERi0=',
      timeoutMs: 1000,
      requestId: 'pdf-test-123',
      feature: 'itinerary-pdf',
    });
    assert.deepEqual(documentResult, { value: 'reef' });
    assert.equal(called.url, 'https://ai-origin.dmzscuba.com/v1/document');
    assert.equal(called.body.pdfBase64, 'JVBERi0=');
    assert.equal(called.options.headers['X-DMZ-Feature'], 'itinerary-pdf');
  } finally {
    global.fetch = originalFetch;
  }

  console.log('local AI worker adapter tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
