const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/atlas-weather.js'), 'utf8')
  .replace(/^export /gm, '');
const sandbox = vm.createContext({ Response, Request, URL, Headers, console, Date });
vm.runInContext(`${source}\nglobalThis.api = { atlasWeatherCoordinates, normalizeAtlasWeather, normalizeMarineForecast, handleAtlasWeather };`, sandbox);

const sample = {
  properties: {
    meta: { updated_at: '2026-10-08T12:00:00Z' },
    timeseries: [{
      time: '2026-10-08T13:00:00Z',
      data: {
        instant: { details: { air_temperature: 27.5, apparent_air_temperature: 30.2, ultraviolet_index_clear_sky: 8.4, wind_speed: 6.2, wind_from_direction: 135, air_pressure_at_sea_level: 1012.4, cloud_area_fraction: 42, relative_humidity: 75 } },
        next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0.2 } },
      },
    }],
  },
};
const marineStart = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
const marineNext = new Date(Math.floor(Date.now() / 3600000) * 3600000 + 3600000).toISOString();
const marineSample = {
  table: { rows: [
    [marineStart, 0, 20.5, 273, 1.6, 6.2, 141],
    [marineNext, 0, 20.5, 273, 1.5, 6.4, 138],
  ] },
};

(async () => {
  assert.equal(sandbox.api.atlasWeatherCoordinates(new URL('https://dmz.test/?lat=91&lon=1')), null);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.api.atlasWeatherCoordinates(new URL('https://dmz.test/?lat=20.30688&lon=-87.03491')))), { latitude: 20.307, longitude: -87.035 });
  const normalized = sandbox.api.normalizeAtlasWeather(sample, { latitude: 20.307, longitude: -87.035 }, '2026-10-08T12:05:00Z');
  assert.equal(normalized.hours[0].symbolCode, 'partlycloudy_day');
  assert.equal(normalized.hours[0].windSpeedMps, 6.2);
  assert.equal(normalized.hours[0].apparentTemperatureC, 30.2);
  assert.equal(normalized.hours[0].uvIndexClearSky, 8.4);
  assert.equal(normalized.source.license, 'CC BY 4.0');
  const marine = sandbox.api.normalizeMarineForecast(marineSample, Date.now() - 3600000);
  assert.equal(marine.hours[0].waveHeightM, 1.6);
  assert.equal(marine.gridLongitude, -87);

  let providerCalls = 0;
  const entries = new Map();
  const cache = {
    async match(request) { return entries.get(request.url)?.clone() || null; },
    async put(request, response) { entries.set(request.url, response.clone()); },
  };
  const fetchImpl = async (url, options) => {
    providerCalls += 1;
    if (url.includes('erddap')) {
      assert.match(url, /Thgt\[last-168:1:last\]/);
      return new Response(JSON.stringify(marineSample), { status: 200 });
    }
    assert.match(url, /lat=20\.307&lon=-87\.035/);
    assert.match(options.headers['User-Agent'], /DMZScuba/);
    return new Response(JSON.stringify(sample), { status: 200, headers: { Expires: new Date(Date.now() + 900000).toUTCString() } });
  };
  const request = new Request('https://dmz.test/api/atlas/weather?lat=20.30688&lon=-87.03491');
  const first = await sandbox.api.handleAtlasWeather(request, null, { fetchImpl, cache });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('X-DMZ-Weather-Cache'), 'MISS');
  const second = await sandbox.api.handleAtlasWeather(request, null, { fetchImpl, cache });
  assert.equal(second.headers.get('X-DMZ-Weather-Cache'), 'HIT');
  assert.equal(providerCalls, 1);
  const body = await second.json();
  assert.equal(body.hours.length, 1);

  const marineRequest = new Request('https://dmz.test/api/atlas/weather?lat=20.30688&lon=-87.03491&marine=1');
  const marineResponse = await sandbox.api.handleAtlasWeather(marineRequest, null, { fetchImpl, cache });
  assert.equal(marineResponse.status, 200);
  assert.equal((await marineResponse.json()).marine.hours[0].wavePeriodS, 6.2);
  assert.equal(providerCalls, 3, 'A marine miss makes one MET request and one shared wave-grid request.');

  const invalid = await sandbox.api.handleAtlasWeather(new Request('https://dmz.test/api/atlas/weather?lat=nope&lon=1'), null, { fetchImpl, cache });
  assert.equal(invalid.status, 400);
  console.log('Atlas weather checks passed: coordinates, normalization, attribution, provider identity and edge caching.');
})().catch(error => { console.error(error); process.exitCode = 1; });
