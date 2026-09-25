// Bundle the app's "Get me here" journey planner for the browser. Loaded on demand by the travel page.
// Run where the dmzscuba-app checkout is available:
//   node build-ocean-atlas-journey.cjs /path/to/dmzscuba-app /path/to/ocean-atlas-journey-engine.js
// esbuild is a build-time dependency only. The generated browser asset is committed.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require(process.env.ESBUILD_MODULE || 'esbuild');

const appRoot = path.resolve(process.argv[2] || '');
const output = path.resolve(process.argv[3] || '');
if (!process.argv[2] || !process.argv[3] || !fs.existsSync(path.join(appRoot, 'src/features/oceanAtlas/journey.js')))
  throw new Error('Usage: node build-ocean-atlas-journey.cjs <app-root> <output-js>');

const entry = `
import AIRPORT_DATA from './src/features/oceanAtlas/data/airports.json';
import { originAirport, planJourney } from './src/features/oceanAtlas/journey.js';
import { approxDistance, distanceText } from './src/features/oceanAtlas/units.js';

export { approxDistance, distanceText, originAirport, planJourney };

// Browsers have no platform geocoder: place a typed start by airport code or city name.
const clean = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
export function placeFromText(text) {
  const query = clean(text);
  if (!query) return null;
  const rows = AIRPORT_DATA.airports;
  const code = /^[a-z]{3}$/.test(query) ? rows.find((row) => row[0].toLowerCase() === query) : null;
  const city = clean(String(text).split(',')[0]);
  const match = code || rows.filter((row) => clean(row[2]) === query || (city && clean(row[2]) === city))
    .sort((a, b) => (b[7] || 0) - (a[7] || 0))[0];
  return match ? { latitude: match[4], longitude: match[5], label: match[2] || match[1] } : null;
}

export function originLabel(point) {
  const home = originAirport(point);
  return home ? [home.city || home.name, AIRPORT_DATA.countries[home.country] || home.country].filter(Boolean).join(', ') : '';
}
`;

esbuild.buildSync({ stdin: { contents: entry, resolveDir: appRoot, sourcefile: 'ocean-atlas-journey-entry.js',
  loader: 'js' }, bundle: true, platform: 'browser', format: 'iife', globalName: 'DMZAtlasJourneyEngine',
  minify: true, target: ['es2020'], outfile: output, legalComments: 'inline' });
console.log(`Built ${output} (${fs.statSync(output).size.toLocaleString()} bytes).`);
