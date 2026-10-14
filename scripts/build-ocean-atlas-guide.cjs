// Bundle the app's pure Ocean Atlas and gear-advice calculations for the browser.
// Run where the dmzscuba-app checkout is available:
//   node build-ocean-atlas-guide.cjs /path/to/dmzscuba-app /path/to/ocean-atlas-guide-engine.js
// esbuild is a build-time dependency only. The generated browser asset is committed.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require(process.env.ESBUILD_MODULE || 'esbuild');

const appRoot = path.resolve(process.argv[2] || '');
const output = path.resolve(process.argv[3] || '');
if (!process.argv[2] || !process.argv[3] || !fs.existsSync(path.join(appRoot, 'src/features/oceanAtlas/catalog.js')))
  throw new Error('Usage: node build-ocean-atlas-guide.cjs <app-root> <output-js>');

const entry = `
import { catalogSite } from './src/features/oceanAtlas/catalog.js';
import { placeAt, placeById, placeGuide, quickLook, regionGuide } from './src/features/oceanAtlas/places.js';
import { seasonGuide } from './src/features/oceanAtlas/seasons.js';
import { inlandProfile, isInland } from './src/features/oceanAtlas/inland.js';
import { buildSiteGuide } from './src/features/oceanAtlas/siteGuide.js';
import { discoverSpecies, speciesGuide, speciesIndex } from './src/features/oceanAtlas/species.js';
import { buildAtlasGearSuggestion, normalizeAtlasDiveMode } from './src/features/oceanAtlas/atlasGear.js';
import { fetchSiteWeather } from './src/features/oceanAtlas/weather.js';
import { normalizeGearState } from './src/features/gearChecklist/model.js';
import { normalizeAdvicePreferences, recommendDiveGear, advicePreferenceError, coldDiverTemplate } from './src/features/gearChecklist/diveAdvice.js';

const validCoordinate = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
const units = (options) => options?.depthUnit === 'm' ? 'metric' : 'imperial';
const prefs = (options) => normalizeAdvicePreferences(options?.advicePreferences || {});

function siteGuideMessage(message, options = {}) {
  const key = String(message.key || '').slice(0, 120);
  if (!validCoordinate(message.latitude, message.longitude)) return { type: 'siteGuide', key, guide: null, places: [] };
  try {
    const preference = prefs(options);
    const payload = buildSiteGuide(message, { origin: options.origin || null, units: units(options),
      advicePrefs: preference, diver: options.diver || { signedIn: false } });
    const record = typeof message.id === 'string' ? catalogSite(message.id.slice(0, 80)) : null;
    const site = record || { latitude: message.latitude, longitude: message.longitude, topologies: [] };
    const month = Number.isInteger(message.month) && message.month >= 0 && message.month < 12
      ? message.month : new Date().getMonth();
    const gear = buildAtlasGearSuggestion(normalizeGearState(options.gearState || null), preference, {
      mode: normalizeAtlasDiveMode(options.gearMode), site, profile: payload.profile || null,
      inland: payload.guide?.inland || null, temperatureC: payload.wear?.[month]?.temperatureC ?? null });
    return { type: 'siteGuide', ...payload, gear };
  } catch {
    return { type: 'siteGuide', key, guide: null, places: [] };
  }
}

export function respond(message, options = {}) {
  if (!message || typeof message !== 'object') return null;
  if (message.type === 'siteGuide') return siteGuideMessage(message, options);
  if (message.type === 'gearMode') {
    const response = siteGuideMessage(message, { ...options, gearMode: message.value });
    return { type: 'siteGear', key: response.key,
      gear: response.gear || { mode: normalizeAtlasDiveMode(message.value), setup: null } };
  }
  if (message.type === 'speciesIndex') {
    try { return { type: 'speciesIndex', species: speciesIndex() }; }
    catch { return { type: 'speciesIndex', species: [] }; }
  }
  if (message.type === 'speciesGuide' && typeof message.key === 'string') {
    const key = message.key.slice(0, 120);
    try { return { type: 'speciesGuide', key, guide: speciesGuide(key) }; }
    catch { return { type: 'speciesGuide', key, guide: null }; }
  }
  if (message.type === 'discover' && Number.isInteger(message.month) && message.month >= 0 && message.month < 12) {
    try { return { type: 'discover', month: message.month, discover: discoverSpecies(message.month) }; }
    catch { return { type: 'discover', month: message.month, discover: null }; }
  }
  if (message.type === 'regionGuide' && ['province', 'diveRegion'].includes(message.kind)
    && typeof message.id === 'string') {
    const id = message.id.slice(0, 60);
    try { return { type: 'regionGuide', key: message.kind + ':' + id, guide: regionGuide(message.kind, id) }; }
    catch { return { type: 'regionGuide', key: message.kind + ':' + id, guide: null }; }
  }
  if (message.type === 'quickLook' && validCoordinate(message.latitude, message.longitude)) {
    try { return { type: 'quickLook', requestId: message.requestId,
      look: quickLook(message.latitude, message.longitude) }; }
    catch { return { type: 'quickLook', requestId: message.requestId, look: null }; }
  }
  if (message.type === 'placeAt' && validCoordinate(message.latitude, message.longitude)) {
    try { const hit = placeAt(message.latitude, message.longitude);
      return { type: 'place', requestId: message.requestId, place: hit ? placeGuide(hit, units(options)) : null }; }
    catch { return { type: 'place', requestId: message.requestId, place: null }; }
  }
  if (message.type === 'openPlace' && ['island', 'state', 'country'].includes(message.kind)
    && typeof message.id === 'string') {
    try { const hit = placeById(message.kind, message.id.slice(0, 40));
      return { type: 'place', requestId: null, place: hit ? placeGuide(hit, units(options)) : null, fly: true }; }
    catch { return { type: 'place', requestId: null, place: null }; }
  }
  return null;
}

export async function siteWeather(message) {
  const key = String(message?.key || '').slice(0, 120);
  if (!validCoordinate(message?.latitude, message?.longitude)) return { type: 'siteWeather', key, status: 'error' };
  try {
    const record = typeof message.id === 'string' ? catalogSite(message.id.slice(0, 80)) : null;
    const point = record || { latitude: message.latitude, longitude: message.longitude, topologies: [] };
    const marine = !isInland(point) && point.environment !== 'fresh';
    return { type: 'siteWeather', key, status: 'ready',
      weather: await fetchSiteWeather(message.latitude, message.longitude, { marine }) };
  } catch { return { type: 'siteWeather', key, status: 'error' }; }
}

export function gearContext(message) {
  if (!validCoordinate(message?.latitude, message?.longitude)) return null;
  const month = Number.isInteger(message.month) && message.month >= 0 && message.month < 12
    ? message.month : new Date().getMonth();
  const site = typeof message.id === 'string' ? catalogSite(message.id.slice(0, 80)) : null;
  const point = site || { latitude: message.latitude, longitude: message.longitude, topologies: [] };
  const inland = isInland(point) ? inlandProfile(point) : null;
  const temperatureC = inland ? inland.surface?.[month] ?? null : seasonGuide(point).temps?.[month] ?? null;
  return { site: point, inland, temperatureC, month, broad: !site,
    name: site?.name || String(message.name || 'This location').slice(0, 200) };
}

export function recommend(gearRecords, setupRecords, preferences, context) {
  const state = normalizeGearState({ items: gearRecords || [], setups: setupRecords || [] });
  return recommendDiveGear(state, normalizeAdvicePreferences(preferences || {}), context);
}
export const normalizePreferences = normalizeAdvicePreferences;
export const preferenceError = advicePreferenceError;
export const comfortTemplate = coldDiverTemplate;
export function suggest(gearRecords, setupRecords, preferences, context) {
  return buildAtlasGearSuggestion(normalizeGearState({items:gearRecords||[],setups:setupRecords||[]}),preferences,context);
}
`;

esbuild.buildSync({ stdin: { contents: entry, resolveDir: appRoot, sourcefile: 'ocean-atlas-guide-entry.js',
  loader: 'js' }, bundle: true, platform: 'browser', format: 'iife', globalName: 'DMZAtlasGuideEngine',
  minify: true, target: ['es2020'], outfile: output, legalComments: 'inline' });
const sourceRef=require('node:child_process').execFileSync('git',['-C',appRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(output, `// Generated from dmzscuba-app ${sourceRef}; see scripts/build-ocean-atlas-guide.cjs.\n${fs.readFileSync(output, 'utf8').replace(/[ \t]+$/gm,'').trimEnd()}\n`);
console.log(`Built ${output} (${fs.statSync(output).size.toLocaleString()} bytes).`);
