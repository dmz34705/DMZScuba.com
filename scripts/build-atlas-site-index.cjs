// Build the account planner's compact type-ahead index from the exact Atlas release on this site.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/atlas/v1/manifest.json'), 'utf8'));
const read = (key) => JSON.parse(fs.readFileSync(path.join(root, manifest.files[key].path.replace(/^\//, '')), 'utf8'));
const numbers = (value, size, getter) => {
  const bytes = Buffer.from(value, 'base64');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.length / size }, (_, index) => view[getter](index * size, true));
};
const basic = (site) => ({ id:site.id, name:site.name, latitude:site.latitude, longitude:site.longitude,
  country:site.country || '', area:site.region || '', maxDepthMeters:site.maxDepthMeters || null,
  topologies:site.topologies || [] });
const global = read('globalSites');
const ids = global.packedIds.match(/.{6}/g) || [];
const coords = numbers(global.coordinatesBase64, 4, 'getInt32');
const countries = numbers(global.countryIndexesBase64, 1, 'getUint8').map((value) => value - 1);
const depths = numbers(global.maxDepthsBase64, 2, 'getUint16');
const masks = new Map(global.topologyMasksByIndex || []);
const globalRows = ids.map((id, index) => ({ id:`odm-${id}`, name:global.names[index], latitude:coords[index * 2] / 1e5,
  longitude:coords[index * 2 + 1] / 1e5, country:global.countries[countries[index]] || '', area:'',
  maxDepthMeters:depths[index] || null, topologies:global.topologyCodes.filter((_, bit) => (masks.get(index) ?? global.defaults.topologyMask) & (1 << bit)) }));
const osm = read('osmSites');
const osmRows = osm.sites.map(([id,name,latitude,longitude,depth,,mask,fresh]) => ({ id:`osm-${id}`,name,latitude,longitude,
  country:'',area:'',maxDepthMeters:depth || null,topologies:[...(fresh ? ['freshwater'] : []),...osm.topologyCodes.filter((_,bit) => mask & (1 << bit))] }));
const extra = read('extraSites');
const extraRows = extra.sites.map(([id,name,latitude,longitude,depth,,mask,fresh]) => ({ id:`x-${id}`,name,latitude,longitude,
  country:'',area:'',maxDepthMeters:depth || null,topologies:[...(fresh ? ['freshwater'] : []),...extra.topologyCodes.filter((_,bit) => mask & (1 << bit))] }));
const closed = /edmund fitzgerald|uss arizona|uss utah|hms royal oak|richard montgomery/i;
const allRows = [...read('sites').map(basic), ...read('curatedSites').map(basic), ...globalRows, ...osmRows, ...extraRows]
  .filter((site) => site.name && Number.isFinite(site.latitude) && Number.isFinite(site.longitude) && !closed.test(site.name));
const byId = new Map(allRows.map((site) => [site.id, site]));
for (const [keepId, mergedIds, latitude, longitude, aliases, depth] of read('siteMerges').clusters || []) {
  const keep = byId.get(keepId);
  if (!keep) continue;
  Object.assign(keep, { latitude, longitude, aliases, maxDepthMeters:depth || keep.maxDepthMeters });
  for (const id of mergedIds) byId.delete(id);
}
const rows = [...byId.values()];
const output = { atlasVersion:manifest.version, publishedAt:manifest.publishedAt, count:rows.length,
  fields:['id','name','latitude','longitude','country','area','maxDepthMeters','topologies'],
  sites:rows.map((site) => [site.id,site.name,site.latitude,site.longitude,site.country,site.area,site.maxDepthMeters,site.topologies]) };
const destination = path.join(root, 'assets/data/atlas-site-index.json');
fs.writeFileSync(destination, `${JSON.stringify(output)}\n`);
console.log(`Built ${path.relative(root, destination)} with ${rows.length.toLocaleString()} current Atlas records (${manifest.version.slice(0, 12)}).`);
