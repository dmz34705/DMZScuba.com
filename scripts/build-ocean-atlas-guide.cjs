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
import { placeAt, placeById, placeGuide, placesForSite, quickLook, regionGuide } from './src/features/oceanAtlas/places.js';
import { seasonGuide } from './src/features/oceanAtlas/seasons.js';
import { siteRatings } from './src/features/oceanAtlas/ratings.js';
import { freshwaterLife, inlandProfile, isInland } from './src/features/oceanAtlas/inland.js';
import { exposureAdvice } from './src/features/oceanAtlas/exposure.js';
import { nearbyDepths } from './src/features/oceanAtlas/nearbyDepths.js';
import { normalizeGearState } from './src/features/gearChecklist/model.js';
import { normalizeAdvicePreferences, recommendDiveGear } from './src/features/gearChecklist/diveAdvice.js';
import SITE_IMAGES from './src/features/oceanAtlas/data/siteImages.json';
import SITE_FACTS from './src/features/oceanAtlas/data/siteFacts.json';
import SITE_PROTECTION from './src/features/oceanAtlas/data/siteProtection.json';
import SITE_SEAFLOOR from './src/features/oceanAtlas/data/siteSeafloor.json';
import SITE_SHORE from './src/features/oceanAtlas/data/siteShore.json';
import SITE_BATHYMETRY from './src/features/oceanAtlas/data/siteBathymetry.json';
import SITE_LAKE_DEPTHS from './src/features/oceanAtlas/data/siteLakeDepths.json';

const validCoordinate = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
const units = (options) => options?.depthUnit === 'm' ? 'metric' : 'imperial';
const prefs = (options) => normalizeAdvicePreferences(options?.advicePreferences || {});

export function siteGuideMessage(message, options = {}) {
  const key = String(message.key || '').slice(0, 120);
  if (!validCoordinate(message.latitude, message.longitude)) return { type: 'siteGuide', key, guide: null, places: [] };
  try {
    const record = typeof message.id === 'string' ? catalogSite(message.id.slice(0, 80)) : null;
    const site = record || { latitude: message.latitude, longitude: message.longitude, topologies: [] };
    const guide = seasonGuide(site);
    const inland = isInland(site);
    const profile = inland ? inlandProfile(site) : null;
    const life = inland ? freshwaterLife(site) : null;
    if (inland) Object.assign(guide, { temps: null, highlights: [], animals: life, hasObservations: life.length > 0 });
    const preference = prefs(options);
    const offset = { cold: 2, typical: 0, warm: -2 }[preference.thermalTendency] || 0;
    const wear = Array.from({ length: 12 }, (_, month) => {
      const temperatureC = profile ? profile.surface?.[month] ?? null : guide.temps?.[month] ?? null;
      const advice = exposureAdvice({ site, inland: profile, temperatureC,
        comfortOffsetC: offset, drysuitBelowC: preference.drysuitBelowC + offset });
      const deepSite = !profile && !advice.dry && site.maxDepthMeters >= 30 && !site.depthIsWholeLake;
      const reason = advice.deepInland ? 'Cold below the thermocline — plan a drysuit until the bottom temperature is confirmed.'
        : deepSite ? 'Deep site — the bottom can be much colder than the surface. Confirm it before you choose.'
          : advice.dry ? 'Cold water — a drysuit with suitable insulation.'
            : advice.fullCoverage ? 'Full-length suit — protection from wreckage and rock.' : null;
      return { label: advice.label, temperatureC, reason, personal: Boolean(offset) };
    });
    return { type: 'siteGuide', key,
      guide: { temps: guide.temps, highlights: guide.highlights, animals: guide.animals,
        hasObservations: guide.hasObservations, inland: profile }, wear,
      ratings: { ...siteRatings(site, guide, { originPoint: options.origin || null,
        inland: profile, life, units: units(options) }), inland: profile },
      photo: record && SITE_IMAGES.images[record.id]
        ? (([url, attribution, license, page]) => ({ url, attribution, license, page }))(SITE_IMAGES.images[record.id]) : null,
      facts: record && SITE_FACTS.facts[record.id]
        ? (([summary, article, ship]) => ({ summary, article, ship: ship && {
          type: ship[0], builder: ship[1], flag: ship[2], length: ship[3], beam: ship[4],
          tonnage: ship[5], events: ship[6] || [], wikidata: ship[7] } }))(SITE_FACTS.facts[record.id]) : null,
      protection: record ? (SITE_PROTECTION.sites[record.id] || []).map((i) =>
        (([name, kind, url]) => ({ name, kind, url }))(SITE_PROTECTION.areas[i])) : [],
      seafloor: record && SITE_SEAFLOOR.sites[record.id]
        ? (([atPin, shallowest, deepest]) => ({ atPin, shallowest, deepest }))(SITE_SEAFLOOR.sites[record.id]) : null,
      bathymetry: record && SITE_BATHYMETRY.sites[record.id]
        ? (([atPin, shallowest, deepest, source]) => ({ atPin, shallowest, deepest,
          source: SITE_BATHYMETRY.sources[source] }))(SITE_BATHYMETRY.sites[record.id]) : null,
      lakeDepth: record && SITE_LAKE_DEPTHS.sites[record.id]
        ? (([maxMeters, meanMeters, lakeName, source, url]) => ({ maxMeters, meanMeters,
          lakeName, published: source === 'wikidata', url: url || SITE_LAKE_DEPTHS.source.url }))(SITE_LAKE_DEPTHS.sites[record.id]) : null,
      nearbyDepths: record && !record.maxDepthMeters ? nearbyDepths(record) : null,
      shore: record && SITE_SHORE.sites[record.id]
        ? Object.fromEntries(SITE_SHORE.fields.map((kind, i) => [kind, SITE_SHORE.sites[record.id][i]])
          .filter(([, meters]) => meters != null)) : null,
      places: typeof message.id === 'string' ? placesForSite(message.id.slice(0, 80)) : [] };
  } catch {
    return { type: 'siteGuide', key, guide: null, places: [] };
  }
}

export function respond(message, options = {}) {
  if (!message || typeof message !== 'object') return null;
  if (message.type === 'siteGuide') return siteGuideMessage(message, options);
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
`;

esbuild.buildSync({ stdin: { contents: entry, resolveDir: appRoot, sourcefile: 'ocean-atlas-guide-entry.js',
  loader: 'js' }, bundle: true, platform: 'browser', format: 'iife', globalName: 'DMZAtlasGuideEngine',
  minify: true, target: ['es2020'], outfile: output, legalComments: 'inline' });
console.log(`Built ${output} (${fs.statSync(output).size.toLocaleString()} bytes).`);
