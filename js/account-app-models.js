// Pure domain logic ported from dmzscuba-app at 48f7707.
// UI adapters use the same packing keys, component rules, readiness checks, timeline,
// and deterministic booking parsers as the app. See docs/account-app-port.md.

// src/features/gearChecklist/model.js
(() => {
'use strict';
const GEAR_CATEGORIES = Object.freeze([
  'Exposure suit', 'Undergarment', 'BCD', 'Regulator', 'Cylinder / tank', 'Fins', 'Boots', 'Hood', 'Gloves', 'Weights', 'Mask', 'Snorkel',
  'Dive computer', 'Transmitter', 'Gauges / compass', 'Lights', 'Camera', 'Cutting / signaling', 'Surface safety', 'Rebreather', 'DPV / scooter',
  'Bags / storage', 'Spare parts', 'Accessories',
]);

// Grouped the same GEAR_CATEGORIES for the "what are you adding?" picker so related gear sits together.
const CATEGORY_GROUPS = Object.freeze([
  { label: 'Life support', categories: ['Regulator', 'BCD', 'Cylinder / tank', 'Rebreather'] },
  { label: 'Exposure protection', categories: ['Exposure suit', 'Undergarment', 'Hood', 'Gloves', 'Boots'] },
  { label: 'Core kit', categories: ['Mask', 'Fins', 'Snorkel', 'Weights'] },
  { label: 'Instruments', categories: ['Dive computer', 'Transmitter', 'Gauges / compass'] },
  { label: 'Extras', categories: ['Lights', 'Camera', 'Cutting / signaling', 'Surface safety', 'DPV / scooter', 'Bags / storage', 'Spare parts', 'Accessories'] },
]);

// Categories with a guided, step-by-step add flow. Everything else in CATEGORY_GROUPS still opens
// the full form, pre-set to the chosen category, until its own guided flow is built.
const GUIDED_CATEGORIES = Object.freeze(['Regulator', 'BCD', 'Exposure suit', 'Undergarment', 'Cylinder / tank']);

const GEAR_CONDITIONS = Object.freeze(['Ready', 'Needs attention', 'Out of service', 'Retired']);
const SERVICE_INTERVALS = Object.freeze(['', '6', '12', '18', '24', '36', '60']);
const SETUP_TYPES = Object.freeze(['Single tank', 'Doubles', 'Sidemount', 'Pony / bailout', 'Stage / deco', 'Rebreather', 'Freedive', 'Travel', 'Custom']);
const REGULATOR_CONFIGURATIONS = Object.freeze(['Single tank', 'Doubles', 'Sidemount', 'Pony / bailout', 'Stage / deco', 'Full face mask', 'Second stage only', 'Custom']);
const TANK_CONFIGURATIONS = Object.freeze(['Single cylinder', 'Manifolded doubles', 'Independent doubles', 'Sidemount pair', 'Pony / bailout', 'Stage / deco', 'Custom']);
const BCD_STYLES = Object.freeze(['Jacket', 'Back-inflate', 'Wing', 'Backplate & wing', 'Sidemount']);
const EXPOSURE_SUIT_TYPES = Object.freeze(['Wetsuit', 'Drysuit']);
const WETSUIT_CUTS = Object.freeze(['Shorty', 'Full']);
const DRYSUIT_MATERIALS = Object.freeze(['Neoprene', 'Trilaminate', 'Membrane', 'Hybrid']);
const SEAL_MATERIALS = Object.freeze(['Latex', 'Silicone', 'Neoprene']);
const DRYSUIT_FEET_OPTIONS = Object.freeze(['Built-in boots', 'Socks']);
// Drysuit undergarments: one piece, a top and bottom, or a layer system — each piece is a tracked part.
const UNDERGARMENT_STYLES = Object.freeze(['One-piece', 'Two-piece', 'Layer system']);
const UNDERGARMENT_INSULATION = Object.freeze(['Thinsulate', 'Fleece', 'Primaloft', 'Octaloft', 'Merino wool', 'Synthetic pile', 'Other']);
// --- Cylinders -----------------------------------------------------------------------------------
// Each cylinder is its own locker item (own serial, hydro and visual dates). Doubles and sidemount
// pairs are a set item that links its two cylinders through accessoryItemIds, plus the parts that
// belong to the set itself (manifold, bands).
const CYLINDER_SETUPS = Object.freeze(['Single tank', 'Doubles', 'Sidemount pair', 'Pony / bailout', 'Stage / deco']);
const CYLINDER_MATERIALS = Object.freeze(['Aluminum', 'Steel', 'Composite']);
const VALVE_TYPES = Object.freeze(['DIN', 'Yoke', 'Convertible (pro valve)']);
const CYLINDER_COLORS = Object.freeze(['Yellow', 'Silver / bare', 'Grey', 'Black', 'White', 'Blue', 'Red', 'Green', 'Orange']);
// Common cylinders: rated gas capacity (cu ft), water volume (L) and working pressure.
const CYLINDER_PRESETS = Object.freeze([
  { label: 'AL80', material: 'Aluminum', cuft: 77.4, liters: 11.1, psi: 3000, bar: 207 },
  { label: 'AL63', material: 'Aluminum', cuft: 63, liters: 9, psi: 3000, bar: 207 },
  { label: 'AL40', material: 'Aluminum', cuft: 40, liters: 5.7, psi: 3000, bar: 207 },
  { label: 'AL30', material: 'Aluminum', cuft: 30, liters: 4.3, psi: 3000, bar: 207 },
  { label: 'AL100', material: 'Aluminum', cuft: 100, liters: 13.2, psi: 3300, bar: 228 },
  { label: 'HP100', material: 'Steel', cuft: 100, liters: 12.9, psi: 3442, bar: 237 },
  { label: 'HP120', material: 'Steel', cuft: 120, liters: 15.3, psi: 3442, bar: 237 },
  { label: 'LP85', material: 'Steel', cuft: 85, liters: 13.1, psi: 2640, bar: 182 },
  { label: '12 L · 232 bar', material: 'Steel', cuft: null, liters: 12, psi: 3365, bar: 232 },
  { label: '15 L · 232 bar', material: 'Steel', cuft: null, liters: 15, psi: 3365, bar: 232 },
  { label: '7 L · 232 bar', material: 'Steel', cuft: null, liters: 7, psi: 3365, bar: 232 },
]);
// US DOT: hydrostatic test every 5 years; industry practice: visual inspection (VIP) every year.
// Local rules differ, so these only pre-fill due dates the diver can change.
const HYDRO_INTERVAL_MONTHS = 60;
const VISUAL_INTERVAL_MONTHS = 12;

const COMPONENT_TYPES = Object.freeze({
  Regulator: ['First stage', 'Primary second stage', 'Alternate second stage', 'Second stage', 'Breathing hose', 'Inflator hose', 'Drysuit hose', 'High-pressure hose', 'SPG / pressure gauge', 'Gauge console', 'Wireless transmitter', 'Full face mask', 'Quick disconnect', 'Communications unit', 'Other'],
  'Cylinder / tank': ['Cylinder', 'Valve', 'Manifold', 'Bands', 'Boot', 'Other'],
  BCD: ['Bladder', 'Inflator (LPI)', 'Integrated alternate (Air2/Airsource)', 'Weight pocket', 'Trim pocket', 'Corrugated hose', 'Dump valve', 'Cam / tank strap', 'D-ring', 'Other'],
  Undergarment: ['One-piece suit', 'Top', 'Bottom', 'Base layer', 'Mid layer', 'Vest', 'Socks', 'Heating system', 'Battery', 'Other'],
  'Exposure suit': ['Suit body', 'Hood', 'Gloves', 'Dry gloves', 'Boots', 'Seals', 'Undergarment', 'Base layer', 'Mid layer', 'Rashguard', 'Socks', 'Other'],
  default: ['Primary component', 'Accessory', 'Hardware', 'Other'],
});
const GEAR_STATE_VERSION = 2;

function createGearId(prefix = 'gear') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyGearComponent(category = 'Regulator', type) {
  const componentTypes = COMPONENT_TYPES[category] || COMPONENT_TYPES.default;
  return {
    id: '', type: type || componentTypes[0], name: '', manufacturer: '', model: '', serialNumber: '', condition: GEAR_CONDITIONS[0],
    lastServiceDate: '', nextServiceDate: '', serviceIntervalMonths: '', notes: '',
  };
}

// Hoses are replaceable consumables identified by type/length, not serial number. Other tracked
// hardware may have one, so its editor keeps an optional field without trying to guess by brand.
function componentCanHaveSerial(type) {
  return !String(type || '').toLowerCase().includes('hose');
}

function regulatorComponentTemplate(configuration = 'Single tank') {
  const templates = {
    Doubles: [
      ['First stage', 'Left post first stage'], ['First stage', 'Right post first stage'], ['Primary second stage', 'Primary second stage'],
      ['Alternate second stage', 'Backup necklace second stage'], ['Breathing hose', 'Primary long hose'], ['Breathing hose', 'Backup necklace hose'],
      ['Inflator hose', 'BCD inflator hose'], ['High-pressure hose', 'SPG hose'], ['SPG / pressure gauge', 'SPG'],
    ],
    Sidemount: [
      ['First stage', 'Left cylinder first stage'], ['First stage', 'Right cylinder first stage'], ['Second stage', 'Left second stage'],
      ['Second stage', 'Right second stage'], ['Breathing hose', 'Left breathing hose'], ['Breathing hose', 'Right breathing hose'],
      ['Inflator hose', 'BCD inflator hose'], ['High-pressure hose', 'Left SPG hose'], ['High-pressure hose', 'Right SPG hose'],
      ['SPG / pressure gauge', 'Left SPG'], ['SPG / pressure gauge', 'Right SPG'],
    ],
    'Pony / bailout': [['First stage', 'First stage'], ['Second stage', 'Second stage'], ['Breathing hose', 'Breathing hose'], ['High-pressure hose', 'SPG hose'], ['SPG / pressure gauge', 'SPG']],
    'Stage / deco': [['First stage', 'First stage'], ['Second stage', 'Second stage'], ['Breathing hose', 'Breathing hose'], ['High-pressure hose', 'SPG hose'], ['SPG / pressure gauge', 'SPG']],
    Custom: [],
    'Single tank': [
      ['First stage', 'First stage'], ['Primary second stage', 'Primary second stage'], ['Alternate second stage', 'Alternate second stage'],
      ['Breathing hose', 'Primary breathing hose'], ['Breathing hose', 'Alternate breathing hose'], ['Inflator hose', 'BCD inflator hose'],
      ['High-pressure hose', 'SPG hose'], ['SPG / pressure gauge', 'SPG'],
    ],
  };
  return (templates[configuration] || templates['Single tank']).map(([type, name]) => ({ ...emptyGearComponent('Regulator', type), type, name }));
}

function tankComponentTemplate(configuration = 'Single cylinder') {
  if (configuration === 'Manifolded doubles') return [
    ['Cylinder', 'Left cylinder'], ['Cylinder', 'Right cylinder'], ['Valve', 'Left valve'], ['Valve', 'Right valve'],
    ['Manifold', 'Isolation manifold'], ['Bands', 'Tank bands'],
  ].map(([type, name]) => ({ ...emptyGearComponent('Cylinder / tank', type), type, name }));
  if (['Independent doubles', 'Sidemount pair'].includes(configuration)) return [
    ['Cylinder', 'Left cylinder'], ['Cylinder', 'Right cylinder'], ['Valve', 'Left valve'], ['Valve', 'Right valve'],
  ].map(([type, name]) => ({ ...emptyGearComponent('Cylinder / tank', type), type, name }));
  return [['Cylinder', 'Cylinder'], ['Valve', 'Valve']].map(([type, name]) => ({ ...emptyGearComponent('Cylinder / tank', type), type, name }));
}

function bcdComponentTemplate() {
  return [['Bladder', 'Bladder'], ['Inflator (LPI)', 'Inflator (LPI)'], ['Weight pocket', 'Releasable weight pockets'], ['Trim pocket', 'Fixed trim pockets']]
    .map(([type, name]) => ({ ...emptyGearComponent('BCD', type), type, name }));
}

function exposureComponentTemplate() {
  return [['Suit body', 'Suit'], ['Hood', 'Hood'], ['Gloves', 'Gloves'], ['Boots', 'Boots']]
    .map(([type, name]) => ({ ...emptyGearComponent('Exposure suit', type), type, name }));
}

// Pieces an undergarment of this style usually comes in.
function undergarmentComponentTemplate(style = 'Two-piece') {
  const pieces = style === 'One-piece' ? [['One-piece suit', 'Undersuit']] : style === 'Layer system' ? [['Base layer', 'Base layer'], ['Mid layer', 'Mid layer']] : [['Top', 'Top'], ['Bottom', 'Bottom']];
  return pieces.map(([type, name]) => ({ ...emptyGearComponent('Undergarment', type), type, name }));
}

function emptyGearItem() {
  return {
    id: '', name: '', category: GEAR_CATEGORIES[0], condition: GEAR_CONDITIONS[0], manufacturer: '', model: '', serialNumber: '',
    quantity: '1', size: '', thickness: '', color: '', weight: '', capacity: '', workingPressure: '', configuration: '',
    isAssembly: false, components: [], lastServiceDate: '', nextServiceDate: '', serviceIntervalMonths: '', visualInspectionDue: '',
    hydrostaticTestDue: '', lastHydrostaticTest: '', lastVisualInspection: '', material: '', valveType: '', serviceNotes: '', purchaseDate: '', purchasePrice: '', retailer: '', warrantyUntil: '', notes: '',
    attachments: [], setupIds: [], accessoryItemIds: [],
    // Floating gear (a transmitter, a full-face mask) moves between setups; currentSetupId is
    // where it physically is right now ('' = not on any setup).
    floating: false, currentSetupId: '',
    // Set on dive computers the logbook has downloaded from (vendor|product|serial).
    deviceKey: '',
  };
}

function emptyGearSetup() {
  return { id: '', name: '', type: SETUP_TYPES[0], description: '', itemIds: [], checkedIds: [], accessoryChoices: {}, completeness: { skipped: [], done: false, type: SETUP_TYPES[0] } };
}

const emptyGearList = emptyGearSetup;

function createInitialGearState(now = new Date()) {
  const stamp = now.toISOString();
  return {
    version: GEAR_STATE_VERSION,
    items: [],
    dismissedDeviceKeys: [],
    setups: [
      { id: 'setup-single-tank', name: 'Single Tank', type: 'Single tank', description: 'Primary recreational backmount configuration.', itemIds: [], checkedIds: [], createdAt: stamp, updatedAt: stamp },
      { id: 'setup-doubles', name: 'Doubles', type: 'Doubles', description: 'Backmount doubles configuration.', itemIds: [], checkedIds: [], createdAt: stamp, updatedAt: stamp },
      { id: 'setup-sidemount', name: 'Sidemount', type: 'Sidemount', description: 'Independent sidemount configuration.', itemIds: [], checkedIds: [], createdAt: stamp, updatedAt: stamp },
    ],
  };
}

function cleanText(value) { return typeof value === 'string' ? value.trim() : ''; }
function uniqueIds(value) { return [...new Set((Array.isArray(value) ? value : []).filter((id) => typeof id === 'string' && id))]; }

function normalizeAttachment(value) {
  if (!value || typeof value.uri !== 'string' || !value.uri) return null;
  return {
    id: cleanText(value.id) || createGearId('attachment'), kind: value.kind === 'photo' ? 'photo' : 'document', uri: value.uri,
    name: cleanText(value.name) || (value.kind === 'photo' ? 'Gear photo' : 'Document'), mimeType: cleanText(value.mimeType),
    size: Number.isFinite(value.size) ? value.size : null,
  };
}

function normalizeGearComponent(value = {}, category = 'Regulator') {
  const fallback = emptyGearComponent(category);
  const allowedTypes = COMPONENT_TYPES[category] || COMPONENT_TYPES.default;
  return {
    ...fallback,
    ...Object.fromEntries(Object.keys(fallback).filter((key) => typeof fallback[key] === 'string').map((key) => [key, cleanText(value[key])])),
    id: cleanText(value.id) || createGearId('component'),
    type: allowedTypes.includes(value.type) ? value.type : 'Other',
    name: cleanText(value.name) || cleanText(value.type) || 'Unnamed component',
    condition: GEAR_CONDITIONS.includes(value.condition) ? value.condition : 'Ready',
  };
}

function normalizeGearItem(value = {}, now = new Date()) {
  const fallback = emptyGearItem();
  const category = GEAR_CATEGORIES.includes(value.category) ? value.category : 'Accessories';
  const components = (Array.isArray(value.components) ? value.components : []).map((component) => normalizeGearComponent(component, category));
  const configurationOptions = category === 'Regulator' ? REGULATOR_CONFIGURATIONS : category === 'Cylinder / tank' ? TANK_CONFIGURATIONS : category === 'BCD' ? BCD_STYLES : category === 'Exposure suit' ? EXPOSURE_SUIT_TYPES : category === 'Undergarment' ? UNDERGARMENT_STYLES : [];
  const normalized = {
    ...fallback,
    ...Object.fromEntries(Object.keys(fallback).filter((key) => typeof fallback[key] === 'string').map((key) => [key, cleanText(value[key])])),
    id: cleanText(value.id) || createGearId(), category,
    condition: GEAR_CONDITIONS.includes(value.condition) ? value.condition : 'Ready', quantity: cleanText(value.quantity) || '1',
    configuration: configurationOptions.includes(value.configuration) ? value.configuration : '', isAssembly: Boolean(value.isAssembly || components.length),
    components, attachments: (Array.isArray(value.attachments) ? value.attachments : []).map(normalizeAttachment).filter(Boolean),
    accessoryItemIds: uniqueIds(value.accessoryItemIds),
    floating: value.floating === true, currentSetupId: value.floating === true ? cleanText(value.currentSetupId) : '',
    createdAt: cleanText(value.createdAt) || now.toISOString(), updatedAt: now.toISOString(),
  };
  delete normalized.listIds;
  delete normalized.setupIds;
  return normalized;
}

function normalizeGearSetup(value = {}, now = new Date()) {
  const itemIds = uniqueIds(value.itemIds);
  const type = SETUP_TYPES.includes(value.type) ? value.type : 'Custom';
  // A different setup type needs different gear, so its completeness review starts over.
  const reviewedType = SETUP_TYPES.includes(value.completeness?.type) ? value.completeness.type : type;
  const review = reviewedType === type ? value.completeness : null;
  return {
    id: cleanText(value.id) || createGearId('setup'), name: cleanText(value.name) || 'Untitled setup',
    type: SETUP_TYPES.includes(value.type) ? value.type : 'Custom', description: cleanText(value.description), itemIds,
    checkedIds: uniqueIds(value.checkedIds).filter((id) => itemIds.includes(checklistItemIdForKey(id))), createdAt: cleanText(value.createdAt) || now.toISOString(),
    // The day the quick-dive checklist was last ticked (YYYY-MM-DD); see clearStalePacking.
    checkedOn: /^d{4}-d{2}-d{2}$/.test(value.checkedOn || '') ? value.checkedOn : '',
    // The one-time "is this setup complete?" review: requirement keys the diver chose to leave out,
    // and whether the review has been finished (after which it only shows as a summary).
    completeness: { skipped: uniqueIds(review?.skipped), done: review?.done === true, type },
    // Per item in this setup: which of its alternative accessories to pack (itemId → accessory ids).
    accessoryChoices: Object.fromEntries(Object.entries(value.accessoryChoices && typeof value.accessoryChoices === 'object' ? value.accessoryChoices : {})
      .filter(([itemId]) => itemIds.includes(itemId)).map(([itemId, ids]) => [itemId, uniqueIds(ids)])),
    updatedAt: now.toISOString(),
  };
}

const normalizeGearList = normalizeGearSetup;

function normalizeGearState(value) {
  if (!value || typeof value !== 'object') return createInitialGearState();
  const rawItems = (Array.isArray(value.items) ? value.items : []).map((item) => normalizeGearItem(item));
  const itemIds = new Set(rawItems.map((item) => item.id));
  const sourceSetups = Array.isArray(value.setups) ? value.setups : Array.isArray(value.lists) ? value.lists : [];
  const sourceSetupIds = new Set(sourceSetups.map((setup) => setup?.id).filter(Boolean));
  // Undergarments are picked per setup, so they're never linked to a drysuit (either direction).
  const categoryOf = new Map(rawItems.map((item) => [item.id, item.category]));
  const suitUnderLink = (item, id) => (item.category === 'Exposure suit' && categoryOf.get(id) === 'Undergarment') || (item.category === 'Undergarment' && categoryOf.get(id) === 'Exposure suit');
  // A regulator and its pony / bailout cylinder are peers: each has its own service and inspection
  // life, and each belongs under its own setup heading. Old links are promoted into setup membership.
  const lifeSupportLink = (item, id) => new Set([item.category, categoryOf.get(id)]).size === 2
    && [item.category, categoryOf.get(id)].every((category) => ['Regulator', 'Cylinder / tank'].includes(category));
  const lifeSupportPeers = new Map(rawItems.map((item) => [item.id, item.accessoryItemIds.filter((id) => itemIds.has(id) && lifeSupportLink(item, id))]));
  const items = rawItems.map((item) => ({
    ...item, accessoryItemIds: item.accessoryItemIds.filter((id) => itemIds.has(id) && id !== item.id && !suitUnderLink(item, id) && !lifeSupportLink(item, id)),
    currentSetupId: item.currentSetupId && sourceSetupIds.has(item.currentSetupId) ? item.currentSetupId : '',
  }));
  const setups = sourceSetups.map((setup) => {
    const normalized = normalizeGearSetup(setup);
    const selected = new Set(normalized.itemIds.filter((id) => itemIds.has(id)));
    for (const id of [...selected]) for (const peerId of lifeSupportPeers.get(id) || []) selected.add(peerId);
    normalized.itemIds = [...selected];
    // Preserve a packed old-style linked cylinder/regulator as its new top-level checkbox.
    normalized.checkedIds = [...new Set(normalized.checkedIds.map((id) => {
      const [parentId, kind, linkedId] = id.split(CHECKLIST_KEY_SEPARATOR);
      return kind === 'accessory' && (lifeSupportPeers.get(parentId) || []).includes(linkedId) ? linkedId : id;
    }))].filter((id) => itemIds.has(checklistItemIdForKey(id)));
    // A choice whose undergarments were all deleted is asked again (an explicit "none" stays none).
    normalized.accessoryChoices = Object.fromEntries(Object.entries(normalized.accessoryChoices)
      .map(([itemId, ids]) => [itemId, ids, ids.filter((id) => itemIds.has(id))])
      .filter(([, ids, kept]) => !ids.length || kept.length).map(([itemId, , kept]) => [itemId, kept]));
    return normalized;
  });
  const dismissedDeviceKeys = [...new Set((Array.isArray(value.dismissedDeviceKeys) ? value.dismissedDeviceKeys : []).filter((key) => typeof key === 'string' && key))];
  return { version: GEAR_STATE_VERSION, items, setups, dismissedDeviceKeys };
}

function setupIdsForItem(setups, itemId) {
  return (Array.isArray(setups) ? setups : []).filter((setup) => setup.itemIds.includes(itemId)).map((setup) => setup.id);
}
const listIdsForItem = setupIdsForItem;

// Assemblies (a drysuit, a BCD) can link out to real standalone locker items — a hood or a pair
// of boots you already own or quick-add through the guided wizard — instead of describing them a
// second time as a buried component. The link lives as accessoryItemIds on the parent; these two
// helpers walk it in each direction for the detail view.
function accessoryItemsForItem(items, item) {
  const byId = new Map((Array.isArray(items) ? items : []).map((entry) => [entry.id, entry]));
  return (item?.accessoryItemIds || []).map((id) => byId.get(id)).filter(Boolean);
}

function parentItemsForAccessory(items, itemId) {
  return (Array.isArray(items) ? items : []).filter((entry) => (entry.accessoryItemIds || []).includes(itemId));
}

const CHECKLIST_KEY_SEPARATOR = '::';

// A setup's packing checklist checks off whole items by id — fine for a mask or a single fin, but
// a drysuit with a hood, dry gloves, and boots is one item hiding several forgettable pieces.
// checklistEntriesForItem expands an item into every checkable piece: the item itself, each
// tracked component, and each linked accessory — so checking "the drysuit" off doesn't silently
// mark the hood and boots as packed too. Keys are itemId::component::id / itemId::accessory::id;
// a plain item with no parts keeps its bare id as its only (and whole) entry.
//
// When a setup is given, linked accessories that are alternatives (see accessoryAlternatives) are
// narrowed to the ones that setup packs; `unresolved` lists the choices the setup hasn't made yet.
function checklistEntriesForItem(item, items, setup = null) {
  // A cylinder — or a doubles set / sidemount pair with its valves, manifold and bands — is one
  // physical thing on the dock: one checkbox, however many parts it tracks.
  if (item?.category === 'Cylinder / tank') return { itemKey: item.id, parts: [], unresolved: [] };
  const { packed, unresolved } = packedAccessories(item, items, setup);
  const parts = [
    ...(item?.components || []).map((component) => ({ key: `${item.id}${CHECKLIST_KEY_SEPARATOR}component${CHECKLIST_KEY_SEPARATOR}${component.id}`, label: component.name, meta: component.type })),
    // A linked item that comes in pieces (a two-piece undersuit) lists each piece to check off too.
    ...packed.flatMap((accessory) => {
      const key = `${item.id}${CHECKLIST_KEY_SEPARATOR}accessory${CHECKLIST_KEY_SEPARATOR}${accessory.id}`;
      return [
        { key, label: accessory.name, meta: accessory.category, linkedItemId: accessory.id },
        ...(accessory.components || []).map((component) => ({ key: `${key}${CHECKLIST_KEY_SEPARATOR}component${CHECKLIST_KEY_SEPARATOR}${component.id}`, label: `${accessory.name} · ${component.name}`, meta: component.type, linkedItemId: accessory.id, piece: true })),
      ];
    }),
  ];
  return { itemKey: item.id, parts, unresolved };
}

// Drysuit undergarments are chosen per setup, not linked to the suit: any setup with a drysuit asks
// which undergarment(s) it packs, from every undergarment in the locker (or none). The answer lives in
// setup.accessoryChoices[drysuitId] — no key yet means the setup hasn't been asked.
const isDrysuit = (item) => item?.category === 'Exposure suit' && item.configuration !== 'Wetsuit';
const undergarmentsIn = (items) => (Array.isArray(items) ? items : []).filter((entry) => entry.category === 'Undergarment');

// The choice an item offers a setup: a drysuit → the locker's undergarments. Nothing else asks.
function accessoryAlternatives(item, items) {
  if (!isDrysuit(item)) return [];
  const options = undergarmentsIn(items);
  return options.length ? [{ category: 'Undergarment', options }] : [];
}

// Linked gear always packs with its item (the drysuit's hood and boots); in a setup, a drysuit also
// packs the undergarment(s) chosen for it, or asks (`unresolved`) if the setup hasn't said yet.
function packedAccessories(item, items, setup = null) {
  const linked = accessoryItemsForItem(items, item);
  if (!setup || !isDrysuit(item)) return { packed: linked, unresolved: [] };
  const alternatives = accessoryAlternatives(item, items);
  const answered = Object.prototype.hasOwnProperty.call(setup.accessoryChoices || {}, item.id);
  const chosen = new Set(setup.accessoryChoices?.[item.id] || []);
  const undergarments = undergarmentsIn(items).filter((entry) => chosen.has(entry.id) && !linked.some((link) => link.id === entry.id));
  return { packed: [...linked, ...undergarments], unresolved: answered ? [] : alternatives };
}

// Sets which of an item's alternative accessories a setup packs, and un-checks any it no longer packs.
function setAccessoryChoice(setup, itemId, accessoryIds, items, now = new Date()) {
  const chosen = uniqueIds(accessoryIds);
  const accessoryChoices = { ...(setup.accessoryChoices || {}), [itemId]: chosen };
  // Only alternatives that stop being packed are un-checked — the drysuit's boots stay checked.
  const item = (Array.isArray(items) ? items : []).find((entry) => entry.id === itemId);
  const optionIds = new Set(item ? accessoryAlternatives(item, items).flatMap((group) => group.options.map((option) => option.id)) : []);
  const prefix = `${itemId}${CHECKLIST_KEY_SEPARATOR}accessory${CHECKLIST_KEY_SEPARATOR}`;
  const checkedIds = setup.checkedIds.filter((key) => {
    if (!key.startsWith(prefix)) return true;
    const accessoryId = key.slice(prefix.length).split(CHECKLIST_KEY_SEPARATOR)[0];
    return !optionIds.has(accessoryId) || chosen.includes(accessoryId);
  });
  return { ...setup, accessoryChoices, checkedIds, updatedAt: now.toISOString() };
}

function checklistItemIdForKey(key) {
  const separatorIndex = typeof key === 'string' ? key.indexOf(CHECKLIST_KEY_SEPARATOR) : -1;
  return separatorIndex === -1 ? key : key.slice(0, separatorIndex);
}

function assignItemToSetups(setups, itemId, selectedSetupIds, now = new Date()) {
  const selected = new Set(uniqueIds(selectedSetupIds));
  return setups.map((setup) => {
    const alreadyIncluded = setup.itemIds.includes(itemId);
    const shouldInclude = selected.has(setup.id);
    if (alreadyIncluded === shouldInclude) return setup;
    return {
      ...setup, itemIds: shouldInclude ? [...setup.itemIds, itemId] : setup.itemIds.filter((id) => id !== itemId),
      checkedIds: shouldInclude ? setup.checkedIds : setup.checkedIds.filter((id) => id !== itemId), updatedAt: now.toISOString(),
    };
  });
}
const assignItemToLists = assignItemToSetups;

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function addMonths(date, months) { const result = new Date(date.getTime()); result.setUTCMonth(result.getUTCMonth() + months); return result; }
function formatDateOnly(date) { return date ? date.toISOString().slice(0, 10) : ''; }

// Keep the visible next-service field in sync as the diver supplies either half of a recurring
// schedule. An explicitly typed next date remains editable and is only replaced when the last
// service date or interval changes again with enough information to calculate a new one.
function updateServiceSchedule(record, patch) {
  const next = { ...record, ...patch };
  const interval = Number(next.serviceIntervalMonths);
  const calculated = Number.isFinite(interval) && interval > 0 ? addMonthsToDateOnly(next.lastServiceDate, interval) : '';
  return calculated ? { ...next, nextServiceDate: calculated } : next;
}

function serviceDueForItem(item) {
  const candidates = [];
  const explicit = parseDateOnly(item?.nextServiceDate);
  if (explicit) candidates.push({ date: explicit, label: 'Service' });
  if (!explicit) {
    const last = parseDateOnly(item?.lastServiceDate);
    const interval = Number(item?.serviceIntervalMonths);
    if (last && Number.isFinite(interval) && interval > 0) candidates.push({ date: addMonths(last, interval), label: 'Service' });
  }
  const visual = parseDateOnly(item?.visualInspectionDue);
  if (visual) candidates.push({ date: visual, label: 'Visual inspection' });
  const hydro = parseDateOnly(item?.hydrostaticTestDue);
  if (hydro) candidates.push({ date: hydro, label: 'Hydrostatic test' });
  return candidates.sort((a, b) => a.date - b.date)[0] || null;
}

function serviceStatusForItem(item, now = new Date()) {
  if (item?.condition === 'Out of service') return { key: 'blocked', label: 'OUT OF SERVICE', tone: 'danger', due: null, days: null };
  if (item?.condition === 'Needs attention') return { key: 'attention', label: 'NEEDS ATTENTION', tone: 'warning', due: serviceDueForItem(item), days: null };
  if (item?.condition === 'Retired') return { key: 'retired', label: 'RETIRED', tone: 'muted', due: null, days: null };
  const due = serviceDueForItem(item);
  if (!due) return { key: 'none', label: 'NO SERVICE DATE', tone: 'muted', due: null, days: null };
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  const days = Math.ceil((due.date - today) / 86400000);
  if (days < 0) return { key: 'overdue', label: `${due.label.toUpperCase()} OVERDUE`, tone: 'danger', due, days };
  if (days <= 30) return { key: 'due-soon', label: `${due.label.toUpperCase()} DUE SOON`, tone: 'warning', due, days };
  return { key: 'current', label: `${due.label.toUpperCase()} CURRENT`, tone: 'good', due, days };
}

function serviceStatusForAssembly(item, now = new Date()) {
  const priority = { blocked: 6, attention: 5, overdue: 4, 'due-soon': 3, current: 2, none: 1, retired: 0 };
  const entries = serviceEntriesForItem(item).map((entry) => ({ entry, status: serviceStatusForItem(entry.record, now) }));
  const worst = entries.sort((a, b) => (priority[b.status.key] || 0) - (priority[a.status.key] || 0))[0];
  if (!worst) return serviceStatusForItem(item, now);
  if (worst.entry.parentId && priority[worst.status.key] >= priority['due-soon']) {
    return { ...worst.status, label: `PART: ${worst.status.label}` };
  }
  return worst.status;
}

function serviceEntriesForItem(item) {
  return [
    { id: item.id, parentId: null, name: item.name, category: item.category, record: item },
    ...(item.components || []).map((component) => ({ id: component.id, parentId: item.id, name: component.name, category: component.type, record: component })),
  ];
}

// The Gear Locker's grouped view: gear folded into the CATEGORY_GROUPS families, each with its
// categories (in family order) and how many items need attention, so a collapsed family still
// shows where the problems are. `items` arrive already searched, filtered and sorted.
const ATTENTION_STATUSES = Object.freeze(['blocked', 'attention', 'overdue', 'due-soon']);
function groupGearByFamily(items, allItems = items, now = new Date()) {
  const list = Array.isArray(items) ? items : [];
  const known = new Set(CATEGORY_GROUPS.flatMap((group) => group.categories));
  const families = [...CATEGORY_GROUPS, { label: 'Other', categories: [...new Set(list.map((item) => item.category).filter((category) => !known.has(category)))] }];
  return families.map((family) => {
    const categories = family.categories
      .map((category) => ({ category, items: list.filter((item) => item.category === category) }))
      .filter((group) => group.items.length);
    const members = categories.flatMap((group) => group.items);
    const statuses = members.map((item) => serviceStatusForSet(item, allItems, now));
    const attention = statuses.filter((status) => ATTENTION_STATUSES.includes(status.key)).length;
    const urgent = statuses.some((status) => status.tone === 'danger');
    return { label: family.label, categories, count: members.length, attention, tone: attention ? (urgent ? 'danger' : 'warning') : 'good' };
  }).filter((family) => family.count);
}

function gearSummary(state, now = new Date()) {
  const items = Array.isArray(state?.items) ? state.items : [];
  const statuses = items.flatMap(serviceEntriesForItem).map((entry) => serviceStatusForItem(entry.record, now));
  // Cylinders inside a doubles set / sidemount pair count as parts of that set, not as gear.
  const members = cylinderSetMemberIds(items);
  return {
    total: items.length - members.size, components: items.reduce((sum, item) => sum + (item.components?.length || 0), 0) + members.size,
    ready: items.filter((item) => item.condition === 'Ready').length,
    alerts: statuses.filter((status) => ['blocked', 'attention', 'overdue', 'due-soon'].includes(status.key)).length,
    documents: items.reduce((sum, item) => sum + (Array.isArray(item.attachments) ? item.attachments.length : 0), 0),
  };
}

// Counts every checkable piece (each item, plus each of its tracked parts and linked
// accessories) rather than just top-level items, so "packed" reflects the hood and boots too,
// not just whether the drysuit itself got checked.
function setupProgress(setup, items) {
  const byId = new Map((Array.isArray(items) ? items : []).map((entry) => [entry.id, entry]));
  const checkedSet = new Set(Array.isArray(setup?.checkedIds) ? setup.checkedIds : []);
  let total = 0;
  let checked = 0;
  const packedWith = includedWithSelection(setup?.itemIds, items, setup?.accessoryChoices);
  (Array.isArray(setup?.itemIds) ? setup.itemIds : []).forEach((itemId) => {
    const item = byId.get(itemId);
    if (!item || packedWith.has(itemId)) return; // already counted as part of its parent
    const { itemKey, parts } = checklistEntriesForItem(item, items, setup);
    total += 1 + parts.length;
    if (checkedSet.has(itemKey)) checked += 1;
    parts.forEach((part) => { if (checkedSet.has(part.key)) checked += 1; });
  });
  return { total, checked, ratio: total ? checked / total : 0 };
}
const checklistProgress = setupProgress;

function sortGear(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const category = GEAR_CATEGORIES.indexOf(a.category) - GEAR_CATEGORIES.indexOf(b.category);
    return category || a.name.localeCompare(b.name);
  });
}

const GEAR_SORT_OPTIONS = Object.freeze(['Category', 'Name', 'Manufacturer', 'Service urgency', 'Recently added']);
const GEAR_SERVICE_FILTERS = Object.freeze(['Any service status', 'Needs action', 'Overdue / blocked', 'Current', 'Not tracked']);
const GEAR_LOCATION_FILTERS = Object.freeze(['Any setup status', 'In a setup', 'Unassigned', 'Floating']);

function filterGear(items, filters = {}, setups = [], now = new Date()) {
  const list = Array.isArray(items) ? items : [];
  const packedIds = new Set((Array.isArray(setups) ? setups : []).flatMap((setup) => packedItems(setup, list).map((item) => item.id)));
  return list.filter((item) => {
    if (filters.category && filters.category !== 'All' && filters.category !== item.category && !(filters.category === 'Floating' && item.floating)) return false;
    if (filters.condition && filters.condition !== 'Any condition' && item.condition !== filters.condition) return false;
    const status = serviceStatusForAssembly(item, now).key;
    if (filters.service === 'Needs action' && !['blocked', 'attention', 'overdue', 'due-soon'].includes(status)) return false;
    if (filters.service === 'Overdue / blocked' && !['blocked', 'overdue'].includes(status)) return false;
    if (filters.service === 'Current' && status !== 'current') return false;
    if (filters.service === 'Not tracked' && status !== 'none') return false;
    if (filters.location === 'In a setup' && !packedIds.has(item.id)) return false;
    if (filters.location === 'Unassigned' && packedIds.has(item.id)) return false;
    if (filters.location === 'Floating' && !item.floating) return false;
    return true;
  });
}

function sortGearBy(items, sort = 'Category', now = new Date()) {
  const list = [...(Array.isArray(items) ? items : [])];
  const text = (value) => String(value || '').toLocaleLowerCase();
  const byName = (a, b) => text(a.name).localeCompare(text(b.name));
  if (sort === 'Name') return list.sort(byName);
  if (sort === 'Manufacturer') return list.sort((a, b) => text(a.manufacturer).localeCompare(text(b.manufacturer)) || byName(a, b));
  if (sort === 'Recently added') return list.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0) || byName(a, b));
  if (sort === 'Service urgency') {
    const priority = { blocked: 0, overdue: 1, attention: 2, 'due-soon': 3, current: 4, none: 5, retired: 6 };
    return list.sort((a, b) => (priority[serviceStatusForAssembly(a, now).key] ?? 9) - (priority[serviceStatusForAssembly(b, now).key] ?? 9) || byName(a, b));
  }
  return sortGear(list);
}

// --- Cylinder helpers ------------------------------------------------------------------------------
function addMonthsToDateOnly(value, months) {
  const date = parseDateOnly(value);
  return date ? formatDateOnly(addMonths(date, months)) : '';
}

// "77.4 cu ft · 11.1 L" / "3000 psi · 207 bar" — both units, so either reads naturally.
function presetCapacity(preset) {
  return [preset.cuft ? `${preset.cuft} cu ft` : '', preset.liters ? `${preset.liters} L` : ''].filter(Boolean).join(' · ');
}
function presetPressure(preset) {
  return `${preset.psi} psi · ${preset.bar} bar`;
}

// A cylinder set (doubles / sidemount pair) is the set item plus the cylinders it links.
const isCylinderSet = (item) => item?.category === 'Cylinder / tank' && ['Manifolded doubles', 'Independent doubles', 'Sidemount pair'].includes(item.configuration);

// Cylinders not already in a set — the ones a new doubles / sidemount set can link.
function unpairedCylinders(items) {
  const list = Array.isArray(items) ? items : [];
  const inSets = new Set(list.filter(isCylinderSet).flatMap((set) => set.accessoryItemIds || []));
  return list.filter((item) => item.category === 'Cylinder / tank' && !isCylinderSet(item) && !inSets.has(item.id));
}

// Worst service state across an assembly's own parts and the items it links (a set's cylinders,
// a drysuit's boots), so a doubles set shows "HYDRO OVERDUE" when one of its cylinders is.
function serviceStatusForSet(item, items, now = new Date()) {
  const priority = { blocked: 6, attention: 5, overdue: 4, 'due-soon': 3, current: 2, none: 1, retired: 0 };
  const own = serviceStatusForAssembly(item, now);
  const linked = accessoryItemsForItem(items, item).map((entry) => ({ entry, status: serviceStatusForAssembly(entry, now) }))
    .sort((a, b) => (priority[b.status.key] || 0) - (priority[a.status.key] || 0))[0];
  if (!linked || (priority[linked.status.key] || 0) <= (priority[own.key] || 0) || (priority[linked.status.key] || 0) < priority['due-soon']) return own;
  // "Double HP100s · Right" inside "Double HP100s" reads as just "RIGHT".
  const short = linked.entry.name.startsWith(`${item.name} · `) ? linked.entry.name.slice(item.name.length + 3) : linked.entry.name;
  return { ...linked.status, label: `${short.toUpperCase()}: ${linked.status.label}` };
}

// --- Floating gear -------------------------------------------------------------------------------
function floatingLocation(item, setups) {
  if (!item?.floating || !item.currentSetupId) return null;
  return (Array.isArray(setups) ? setups : []).find((setup) => setup.id === item.currentSetupId) || null;
}

// Moves a floating item onto a setup (or off every setup with ''). It's one physical thing, so it
// is un-checked everywhere else it was packed.
function moveFloatingItem(state, itemId, setupId, now = new Date()) {
  const items = state.items.map((item) => (item.id === itemId ? { ...item, currentSetupId: setupId || '', updatedAt: now.toISOString() } : item));
  const setups = state.setups.map((setup) => {
    if (setup.id === setupId) return setup.itemIds.includes(itemId) ? setup : { ...setup, itemIds: [...setup.itemIds, itemId], updatedAt: now.toISOString() };
    const checkedIds = setup.checkedIds.filter((key) => checklistItemIdForKey(key) !== itemId);
    return checkedIds.length === setup.checkedIds.length ? setup : { ...setup, checkedIds, updatedAt: now.toISOString() };
  });
  return { ...state, items, setups };
}

const localDay = (now) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Checking a floating item off in a setup means it's packed there — so it moves there. Ticking the
// setup's quick-dive checklist also stamps the day, so the list can clear itself afterwards.
function applyChecks(state, setupId, keys, checked, now = new Date()) {
  const keySet = new Set(keys);
  const next = {
    ...state,
    setups: state.setups.map((setup) => {
      if (setup.id !== setupId) return setup;
      const without = setup.checkedIds.filter((id) => !keySet.has(id));
      return { ...setup, checkedIds: checked ? [...without, ...keys] : without, ...(checked ? { checkedOn: localDay(now) } : {}) };
    }),
  };
  return checked ? moveFloatingForChecks(next, setupId, keys, now) : next;
}

// Packing a floating item (a transmitter, a full-face mask) for a setup moves it onto that setup —
// whether it was ticked on the setup's own checklist or a trip's. The setup's ticks are kept as-is.
function moveFloatingForChecks(state, setupId, keys, now = new Date()) {
  let next = state;
  const floatingIds = [...new Set(keys.map(checklistItemIdForKey))].filter((id) => state.items.find((item) => item.id === id)?.floating);
  for (const id of floatingIds) {
    if (next.items.find((item) => item.id === id).currentSetupId === setupId) continue;
    const kept = next.setups.find((setup) => setup.id === setupId)?.checkedIds;
    next = moveFloatingItem(next, id, setupId, now);
    if (kept) next.setups = next.setups.map((setup) => (setup.id === setupId ? { ...setup, checkedIds: kept } : setup));
  }
  return next;
}

// The quick-dive checklist (a setup packed with no trip planned) clears itself once the dive is
// over: ticks survive the evening before and the dive day itself, and are gone two days after the
// last one. Ticks from before this was tracked (no date) are cleared too.
const QUICK_PACKING_DAYS = 2;
function clearStalePacking(state, now = new Date()) {
  const today = localDay(now);
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - QUICK_PACKING_DAYS + 1);
  const oldest = cutoff.toISOString().slice(0, 10);
  let changed = false;
  const setups = state.setups.map((setup) => {
    if (!setup.checkedIds.length || (setup.checkedOn && setup.checkedOn >= oldest)) return setup;
    changed = true;
    return { ...setup, checkedIds: [] };
  });
  return changed ? { ...state, setups } : state;
}

// --- Search --------------------------------------------------------------------------------------
// Every word must appear somewhere in the item: name, brand, model, serial, category, set-up, color,
// size, material, valve, notes, retailer, or any tracked part's name / brand / model / serial.
function gearSearchText(item) {
  return [
    item.name, item.manufacturer, item.model, item.serialNumber, item.category, item.configuration, item.color, item.size,
    item.thickness, item.capacity, item.workingPressure, item.material, item.valveType, item.notes, item.serviceNotes, item.retailer,
    item.floating ? 'floating' : '',
    ...(item.components || []).flatMap((component) => [component.name, component.type, component.manufacturer, component.model, component.serialNumber, component.notes]),
  ].filter(Boolean).join(' ').toLowerCase();
}
function searchGear(items, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const list = Array.isArray(items) ? items : [];
  if (!words.length) return list;
  return list.filter((item) => { const text = gearSearchText(item); return words.every((word) => text.includes(word)); });
}

// --- Dive computers from the logbook -------------------------------------------------------------
// Every computer the logbook has downloaded from (its deviceKey is vendor|product|serial) shows up
// in the locker as a Dive computer item, once. Deleting that item dismisses it for good.
function syncDiveComputers(state, indexRows, now = new Date()) {
  const known = new Set([...state.items.map((item) => item.deviceKey).filter(Boolean), ...(state.dismissedDeviceKeys || [])]);
  const keys = [...new Set((Array.isArray(indexRows) ? indexRows : []).filter((row) => row && !row.deletedAt).flatMap((row) => row.deviceKeys || []))].filter((key) => key && !known.has(key));
  if (!keys.length) return state;
  // A computer the diver already added by hand (same serial, or same brand + model with no serial
  // recorded) is claimed instead of duplicated.
  const lower = (value) => String(value || '').trim().toLowerCase();
  let items = state.items;
  const unclaimed = keys.filter((deviceKey) => {
    const [vendor = '', product = '', serial = ''] = String(deviceKey).split('|');
    const match = items.find((item) => item.category === 'Dive computer' && !item.deviceKey && (
      (serial && lower(item.serialNumber) === lower(serial))
      || (!item.serialNumber && product && lower(item.model) === lower(product) && (!item.manufacturer || lower(item.manufacturer) === lower(vendor)))));
    if (!match) return true;
    items = items.map((item) => (item.id === match.id ? { ...item, deviceKey, serialNumber: item.serialNumber || serial } : item));
    return false;
  });
  const added = unclaimed.map((deviceKey) => {
    const [vendor = '', product = '', serial = ''] = String(deviceKey).split('|');
    const model = `${vendor} ${product}`.trim() || 'Dive computer';
    const twins = unclaimed.filter((key) => key.split('|').slice(0, 2).join('|') === `${vendor}|${product}`).length
      + state.items.filter((item) => item.category === 'Dive computer' && item.manufacturer === vendor && item.model === product).length;
    return normalizeGearItem({
      ...emptyGearItem(), name: twins > 1 && serial ? `${model} (${serial.slice(-4)})` : model, category: 'Dive computer',
      manufacturer: vendor, model: product, serialNumber: serial, deviceKey,
      notes: 'Added automatically when you downloaded dives from it.',
    }, now);
  });
  return { ...state, items: [...items, ...added] };
}

function diveComputerLogStats(indexRows, deviceKey) {
  const rows = (Array.isArray(indexRows) ? indexRows : []).filter((row) => row && !row.deletedAt && (row.deviceKeys || []).includes(deviceKey));
  if (!rows.length) return null;
  const dates = rows.map((row) => row.startTime).filter(Boolean).sort();
  const deepest = rows.reduce((max, row) => Math.max(max, Number(row.maxDepthMeters) || 0), 0);
  return {
    count: rows.length, first: (dates[0] || '').slice(0, 10), last: (dates[dates.length - 1] || '').slice(0, 10),
    deepest: deepest ? `${Math.round(deepest * 3.28084)} ft · ${Math.round(deepest)} m` : '',
  };
}

// Every choice a setup still has to make, e.g. which undergarment goes with its drysuit.
function unresolvedChoices(setup, items) {
  const byId = new Map((Array.isArray(items) ? items : []).map((entry) => [entry.id, entry]));
  return (setup?.itemIds || []).map((id) => byId.get(id)).filter(Boolean)
    .flatMap((item) => packedAccessories(item, items, setup).unresolved.map((group) => ({ item, ...group })));
}

// A dive computer the logbook downloads from stays in the locker while the logbook has dives from
// it: it can be edited or marked Retired, but not deleted (or re-categorized). Once every dive from
// it is gone, it can be deleted — and it comes back if you download from it again.
function isLockedLogbookComputer(item, indexRows) {
  return Boolean(item?.deviceKey) && Boolean(diveComputerLogStats(indexRows, item.deviceKey));
}

// --- Cylinder sets act as one item ---------------------------------------------------------------
// A doubles set or sidemount pair is one item in the inventory, setup picker and checklist; its
// cylinders are still tracked (serial, hydro, visual) but live inside the set until unlinked.
function cylinderSetMemberIds(items) {
  return new Set((Array.isArray(items) ? items : []).filter(isCylinderSet).flatMap((set) => set.accessoryItemIds || []));
}
function cylinderSetFor(items, itemId) {
  return (Array.isArray(items) ? items : []).find((entry) => isCylinderSet(entry) && (entry.accessoryItemIds || []).includes(itemId)) || null;
}
// What the inventory lists: set members are folded into their set (a search that matches a
// cylinder's serial shows the set it's in).
function topLevelGear(items, matches = items) {
  const list = Array.isArray(items) ? items : [];
  const members = cylinderSetMemberIds(list);
  const shown = new Map();
  for (const item of matches) {
    const target = members.has(item.id) ? cylinderSetFor(list, item.id) : item;
    if (target) shown.set(target.id, target);
  }
  return [...shown.values()];
}
// Unlink a cylinder so it's tracked (and packed) on its own.
function unlinkFromSet(state, itemId, now = new Date()) {
  const stamp = now.toISOString();
  return {
    ...state,
    items: state.items.map((item) => {
      if (isCylinderSet(item) && (item.accessoryItemIds || []).includes(itemId)) return { ...item, accessoryItemIds: item.accessoryItemIds.filter((id) => id !== itemId), updatedAt: stamp };
      if (item.id === itemId) return { ...item, configuration: item.configuration || 'Single cylinder', updatedAt: stamp };
      return item;
    }),
  };
}

// --- Items packed as part of another item in a setup ---------------------------------------------
// Selecting a drysuit brings its linked hood and boots (and the undergarment chosen for this setup);
// selecting a doubles set brings its cylinders. Returns accessoryId → the selected item it packs with,
// so the setup picker shows them as already included and never adds them a second time.
function includedWithSelection(itemIds, items, accessoryChoices = {}) {
  const list = Array.isArray(items) ? items : [];
  const byId = new Map(list.map((entry) => [entry.id, entry]));
  const selected = new Set(itemIds || []);
  const included = new Map();
  // Follow links more than one level deep (a set → its cylinders, an undersuit → its linked socks).
  const queue = [...selected].map((id) => byId.get(id)).filter(Boolean);
  const visited = new Set(queue.map((item) => item.id));
  while (queue.length) {
    const item = queue.shift();
    const packed = isCylinderSet(item) ? accessoryItemsForItem(list, item) : packedAccessories(item, list, { accessoryChoices }).packed;
    for (const accessory of packed) {
      if (accessory.id === item.id || included.has(accessory.id)) continue;
      // Two items linked to each other (a drysuit ↔ its undergarment) never swallow one another:
      // the one the diver selected stays selectable, with its own questions.
      if ((accessory.accessoryItemIds || []).includes(item.id) && selected.has(accessory.id)) continue;
      included.set(accessory.id, item);
      if (!visited.has(accessory.id)) { visited.add(accessory.id); queue.push(accessory); }
    }
  }
  // A selected item is never hidden inside something it links to itself.
  for (const id of [...included.keys()]) {
    const parent = included.get(id);
    if (selected.has(id) && (byId.get(id)?.accessoryItemIds || []).includes(parent.id)) included.delete(id);
  }
  return included;
}

// For each selected item, the alternatives it offers (e.g. undergarments): optionId → { item, category }.
function alternativesOfSelection(itemIds, items) {
  const list = Array.isArray(items) ? items : [];
  const byId = new Map(list.map((entry) => [entry.id, entry]));
  const map = new Map();
  for (const id of itemIds || []) {
    const item = byId.get(id);
    if (!item) continue;
    for (const group of accessoryAlternatives(item, list)) for (const option of group.options) if (!map.has(option.id)) map.set(option.id, { item, category: group.category });
  }
  return map;
}

// Drops ids that are already packed as part of another selected item.
function withoutIncluded(itemIds, items, accessoryChoices = {}) {
  const included = includedWithSelection(itemIds, items, accessoryChoices);
  return (itemIds || []).filter((id) => !included.has(id));
}

// --- Is this setup complete? ---------------------------------------------------------------------
// What a setup of each type needs, checked against everything it packs (its items, their linked gear
// and chosen undergarments). The diver answers each gap once — add something, or leave it out — and
// the review then collapses to a summary. Changing the setup's type starts a fresh review.
// Asked in this order: life support first, then comfort and safety.
const SCUBA_BASICS = ['regulator', 'cylinder', 'bcd', 'exposure', 'mask', 'fins', 'computer', 'weights', 'signal'];
const SETUP_NEEDS = {
  'Single tank': { list: SCUBA_BASICS, regulators: 1, cylinders: 1 },
  Doubles: { list: [...SCUBA_BASICS, 'backup-computer'], regulators: 2, cylinders: 2 },
  Sidemount: { list: [...SCUBA_BASICS, 'sidemount-harness', 'backup-computer'], regulators: 2, cylinders: 2 },
  Rebreather: { list: ['rebreather', 'exposure', 'regulator', 'cylinder', 'mask', 'fins', 'computer', 'backup-computer', 'signal'], regulators: 1, cylinders: 1, bailout: true },
  'Pony / bailout': { list: ['regulator', 'cylinder'], regulators: 1, cylinders: 1 },
  'Stage / deco': { list: ['regulator', 'cylinder'], regulators: 1, cylinders: 1 },
  Freedive: { list: ['exposure', 'mask', 'fins', 'weights', 'computer'] },
};

// Everything a setup actually packs: its items plus linked gear (hood, boots, set cylinders) and chosen undergarments.
function packedItems(setup, items) {
  const list = Array.isArray(items) ? items : [];
  const byId = new Map(list.map((entry) => [entry.id, entry]));
  const ids = new Set(setup?.itemIds || []);
  for (const id of includedWithSelection(setup?.itemIds, list, setup?.accessoryChoices || {}).keys()) ids.add(id);
  return [...ids].map((id) => byId.get(id)).filter(Boolean);
}

const firstStagesOf = (regulator) => {
  if (['Full face mask', 'Second stage only'].includes(regulator.configuration)) return 0;
  const count = (regulator.components || []).filter((component) => component.type === 'First stage').length;
  return count || 1;
};

function setupRequirements(setup, items) {
  const needs = SETUP_NEEDS[setup?.type];
  if (!needs) return [];
  const list = Array.isArray(items) ? items : [];
  const packed = packedItems(setup, list);
  const packedIds = new Set(packed.map((item) => item.id));
  const members = cylinderSetMemberIds(list);
  const of = (category) => packed.filter((item) => item.category === category);
  const skipped = new Set(setup.completeness?.skipped || []);
  const offer = (test) => list.filter((item) => !packedIds.has(item.id) && !members.has(item.id) && test(item));
  const regulators = of('Regulator');
  const firstStages = regulators.reduce((sum, item) => sum + firstStagesOf(item), 0);
  const cylinders = of('Cylinder / tank').filter((item) => !members.has(item.id) || !packed.some((set) => isCylinderSet(set) && (set.accessoryItemIds || []).includes(item.id)))
    .reduce((sum, item) => sum + (isCylinderSet(item) ? Math.max(2, (item.accessoryItemIds || []).length) : 1), 0);
  const computers = of('Dive computer').length;
  const drysuit = packed.find(isDrysuit);
  const bcds = of('BCD');
  const bail = needs.bailout ? 'bailout ' : '';
  const defs = {
    exposure: { label: 'Exposure protection', have: of('Exposure suit').length, need: 1, category: 'Exposure suit', title: 'No exposure protection', body: 'A wetsuit or drysuit keeps you warm and protected. Add one, or leave it out for warm water in a rash guard.' },
    bcd: { label: 'BCD', have: bcds.length, need: 1, category: 'BCD', title: 'No BCD', body: 'Your buoyancy control device — jacket, wing or backplate & wing.' },
    regulator: {
      label: needs.regulators > 1 ? 'Regulators' : `${bail ? 'Bailout r' : 'R'}egulator`, have: firstStages, need: needs.regulators || 1, category: 'Regulator',
      title: firstStages ? `Only ${firstStages} of ${needs.regulators} first stages` : `No ${bail}regulator`,
      body: needs.regulators > 1 ? `${setup.type} need${setup.type.endsWith('s') ? '' : 's'} one first stage per cylinder or post, so you have a fully redundant gas supply. A doubles or sidemount regulator set that lists two first stages counts as both.` : needs.bailout ? 'Open-circuit bailout: a regulator on a bailout cylinder, in case the loop fails.' : 'The regulator you breathe from. A full-face mask or a lone second stage needs a first stage to plug into.',
    },
    cylinder: {
      label: needs.cylinders > 1 ? 'Cylinders' : `${bail ? 'Bailout c' : 'C'}ylinder`, have: cylinders, need: needs.cylinders || 1, category: 'Cylinder / tank',
      title: cylinders ? `Only ${cylinders} of ${needs.cylinders} cylinders` : `No ${bail}cylinder`,
      body: needs.cylinders > 1 ? `${setup.type} need${setup.type.endsWith('s') ? '' : 's'} two cylinders — a doubles set or sidemount pair counts as both. If you rent cylinders at the site, leave this out.` : 'Leave it out if you rent or fill tanks at the site.',
    },
    mask: { label: 'Mask', have: of('Mask').length + regulators.filter((item) => item.configuration === 'Full face mask').length, need: 1, category: 'Mask', title: 'No mask', body: 'A full-face mask in this setup counts too.', also: (item) => item.category === 'Regulator' && item.configuration === 'Full face mask' },
    fins: { label: 'Fins', have: of('Fins').length, need: 1, category: 'Fins', title: 'No fins', body: 'Easy to leave on the dock. Add the pair you dive with this setup.' },
    computer: { label: 'Dive computer', have: computers, need: 1, category: 'Dive computer', title: 'No dive computer', body: 'Tracks depth, time and your no-decompression limit — or your dive plan.' },
    'backup-computer': { label: 'Backup computer', have: computers + of('Gauges / compass').length >= 2 ? 1 : 0, need: 1, category: 'Dive computer', title: 'No backup computer or bottom timer', body: 'Technical setups carry a second computer or a bottom timer and depth gauge, so one failure doesn’t end the plan.', also: (item) => item.category === 'Gauges / compass' },
    weights: { label: 'Weights', have: of('Weights').length, need: 1, category: 'Weights', title: 'No weights', body: 'Leave it out if this setup is heavy enough without them (steel doubles often are) or you use the dive shop’s.' },
    signal: { label: 'SMB & cutting tool', have: of('Surface safety').length + of('Cutting / signaling').length, need: 1, category: 'Surface safety', title: 'No SMB or cutting tool', body: 'A surface marker buoy and a line cutter or knife — many boats require an SMB.', also: (item) => item.category === 'Cutting / signaling' },
    'sidemount-harness': { label: 'Sidemount harness', have: bcds.filter((item) => item.configuration === 'Sidemount').length, need: 1, category: 'BCD', title: bcds.length ? `This setup's BCD isn't a sidemount harness` : 'No sidemount harness', body: 'Sidemount cylinders clip to a sidemount harness. Pick yours, or leave it if your BCD converts.', filter: (item) => item.configuration === 'Sidemount' },
    rebreather: { label: 'Rebreather', have: of('Rebreather').length, need: 1, category: 'Rebreather', title: 'No rebreather', body: 'The unit itself — its diluent and oxygen cylinders usually travel with it.' },
  };
  const requirements = needs.list.map((key) => ({ key, ...defs[key] }));
  // A drysuit needs a low-pressure inflator hose from one of the regulators — easy to forget.
  if (drysuit && regulators.length) requirements.push({
    key: 'drysuit-hose', label: 'Drysuit inflator hose', have: regulators.some((item) => (item.components || []).some((component) => component.type === 'Drysuit hose')) ? 1 : 0, need: 1,
    title: 'No drysuit inflator hose', body: `None of this setup's regulators lists a drysuit inflator hose for your ${drysuit.name}. Add the hose to a regulator (Edit → Parts), or leave this if it's covered.`, category: null,
  });
  return requirements.map((req) => ({
    ...req, met: req.have >= req.need, skipped: skipped.has(req.key),
    candidates: req.category ? offer((item) => (item.category === req.category && (!req.filter || req.filter(item))) || (req.also ? req.also(item) : false)) : [],
  }));
}

// The review's questions, in order — the undergarment choice for each drysuit, then each gap.
function setupQuestions(setup, items) {
  // An empty setup is still being assembled, so gaps are noise. Start the one-time review only
  // after the diver adds the first item; its completion state remains untouched until then.
  if (!setup?.itemIds?.length) return [];
  const questions = unresolvedChoices(setup, items).map((choice) => ({ kind: 'choice', key: `choice:${choice.item.id}`, ...choice }));
  if (!setup?.completeness?.done) questions.push(...setupRequirements(setup, items).filter((req) => !req.met && !req.skipped).map((req) => ({ kind: 'requirement', ...req })));
  return questions;
}

// Once no questions are left, the review is done for good (until the type changes or it's reset).
function settleReview(setup, items) {
  const open = setupRequirements(setup, items).filter((req) => !req.met && !req.skipped).length;
  return open ? setup : { ...setup, completeness: { ...setup.completeness, done: true } };
}
function skipRequirement(setup, key, items, now = new Date()) {
  const next = { ...setup, completeness: { ...(setup.completeness || {}), skipped: [...new Set([...(setup.completeness?.skipped || []), key])] }, updatedAt: now.toISOString() };
  return settleReview(next, items);
}
function addToSetupForRequirement(setup, itemId, items, now = new Date()) {
  const next = { ...setup, itemIds: setup.itemIds.includes(itemId) ? setup.itemIds : [...setup.itemIds, itemId], updatedAt: now.toISOString() };
  return settleReview(next, items);
}
function resetSetupReview(setup, now = new Date()) {
  return { ...setup, completeness: { skipped: [], done: false, type: setup.type }, updatedAt: now.toISOString() };
}
window.DMZGearModel = { GEAR_CATEGORIES, CATEGORY_GROUPS, GUIDED_CATEGORIES, GEAR_CONDITIONS, SERVICE_INTERVALS, SETUP_TYPES, REGULATOR_CONFIGURATIONS, TANK_CONFIGURATIONS, BCD_STYLES, EXPOSURE_SUIT_TYPES, WETSUIT_CUTS, DRYSUIT_MATERIALS, SEAL_MATERIALS, DRYSUIT_FEET_OPTIONS, UNDERGARMENT_STYLES, UNDERGARMENT_INSULATION, CYLINDER_SETUPS, CYLINDER_MATERIALS, VALVE_TYPES, CYLINDER_COLORS, CYLINDER_PRESETS, HYDRO_INTERVAL_MONTHS, VISUAL_INTERVAL_MONTHS, COMPONENT_TYPES, GEAR_STATE_VERSION, createGearId, emptyGearComponent, componentCanHaveSerial, regulatorComponentTemplate, tankComponentTemplate, bcdComponentTemplate, exposureComponentTemplate, undergarmentComponentTemplate, emptyGearItem, emptyGearSetup, emptyGearList, createInitialGearState, normalizeGearComponent, normalizeGearItem, normalizeGearSetup, normalizeGearList, normalizeGearState, setupIdsForItem, listIdsForItem, accessoryItemsForItem, parentItemsForAccessory, checklistEntriesForItem, isDrysuit, accessoryAlternatives, packedAccessories, setAccessoryChoice, checklistItemIdForKey, assignItemToSetups, assignItemToLists, formatDateOnly, updateServiceSchedule, serviceDueForItem, serviceStatusForItem, serviceStatusForAssembly, serviceEntriesForItem, ATTENTION_STATUSES, groupGearByFamily, gearSummary, setupProgress, checklistProgress, sortGear, GEAR_SORT_OPTIONS, GEAR_SERVICE_FILTERS, GEAR_LOCATION_FILTERS, filterGear, sortGearBy, addMonthsToDateOnly, presetCapacity, presetPressure, isCylinderSet, unpairedCylinders, serviceStatusForSet, floatingLocation, moveFloatingItem, applyChecks, moveFloatingForChecks, QUICK_PACKING_DAYS, clearStalePacking, gearSearchText, searchGear, syncDiveComputers, diveComputerLogStats, unresolvedChoices, isLockedLogbookComputer, cylinderSetMemberIds, cylinderSetFor, topLevelGear, unlinkFromSet, includedWithSelection, alternativesOfSelection, withoutIncluded, packedItems, setupRequirements, setupQuestions, skipRequirement, addToSetupForRequirement, resetSetupReview };
})();

// src/features/insurance/model.js
(() => {
'use strict';
// Insurance policies kept on this device: dive accident cover, travel, professional liability,
// equipment. Every field is typed in by the diver (nothing is read by AI); documents are the
// diver's own files. Pure and date-only safe; `today` is YYYY-MM-DD.

const INSURANCE_TYPES = Object.freeze([
  { key: 'dive', label: 'Dive accident', hint: 'DAN, DiveAssure, PADI…' },
  { key: 'travel', label: 'Travel', hint: 'Trip cancellation, medical, evacuation' },
  { key: 'liability', label: 'Professional liability', hint: 'Instructor / divemaster cover' },
  { key: 'equipment', label: 'Equipment', hint: 'Gear loss, theft or damage' },
  { key: 'other', label: 'Other', hint: '' },
]);
const insuranceTypeLabel = (key) => INSURANCE_TYPES.find((type) => type.key === key)?.label || 'Insurance';

const RENEWAL_PERIODS = Object.freeze([
  { key: 1, label: 'Monthly' },
  { key: 3, label: 'Every 3 months' },
  { key: 6, label: 'Every 6 months' },
  { key: 12, label: 'Yearly' },
  { key: 24, label: 'Every 2 years' },
]);
const renewalPeriodLabel = (months) => RENEWAL_PERIODS.find((period) => period.key === months)?.label || 'Yearly';

// Within this many days of its end date a policy shows as expiring soon.
const EXPIRING_DAYS = 30;

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const day = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '');
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const addDays = (value, amount) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const addMonths = (value, amount) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return '';
  const sourceYear = Number(match[1]), sourceMonth = Number(match[2]) - 1, sourceDay = Number(match[3]);
  const monthIndex = sourceYear * 12 + sourceMonth + amount;
  const year = Math.floor(monthIndex / 12), month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(sourceDay, lastDay)).padStart(2, '0')}`;
};
const createPolicyId = () => id('policy');
const createDocumentId = () => id('doc');

function normalizeDocument(value = {}) {
  const uri = clean(value.uri, 2000);
  if (!uri) return null;
  return {
    id: clean(value.id, 80) || createDocumentId(), uri, name: clean(value.name, 160) || 'Document',
    mimeType: clean(value.mimeType, 100), kind: value.kind === 'photo' ? 'photo' : 'file', size: Number(value.size) > 0 ? Number(value.size) : null,
  };
}

function normalizePolicy(value = {}, now = new Date()) {
  const type = INSURANCE_TYPES.some((entry) => entry.key === value.type) ? value.type : 'dive';
  const startDate = day(value.startDate);
  const endDate = day(value.endDate) && (!startDate || value.endDate >= startDate) ? value.endDate : '';
  return {
    id: clean(value.id, 80) || createPolicyId(), type,
    provider: clean(value.provider, 120), policyNumber: clean(value.policyNumber, 80), memberNumber: clean(value.memberNumber, 80),
    startDate, endDate, autoRenews: value.autoRenews === true,
    // Older auto-renewing records did not store a cadence. They migrate to annual renewal,
    // which matches the common DAN membership/policy cycle and the old UI's implied behavior.
    renewalMonths: RENEWAL_PERIODS.some((period) => period.key === Number(value.renewalMonths)) ? Number(value.renewalMonths) : 12,
    emergencyPhone: clean(value.emergencyPhone, 60), covered: clean(value.covered, 200), notes: clean(value.notes, 2000),
    documents: (Array.isArray(value.documents) ? value.documents : []).map(normalizeDocument).filter(Boolean).slice(0, 30),
    createdAt: clean(value.createdAt, 40) || now.toISOString(), updatedAt: now.toISOString(),
  };
}

function normalizeInsuranceState(value) {
  const policies = (Array.isArray(value?.policies) ? value.policies : []).map((policy) => normalizePolicy(policy, new Date(policy?.updatedAt || Date.now())));
  return { version: 1, policies };
}

const policyTitle = (policy) => [policy.provider, insuranceTypeLabel(policy.type)].filter(Boolean).join(' · ') || 'Insurance policy';

// The renewal term containing `onDate`. The entered dates remain the first known term, while
// every consumer gets an up-to-date window without silently rewriting the user's source data.
function policyTermForDate(policy, onDate) {
  const startDate = day(policy?.startDate), endDate = day(policy?.endDate), target = day(onDate);
  if (!policy?.autoRenews || !endDate || !target || target <= endDate) return { startDate, endDate, cycle: 0 };
  const months = RENEWAL_PERIODS.some((period) => period.key === Number(policy.renewalMonths)) ? Number(policy.renewalMonths) : 12;
  const endParts = endDate.split('-').map(Number), targetParts = target.split('-').map(Number);
  const elapsedMonths = (targetParts[0] - endParts[0]) * 12 + targetParts[1] - endParts[1];
  let cycle = Math.max(1, Math.floor(elapsedMonths / months));
  while (addMonths(endDate, cycle * months) < target) cycle += 1;
  while (cycle > 1 && addMonths(endDate, (cycle - 1) * months) >= target) cycle -= 1;
  const previousEnd = addMonths(endDate, (cycle - 1) * months);
  return { startDate: addDays(previousEnd, 1), endDate: addMonths(endDate, cycle * months), cycle };
}

// Where a policy stands today: not started yet, active, expiring soon, expired, or no end date.
// An auto-renewing policy never shows as expired or expiring.
function policyStatus(policy, today) {
  if (policy.startDate && policy.startDate > today) return { key: 'upcoming', label: 'Starts later', tone: 'info' };
  if (policy.autoRenews) return { key: 'active', label: 'Active · auto-renews', tone: 'good', term: policyTermForDate(policy, today) };
  if (!policy.endDate) return { key: 'active', label: 'Active', tone: 'good' };
  if (policy.endDate < today) return { key: 'expired', label: 'Expired', tone: 'danger' };
  const left = daysBetween(today, policy.endDate);
  if (left <= EXPIRING_DAYS) return { key: 'expiring', label: left === 0 ? 'Expires today' : `Expires in ${left} ${left === 1 ? 'day' : 'days'}`, tone: 'warning' };
  return { key: 'active', label: 'Active', tone: 'good' };
}

// Does the policy cover every day from `start` to `end`?
function coversDates(policy, start, end) {
  if (!start) return false;
  const last = end || start;
  const effectiveEnd = policy.autoRenews ? policyTermForDate(policy, last).endDate : policy.endDate;
  return (!policy.startDate || policy.startDate <= start) && (!effectiveEnd || effectiveEnd >= last);
}

// The policies that go with a plan: dive-accident cover found automatically (any dive policy in
// force for part of the plan), plus the ones the diver attached (travel, liability…).
// `covering` is the dive policy that covers the whole plan, if any; `gaps` are dive policies that
// start late or end before the plan does.
function policiesForPlan(plan, policies) {
  const start = plan.startDate, end = plan.endDate || plan.startDate;
  const overlaps = (policy) => {
    const effectiveEnd = policy.autoRenews ? policyTermForDate(policy, start).endDate : policy.endDate;
    return start && (!policy.startDate || policy.startDate <= end) && (!effectiveEnd || effectiveEnd >= start);
  };
  const auto = policies.filter((policy) => policy.type === 'dive' && overlaps(policy));
  const covering = auto.find((policy) => coversDates(policy, start, end)) || null;
  const attachedIds = new Set(plan.insuranceIds || []);
  const attached = policies.filter((policy) => attachedIds.has(policy.id) && !auto.includes(policy));
  return { auto, attached, covering, gaps: covering ? [] : auto.filter((policy) => !coversDates(policy, start, end)) };
}
window.DMZInsuranceModel = { INSURANCE_TYPES, insuranceTypeLabel, RENEWAL_PERIODS, renewalPeriodLabel, EXPIRING_DAYS, createPolicyId, createDocumentId, normalizeDocument, normalizePolicy, normalizeInsuranceState, policyTitle, policyTermForDate, policyStatus, coversDates, policiesForPlan };
})();

// src/features/planner/model.js
(() => {
'use strict';
// Dive Planner: dive days (a morning shore dive, a charter) and dive trips (flights, transfers,
// stays, liveaboards, diving days). Plans are plain JSON; `planAlerts` checks one against the
// diver's Gear Locker, certification cards and logbook so problems surface while there is still
// time to fix them. Everything here is pure and date-only safe (no timezone day shifts).
const { packedItems, serviceEntriesForItem, serviceDueForItem, setupProgress } = window.DMZGearModel;
const { insuranceTypeLabel, policiesForPlan } = window.DMZInsuranceModel;

const PLAN_KINDS = Object.freeze(['day', 'trip']);
const PLAN_STATUSES = Object.freeze(['idea', 'planned', 'booked', 'cancelled']);
const STATUS_LABELS = Object.freeze({ idea: 'Idea', planned: 'Planning', booked: 'Booked', cancelled: 'Cancelled' });

const SEGMENT_TYPES = Object.freeze({
  flight: { label: 'Flight', from: 'From (airport)', to: 'To (airport)', provider: 'Airline & flight', ends: true },
  drive: { label: 'Drive', from: 'From', to: 'To', provider: 'Driver or parking', ends: true },
  transfer: { label: 'Transfer', from: 'Pick-up', to: 'Drop-off', provider: 'Company', ends: true },
  ferry: { label: 'Ferry', from: 'Departs', to: 'Arrives', provider: 'Operator', ends: true },
  stay: { label: 'Stay', from: 'Address', to: '', provider: 'Hotel or resort', ends: true, overnight: true },
  liveaboard: { label: 'Liveaboard', from: 'Embarks', to: 'Disembarks', provider: 'Vessel', ends: true, overnight: true, diving: true },
  diving: { label: 'Dive day', from: 'Meeting point', to: 'Dive sites', provider: 'Dive operator', ends: false, diving: true },
  // A rental car runs across days (shown on each) but is not somewhere to sleep.
  car: { label: 'Rental car', from: 'Pick-up', to: 'Drop-off', provider: 'Rental company', ends: true, spans: true },
  activity: { label: 'Activity', from: 'Meeting point', to: '', provider: 'Operator', ends: true },
  other: { label: 'Other', from: 'Where', to: '', provider: 'Provider', ends: true },
});
// Shown across every day it covers: overnight stays, liveaboards and rental cars.
const spansDays = (type) => Boolean(SEGMENT_TYPES[type]?.overnight || SEGMENT_TYPES[type]?.spans);

// Certifications an operator may ask for, matched against the cards on the diver's profile.
// Higher levels include the ones below them (a Rescue Diver satisfies "Advanced").
const CERT_REQUIREMENTS = Object.freeze([
  { key: 'open-water', label: 'Open Water', match: /open water|scuba diver|\bow\b|autonomous|1[- ]?star|\*\s*diver/i },
  { key: 'advanced', label: 'Advanced Open Water', match: /advanced|\baow\b|adventure diver|2[- ]?star/i, includes: ['open-water'] },
  { key: 'rescue', label: 'Rescue Diver', match: /rescue/i, includes: ['advanced', 'open-water'] },
  { key: 'divemaster', label: 'Divemaster or pro', match: /dive ?master|instructor|\bdm\b|assistant instructor/i, includes: ['rescue', 'advanced', 'open-water'] },
  { key: 'nitrox', label: 'Nitrox (EANx)', match: /nitrox|eanx|enriched air/i },
  { key: 'deep', label: 'Deep diver', match: /deep/i },
  { key: 'wreck', label: 'Wreck diver', match: /wreck/i },
  { key: 'drysuit', label: 'Drysuit', match: /dry ?suit/i },
  { key: 'night', label: 'Night diver', match: /night/i },
  { key: 'sidemount', label: 'Sidemount', match: /sidemount/i },
  { key: 'cavern', label: 'Cavern', match: /cavern/i },
  { key: 'cave', label: 'Full cave', match: /\bcave\b/i, includes: ['cavern'] },
  { key: 'rebreather', label: 'Rebreather', match: /rebreather|\bccr\b|\bscr\b/i },
]);

// How long a regulator or BCD service usually takes at a shop, plus shipping slack.
const SERVICE_LEAD_DAYS = 21;
// DAN: a minimum 12-hour surface interval after a single no-stop dive, 18 hours after repetitive
// dives or multiple days of diving, and substantially longer after decompression dives.
const NO_FLY_MIN_HOURS = 12;
const NO_FLY_HOURS = 18;
const MIN_CONNECTION_MINUTES = 60;
const PASSPORT_VALIDITY_MONTHS = 6;
const REFRESHER_MONTHS = 12;

const DAY = 86400000;
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createPlanId = () => id('plan');
const createSegmentId = () => id('leg');
const createBookingId = () => id('booking');

// --- dates ------------------------------------------------------------------
function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}
const dayString = (date) => (date ? date.toISOString().slice(0, 10) : '');
const addDays = (value, days) => { const date = parseDay(value); return date ? dayString(new Date(date.getTime() + days * DAY)) : ''; };
const todayString = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const daysBetween = (from, to) => { const a = parseDay(from), b = parseDay(to); return a && b ? Math.round((b - a) / DAY) : null; };
const validTime = (value) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : '');
const minutesOf = (time) => { const t = validTime(time); return t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null; };
// Minutes since the epoch day of `date` + `time` — for ordering and gaps, never shown as a Date.
const moment = (date, time, fallback) => { const d = parseDay(date); if (!d) return null; const m = minutesOf(time) ?? fallback; return m == null ? null : Math.round((d.getTime() - 12 * 3600000) / 60000) + m; };

const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatDay(value, { weekday = false, year = false } = {}) {
  const date = parseDay(value);
  if (!date) return '';
  return `${weekday ? `${weekdays[date.getUTCDay()]}, ` : ''}${monthsShort[date.getUTCMonth()]} ${date.getUTCDate()}${year ? `, ${date.getUTCFullYear()}` : ''}`;
}
function formatRange(start, end) {
  if (!start) return 'Dates not set';
  if (!end || end === start) return formatDay(start, { weekday: true, year: true });
  const a = parseDay(start), b = parseDay(end);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${formatDay(start, { year: true })} – ${formatDay(end, { year: true })}`;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${monthsShort[a.getUTCMonth()]} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  return `${formatDay(start)} – ${formatDay(end)}, ${b.getUTCFullYear()}`;
}
// "Nov 12–14" within a month, "Nov 30–Dec 2" across one; no year (the plan shows it).
function shortRange(start, end) {
  const a = parseDay(start), b = parseDay(end);
  if (!a || !b || start === end) return formatDay(start);
  return a.getUTCMonth() === b.getUTCMonth() ? `${formatDay(start)}–${b.getUTCDate()}` : `${formatDay(start)}–${formatDay(end)}`;
}
function formatTime(value) {
  const minutes = minutesOf(value);
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// --- records ----------------------------------------------------------------
function emptyPlan(kind = 'day', now = new Date()) {
  const today = todayString(now);
  return normalizePlan({ kind, title: '', status: kind === 'day' ? 'booked' : 'planned', startDate: kind === 'day' ? addDays(today, 1) : '', endDate: '' }, now);
}

function normalizeSegment(value = {}) {
  const type = SEGMENT_TYPES[value.type] ? value.type : 'other';
  const startDate = parseDay(value.startDate) ? value.startDate : '';
  const endDate = SEGMENT_TYPES[type].ends && parseDay(value.endDate) ? value.endDate : '';
  return {
    id: clean(value.id, 80) || createSegmentId(), type, title: clean(value.title, 160),
    startDate, startTime: validTime(value.startTime), endDate, endTime: validTime(value.endTime),
    from: clean(value.from, 160), to: clean(value.to, 160), provider: clean(value.provider, 160), reference: clean(value.reference, 80), phone: clean(value.phone, 60),
    dives: Math.max(0, Math.min(12, Number.parseInt(value.dives, 10) || 0)), notes: clean(value.notes, 2000),
    // Flights bought together (one confirmation: outbound connections and the return) share a booking id.
    booking: type === 'flight' ? clean(value.booking, 80) : '',
  };
}

// --- flights ----------------------------------------------------------------
const airportKey = (value) => String(value || '').trim().toUpperCase();

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, '0')}m` : ''}` : `${m}m`;
}

// Minutes on the ground between two flights, or null when a time is missing.
function layoverMinutes(previous, next) {
  const arrives = moment(previous.endDate || previous.startDate, previous.endTime, null);
  const departs = moment(next.startDate, next.startTime, null);
  return arrives == null || departs == null ? null : departs - arrives;
}

// Flights that connect onward — the next flight leaves the airport you landed at within a day —
// keyed by the arriving flight's id: { minutes, airport, nextId }.
function flightConnections(plan) {
  const flights = plan.segments.filter((leg) => leg.type === 'flight' && leg.startDate);
  const connections = new Map();
  for (let i = 1; i < flights.length; i++) {
    const previous = flights[i - 1], next = flights[i];
    const minutes = layoverMinutes(previous, next);
    if (minutes == null || minutes > 24 * 60) continue;
    if (previous.to && next.from && airportKey(previous.to) !== airportKey(next.from)) continue;
    connections.set(previous.id, { minutes, airport: next.from || previous.to, nextId: next.id });
  }
  return connections;
}

// Every flight in the same booking as `leg` (just the leg itself when it has none), in order.
function bookingFlights(plan, leg) {
  if (!leg?.booking) return [leg];
  return plan.segments.filter((entry) => entry.type === 'flight' && entry.booking === leg.booking);
}

// The next flight of a journey: leaves from where the last one landed, on the day it landed.
function connectingFlight(previous) {
  return normalizeSegment({
    type: 'flight', from: previous.to, startDate: previous.endDate || previous.startDate,
    provider: previous.provider, reference: previous.reference, booking: previous.booking,
  });
}

// The flight home: from the final destination back to where the trip began.
function returnFlight(flights, plan) {
  const first = flights[0], last = flights.at(-1);
  return normalizeSegment({
    type: 'flight', from: last?.to, to: first?.from, startDate: plan?.endDate || last?.endDate || last?.startDate,
    provider: last?.provider, reference: last?.reference, booking: last?.booking,
  });
}

// Swaps a booking's old legs for its edited flights (added, changed or removed).
function replaceFlights(segments, previousIds, flights) {
  const drop = new Set(previousIds);
  return [...segments.filter((leg) => !drop.has(leg.id)), ...flights.map(normalizeSegment)].sort(bySegmentTime);
}

function normalizePlan(value = {}, now = new Date()) {
  const kind = PLAN_KINDS.includes(value.kind) ? value.kind : 'day';
  const startDate = parseDay(value.startDate) ? value.startDate : '';
  // A dive day is one day; a trip's end can't precede its start.
  const endDate = kind === 'day' ? startDate : (parseDay(value.endDate) && (!startDate || value.endDate >= startDate) ? value.endDate : startDate);
  const requirements = value.requirements || {};
  const operator = value.operator || {};
  const destination = value.destination || {};
  const lat = Number(destination.latitude), lon = Number(destination.longitude);
  const profile = value.diveProfile || {};
  const optionalPositive = (entry, max) => {
    const parsed = Number(entry);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, parsed) : null;
  };
  return {
    id: clean(value.id, 80) || createPlanId(), kind, status: PLAN_STATUSES.includes(value.status) ? value.status : 'planned',
    title: clean(value.title, 120), startDate, endDate, startTime: kind === 'day' ? validTime(value.startTime) : '',
    // A linked site carries its Ocean Atlas id (or My sites id), position and broader area.
    destination: { name: clean(destination.name, 160), country: clean(destination.country, 80), siteId: clean(destination.siteId, 80),
      area: clean(destination.area, 160), custom: destination.custom === true,
      ...(Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { latitude: lat, longitude: lon } : {}) },
    operator: { name: clean(operator.name, 160), phone: clean(operator.phone, 60), email: clean(operator.email, 160), website: clean(operator.website, 300),
      meetingPoint: clean(operator.meetingPoint, 200), confirmation: clean(operator.confirmation, 80) },
    dives: Math.max(0, Math.min(12, Number.parseInt(value.dives, 10) || 0)),
    // Optional planning assumptions. Stored in SI so personal gas estimates
    // remain stable when the diver changes display units.
    diveProfile: {
      targetDepthMeters: optionalPositive(profile.targetDepthMeters, 200),
      bottomTimeMinutes: optionalPositive(profile.bottomTimeMinutes, 1440),
      startPressureBar: optionalPositive(profile.startPressureBar, 500),
      reservePressureBar: optionalPositive(profile.reservePressureBar, 500),
      cylinderVolumeLiters: optionalPositive(profile.cylinderVolumeLiters, 100),
    },
    setupId: clean(value.setupId, 80),
    // This plan's own packing ticks (Gear Locker checklist keys) — two trips on one setup pack separately.
    packedIds: [...new Set((Array.isArray(value.packedIds) ? value.packedIds : []).map((key) => clean(key, 200)).filter(Boolean))].slice(0, 1000),
    // Insurance policies attached to this plan beyond the dive cover found automatically (travel, liability…).
    insuranceIds: [...new Set((Array.isArray(value.insuranceIds) ? value.insuranceIds : []).map((policyId) => clean(policyId, 80)).filter(Boolean))].slice(0, 20),
    // Gear Locker items brought on this plan only, on top of its setup (extra tanks, test kit…).
    extraItemIds: [...new Set((Array.isArray(value.extraItemIds) ? value.extraItemIds : []).map((itemId) => clean(itemId, 80)).filter(Boolean))].slice(0, 200),
    requirements: {
      certs: [...new Set((Array.isArray(requirements.certs) ? requirements.certs : []).filter((key) => CERT_REQUIREMENTS.some((c) => c.key === key)))],
      minDives: Math.max(0, Number.parseInt(requirements.minDives, 10) || 0),
      recentMonths: Math.max(0, Number.parseInt(requirements.recentMonths, 10) || 0),
      insurance: requirements.insurance === true, medical: requirements.medical === true, waiver: requirements.waiver === true,
    },
    confirmed: { insurance: value.confirmed?.insurance === true, medical: value.confirmed?.medical === true, waiver: value.confirmed?.waiver === true },
    travel: { passportExpiry: parseDay(value.travel?.passportExpiry) ? value.travel.passportExpiry : '' },
    segments: (Array.isArray(value.segments) ? value.segments : []).map(normalizeSegment).sort(bySegmentTime),
    tasks: (Array.isArray(value.tasks) ? value.tasks : []).map((task) => ({ id: clean(task?.id, 80) || id('task'), label: clean(task?.label, 200), done: task?.done === true })).filter((task) => task.label),
    notes: clean(value.notes, 4000),
    createdAt: clean(value.createdAt, 40) || now.toISOString(), updatedAt: now.toISOString(),
  };
}

function normalizePlannerState(value) {
  const plans = (Array.isArray(value?.plans) ? value.plans : []).map((plan) => normalizePlan(plan, new Date(plan?.updatedAt || Date.now())));
  return { version: 1, plans };
}

function bySegmentTime(a, b) {
  return (a.startDate || '9999').localeCompare(b.startDate || '9999') || (minutesOf(a.startTime) ?? 1440) - (minutesOf(b.startTime) ?? 1440);
}

const planTitle = (plan) => plan.title || plan.destination.name || (plan.kind === 'trip' ? 'Untitled trip' : 'Dive day');

// Where the plan sits in time: upcoming (with days to go), underway, or past.
function planPhase(plan, now = new Date()) {
  const today = todayString(now);
  if (!plan.startDate) return { key: 'undated', label: 'Dates not set', days: null };
  const until = daysBetween(today, plan.startDate);
  const end = plan.endDate || plan.startDate;
  if (until > 0) return { key: 'upcoming', label: until === 1 ? 'Tomorrow' : until < 14 ? `In ${until} days` : until < 60 ? `In ${Math.round(until / 7)} weeks` : `In ${Math.round(until / 30.4)} months`, days: until };
  if (today <= end) return { key: 'now', label: plan.kind === 'trip' ? `Day ${1 - until} of ${daysBetween(plan.startDate, end) + 1}` : 'Today', days: 0 };
  return { key: 'past', label: 'Completed', days: until };
}

// --- packing -----------------------------------------------------------------
// A setup's gear list with a plan's own ticks, for the checklist and its progress.
// The setup as packed for one plan: its gear plus the plan's extras, with the plan's own ticks.
// The setup itself is never changed — the extras belong to this plan only.
const withPlanPacking = (setup, plan) => ({
  ...setup,
  itemIds: [...new Set([...(setup?.itemIds || []), ...(plan?.extraItemIds || [])])],
  checkedIds: plan?.packedIds || [],
});

function packPlan(plan, keys, checked) {
  const drop = new Set(keys);
  const kept = (plan.packedIds || []).filter((key) => !drop.has(key));
  return { ...plan, packedIds: checked ? [...kept, ...keys] : kept };
}

// The trip or dive day a setup is being packed for: the soonest one still ahead (or underway).
function nextPlanForSetup(plans, setupId, now = new Date()) {
  if (!setupId) return null;
  return sortPlans(plans, now).upcoming.find((plan) => plan.setupId === setupId && plan.status !== 'cancelled') || null;
}

function sortPlans(plans, now = new Date()) {
  const today = todayString(now);
  const upcoming = [], past = [];
  for (const plan of plans) {
    if (plan.status === 'cancelled' || (plan.startDate && (plan.endDate || plan.startDate) < today)) past.push(plan); else upcoming.push(plan);
  }
  upcoming.sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999') || (minutesOf(a.startTime) ?? 1440) - (minutesOf(b.startTime) ?? 1440));
  past.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  return { upcoming, past };
}

// The itinerary as days: every date from start to end, with the legs on (or spanning) that day.
function planTimeline(plan) {
  const legs = plan.segments;
  const start = plan.startDate || legs[0]?.startDate;
  const last = [plan.endDate, ...legs.map((leg) => leg.endDate || leg.startDate)].filter(Boolean).sort().at(-1) || start;
  const undated = legs.filter((leg) => !leg.startDate);
  if (!start) return { days: [], undated };
  const days = [];
  for (let date = start, index = 1; date && date <= last && index <= 120; date = addDays(date, 1), index++) {
    const starts = legs.filter((leg) => leg.startDate === date);
    const continuing = legs.filter((leg) => leg.startDate && leg.startDate < date && spansDays(leg.type) && (leg.endDate || leg.startDate) > date);
    const ends = legs.filter((leg) => leg.endDate === date && leg.startDate !== date && spansDays(leg.type));
    days.push({ date, index, starts, continuing, ends, entries: dayEntries(starts, ends, continuing) });
  }
  return { days, undated };
}

// One day's itinerary in the order it happens: what's already underway (on board, staying, a rental
// car) first, then everything with a time — a 1 PM disembark before a 2 PM hotel check-in — and
// untimed items last, endings before beginnings (you check out of one place before checking in).
function dayEntries(starts, ends, continuing) {
  const timed = (variant, leg) => {
    const minutes = minutesOf(variant === 'end' ? leg.endTime : leg.startTime);
    return { leg, variant, key: minutes ?? (variant === 'end' ? 2000 : 2001) };
  };
  return [
    ...continuing.map((leg) => ({ leg, variant: 'continuing', key: -1 })),
    ...[...ends.map((leg) => timed('end', leg)), ...starts.map((leg) => timed('start', leg))]
      // Stable: at the same minute, endings still come first.
      .sort((a, b) => a.key - b.key || (a.variant === 'end' ? -1 : 0) - (b.variant === 'end' ? -1 : 0)),
  ].map(({ leg, variant }) => ({ leg, variant }));
}

// The active trip day, with the item underway now and the next scheduled item.
// Itinerary dates and times are intentionally interpreted as local trip-wall
// time; they are not converted through UTC or a guessed destination timezone.
function currentTripDay(plan, now = new Date()) {
  if (plan?.kind !== 'trip') return null;
  const today = todayString(now);
  const day = planTimeline(plan).days.find((entry) => entry.date === today);
  if (!day) return null;
  const nowMoment = moment(today, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, null);
  const entryMoment = ({ leg, variant }) => variant === 'continuing' ? null
    : moment(variant === 'end' ? leg.endDate : leg.startDate, variant === 'end' ? leg.endTime : leg.startTime, null);
  const current = day.entries.find(({ leg, variant }) => {
    if (variant !== 'start' || !leg.startTime || !leg.endTime) return false;
    const starts = moment(leg.startDate, leg.startTime, null);
    const ends = moment(leg.endDate || leg.startDate, leg.endTime, null);
    return starts != null && ends != null && starts <= nowMoment && nowMoment < ends;
  }) || null;
  const next = day.entries.find((entry) => {
    const when = entryMoment(entry);
    return when != null && when >= nowMoment;
  }) || day.entries.find((entry) => entry.variant === 'start' && !entry.leg.startTime) || null;
  const types = new Set(day.entries.map((entry) => entry.leg.type));
  const diving = types.has('diving') || types.has('liveaboard');
  const travel = ['flight', 'drive', 'transfer', 'ferry', 'car'].some((type) => types.has(type));
  const label = diving && travel ? 'Dive + travel day' : diving ? 'Dive day' : travel ? 'Travel day' : 'Trip day';
  return { ...day, current, next, label };
}

// Seed the general editor on an empty first day; flights remain an explicit
// shortcut. Middle days lean toward diving and a later final day toward travel.
function suggestedSegmentType(day, lastDay) {
  if (day?.index === 1 && !day.starts?.length) return 'other';
  if (day?.date === lastDay && day?.index > 1) return 'flight';
  return 'diving';
}

// --- readiness --------------------------------------------------------------
const TONE_RANK = { danger: 3, warning: 2, info: 1, good: 0 };
const certSatisfies = (card, key, seen = new Set()) => {
  if (seen.has(key)) return false;
  seen.add(key);
  const text = `${card?.certificationName || ''} ${card?.certificationCode || ''}`;
  const requirement = CERT_REQUIREMENTS.find((c) => c.key === key);
  if (requirement?.match.test(text)) return true;
  // A higher card counts for the lower levels it includes.
  return CERT_REQUIREMENTS.some((c) => c.includes?.includes(key) && c.match.test(text));
};
const certLabel = (key) => CERT_REQUIREMENTS.find((c) => c.key === key)?.label || key;
function cardsFor(certifications, key) { return (certifications || []).filter((card) => certSatisfies(card, key)); }

function lastDiveMoment(plan) {
  if (plan.kind === 'day') return plan.startDate ? moment(plan.startDate, plan.startTime, 8 * 60) + 6 * 60 : null;
  const diving = plan.segments.filter((leg) => SEGMENT_TYPES[leg.type].diving && leg.startDate);
  // Unknown finish times assume diving ends mid-afternoon.
  const ends = diving.map((leg) => moment(leg.endDate || leg.startDate, leg.endTime, 16 * 60));
  return ends.length ? Math.max(...ends) : null;
}

function uncoveredNights(plan) {
  if (plan.kind !== 'trip' || !plan.startDate || !plan.endDate || plan.endDate <= plan.startDate) return [];
  const covered = new Set();
  for (const leg of plan.segments) {
    if (!leg.startDate) continue;
    const overnight = SEGMENT_TYPES[leg.type].overnight || (leg.type === 'flight' && leg.endDate && leg.endDate > leg.startDate);
    if (!overnight) continue;
    for (let night = leg.startDate; night < (leg.endDate || addDays(leg.startDate, 1)); night = addDays(night, 1)) covered.add(night);
  }
  // The last night away is only uncovered when the trip doesn't fly home overnight.
  const gaps = [];
  for (let night = plan.startDate; night < plan.endDate; night = addDays(night, 1)) if (!covered.has(night)) gaps.push(night);
  const ranges = [];
  for (const night of gaps) { const last = ranges.at(-1); if (last && addDays(last[1], 1) === night) last[1] = night; else ranges.push([night, night]); }
  return ranges;
}

const dateOf = (date) => dayString(date instanceof Date ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)) : null);

// Everything worth knowing before this plan, most serious first. `context` is
// { gear: { items, setups }, certifications: array | null (signed out), dives: logbook rows, now }.
function planAlerts(plan, context = {}) {
  const now = context.now || new Date();
  const today = todayString(now);
  const alerts = [];
  const add = (tone, key, title, detail, action = null) => alerts.push({ tone, key, title, detail, action });
  if (plan.status === 'cancelled') return [];
  const end = plan.endDate || plan.startDate;
  if (end && end < today) return [];
  const daysOut = plan.startDate ? daysBetween(today, plan.startDate) : null;
  const items = context.gear?.items || [];
  const setup = (context.gear?.setups || []).find((entry) => entry.id === plan.setupId) || null;

  // Gear: service falling due before or during the plan, or anything not fit to dive.
  if (!setup) {
    if (items.length) add('info', 'setup', 'Choose the gear you’re bringing', 'Pick a setup from your Gear Locker to check its service dates and build the packing list.', 'setup');
  } else {
    const gear = packedItems(withPlanPacking(setup, plan), items);
    for (const item of gear) {
      if (item.condition === 'Out of service') add('danger', `gear-out-${item.id}`, `${item.name} is out of service`, 'It’s in the setup for this plan. Repair or replace it, or switch setups.', 'gear');
      else if (item.condition === 'Needs attention') add('warning', `gear-attn-${item.id}`, `${item.name} needs attention`, 'Marked as needing attention in your Gear Locker. Sort it out before you dive.', 'gear');
      if (['Out of service', 'Retired'].includes(item.condition)) continue;
      for (const entry of serviceEntriesForItem(item)) {
        const due = serviceDueForItem(entry.record);
        if (!due || !end) continue;
        const dueDay = dateOf(due.date);
        const name = entry.parentId ? `${item.name} · ${entry.name}` : item.name;
        const what = due.label === 'Service' ? 'service' : due.label.toLowerCase();
        if (dueDay < today) add('danger', `svc-${entry.id}`, `${name}: ${what} overdue`, `It was due ${formatDay(dueDay, { year: true })}. Get it serviced before ${plan.kind === 'trip' ? 'you travel' : 'this dive'}.`, 'gear');
        else if (dueDay <= end) {
          const bookBy = addDays(plan.startDate || dueDay, -SERVICE_LEAD_DAYS);
          add('warning', `svc-${entry.id}`, `${name}: ${what} due ${dueDay < plan.startDate ? 'before' : 'during'} this ${plan.kind === 'trip' ? 'trip' : 'dive'}`,
            `Due ${formatDay(dueDay, { year: true })}. ${bookBy > today ? `Book it by ${formatDay(bookBy)} to allow about ${Math.round(SERVICE_LEAD_DAYS / 7)} weeks at the shop.` : 'Book it now — shops often need a couple of weeks.'}`, 'gear');
        } else if (daysBetween(end, dueDay) <= 30) add('info', `svc-${entry.id}`, `${name}: ${what} due soon after`, `Due ${formatDay(dueDay, { year: true })}, shortly after you’re back. Servicing it beforehand saves a second trip to the shop.`, 'gear');
      }
    }
    const progress = setupProgress(withPlanPacking(setup, plan), items);
    if (!gear.length) add('info', 'setup-empty', `${setup.name} has no gear yet`, 'Add equipment to this setup in your Gear Locker to track packing.', 'setup');
    else if (daysOut != null && daysOut <= (plan.kind === 'trip' ? 7 : 1) && progress.total && progress.checked < progress.total) {
      add(daysOut <= 1 ? 'warning' : 'info', 'packing', `${progress.checked} of ${progress.total} items packed`, `Work through the ${setup.name} checklist so nothing gets left behind.`, 'packing');
    }
  }

  // Certification cards the operator asked for.
  const required = plan.requirements.certs;
  if (required.length && context.certifications == null) add('info', 'certs-signin', 'Sign in to check your cards', `This operator asks for ${required.map(certLabel).join(', ')}. Sign in so the planner can match your certifications.`, 'account');
  else if (context.certifications) {
    for (const key of required) {
      const cards = cardsFor(context.certifications, key);
      if (!cards.length) add('warning', `cert-${key}`, `${certLabel(key)} card not on your profile`, 'The operator requires it. Add the card to your profile, or plan the course before you go.', 'account');
      else if (end && cards.every((card) => card.expiresOn && !card.doesNotExpire && card.expiresOn < end)) add('warning', `cert-exp-${key}`, `${certLabel(key)} card expires first`, `It expires ${formatDay(cards[0].expiresOn, { year: true })}, before this plan ends. Renew it before you go.`, 'account');
    }
    for (const card of context.certifications) {
      if (card.expiresOn && !card.doesNotExpire && end && card.expiresOn >= today && card.expiresOn <= end && !required.some((key) => certSatisfies(card, key))) {
        add('info', `card-exp-${card.id || card.certificationName}`, `${card.certificationName} expires ${formatDay(card.expiresOn)}`, 'Before this plan ends — worth renewing first.', 'account');
      }
    }
  }

  // Experience: operator minimums and time out of the water.
  const dives = (context.dives || []).filter((row) => row && !row.deletedAt);
  const lastLogged = dives.reduce((latest, row) => (row.startTime && (!latest || row.startTime > latest) ? row.startTime : latest), '');
  if (plan.requirements.minDives && dives.length < plan.requirements.minDives) {
    add('warning', 'min-dives', `Operator asks for ${plan.requirements.minDives} logged dives`, `Your logbook has ${dives.length}. Bring older logs as proof, or check with the operator.`, 'logbook');
  }
  if (plan.startDate && lastLogged) {
    const monthsOut = daysBetween(lastLogged.slice(0, 10), plan.startDate) / 30.4;
    if (plan.requirements.recentMonths && monthsOut > plan.requirements.recentMonths) add('warning', 'recent', `Operator wants a dive in the last ${plan.requirements.recentMonths} months`, `Your last logged dive was ${formatDay(lastLogged.slice(0, 10), { year: true })}. Ask about a check-out dive or book a refresher.`, 'logbook');
    else if (monthsOut > REFRESHER_MONTHS) add('warning', 'refresher', 'Consider a refresher first', `Your last logged dive was ${formatDay(lastLogged.slice(0, 10), { year: true })} — over a year before this plan. A scuba review rebuilds skills and confidence.`, 'logbook');
  }

  // Paperwork the operator asked for, until the diver confirms it.
  const papers = [['insurance', 'Dive accident insurance', 'Have your policy number and emergency line with you.'], ['medical', 'Medical statement', 'Some answers need a physician’s sign-off — allow time for an appointment.'], ['waiver', 'Operator forms and waiver', 'Many operators take these online before you arrive.']];
  // Insurance on file: an active dive policy covering every day of the plan sorts the insurance
  // requirement by itself; one that lapses part-way is flagged, as is an attached policy (travel,
  // liability) that ends before the plan does.
  const insurance = policiesForPlan(plan, context.insurance || []);
  for (const policy of insurance.gaps) {
    const late = policy.startDate && policy.startDate > plan.startDate;
    add('warning', `ins-gap-${policy.id}`, `${policy.provider || 'Your dive insurance'} ${late ? `starts ${formatDay(policy.startDate)}, after you leave` : `ends ${formatDay(policy.endDate)}, before you’re home`}`,
      'Renew or extend it so you’re covered for every dive on this plan.', 'insurance');
  }
  for (const policy of insurance.attached) {
    if (!policy.autoRenews && policy.endDate && end && policy.endDate < end) add('warning', `ins-end-${policy.id}`, `${insuranceTypeLabel(policy.type)} cover ends ${formatDay(policy.endDate)}`, `${policy.provider || 'This policy'} ends before this plan does.`, 'insurance');
  }
  for (const [key, label, detail] of papers) {
    if (key === 'insurance' && insurance.covering) continue;
    if (plan.requirements[key] && !plan.confirmed[key]) add(daysOut != null && daysOut <= 14 ? 'warning' : 'info', `paper-${key}`, `${label} not confirmed`, key === 'insurance' ? `${detail} Add your policy under Insurance and it’s sorted automatically.` : detail, key === 'insurance' ? 'insurance' : 'requirements');
  }

  if (plan.kind === 'trip') {
    const flights = plan.segments.filter((leg) => leg.type === 'flight' && leg.startDate);
    // Flying after diving.
    const lastDive = lastDiveMoment(plan);
    if (lastDive != null) {
      for (const flight of flights) {
        const departs = moment(flight.startDate, flight.startTime, 12 * 60);
        if (departs == null || departs < lastDive - 12 * 60) continue;
        const hours = (departs - lastDive) / 60;
        const approximate = !flight.startTime || plan.segments.some((leg) => SEGMENT_TYPES[leg.type].diving && !leg.endTime);
        if (hours < NO_FLY_HOURS) add(hours < NO_FLY_MIN_HOURS ? 'danger' : 'warning', `nofly-${flight.id}`, `Only ~${Math.max(0, Math.round(hours))} hours between diving and your flight`,
          `DAN recommends at least ${NO_FLY_HOURS} hours after multiple dives or days of diving (${NO_FLY_MIN_HOURS} after a single no-stop dive). ${approximate ? 'Add dive and flight times for an exact figure. ' : ''}Plan a dive-free last day.`, 'timeline');
        break;
      }
    }
    // Connections that are too tight or overlap.
    for (let i = 1; i < flights.length; i++) {
      const previous = flights[i - 1], next = flights[i];
      const gap = layoverMinutes(previous, next);
      if (gap == null || gap > 24 * 60) continue;
      if (gap < 0) add('danger', `overlap-${next.id}`, 'Flights overlap', `${previous.title || previous.provider || 'A flight'} lands after ${next.title || next.provider || 'the next flight'} departs. Check the times.`, 'timeline');
      else if (gap < MIN_CONNECTION_MINUTES) add('warning', `connect-${next.id}`, `Tight ${gap}-minute connection${next.from ? ` in ${next.from}` : ''}`, 'Less than an hour to change planes — dive bags are often the casualty. Consider a longer layover.', 'timeline');
    }
    // Legs that end before they start.
    for (const leg of plan.segments) {
      const a = moment(leg.startDate, leg.startTime, 0), b = moment(leg.endDate, leg.endTime, 23 * 60);
      if (a != null && b != null && leg.endDate && b < a) add('warning', `order-${leg.id}`, `${leg.title || SEGMENT_TYPES[leg.type].label} ends before it starts`, 'Check its dates and times.', 'timeline');
    }
    // Nights with nowhere to sleep.
    for (const [first, last] of uncoveredNights(plan)) {
      add(daysOut != null && daysOut <= 21 ? 'warning' : 'info', `nights-${first}`, `No stay booked for ${first === last ? `the night of ${formatDay(first)}` : shortRange(first, addDays(last, 1))}`, 'Add a hotel or liveaboard, or an overnight flight, to cover it.', 'timeline');
    }
    // Passport validity: many countries require six months beyond the date you leave.
    if (flights.length) {
      if (!plan.travel.passportExpiry) add('info', 'passport-missing', 'Add your passport expiry', `Many countries require it to be valid ${PASSPORT_VALIDITY_MONTHS} months beyond your return.`, 'travel');
      else if (end && plan.travel.passportExpiry < end) add('danger', 'passport-expired', 'Passport expires before you’re home', `It expires ${formatDay(plan.travel.passportExpiry, { year: true })}. Renew it before booking anything else.`, 'travel');
      else if (end && plan.travel.passportExpiry < addDays(end, Math.round(PASSPORT_VALIDITY_MONTHS * 30.4))) add('warning', 'passport-validity', `Passport valid less than ${PASSPORT_VALIDITY_MONTHS} months after the trip`, `It expires ${formatDay(plan.travel.passportExpiry, { year: true })}. Some countries will refuse boarding — check the entry rules or renew.`, 'travel');
    }
    if (!plan.segments.some((leg) => SEGMENT_TYPES[leg.type].diving)) add('info', 'no-diving', 'No diving on the itinerary yet', 'Add dive days or a liveaboard so the planner can check surface intervals before your flight home.', 'timeline');
  }

  const open = plan.tasks.filter((task) => !task.done);
  if (open.length && daysOut != null && daysOut <= 7) add('info', 'tasks', `${open.length} to-do${open.length === 1 ? '' : 's'} left`, open.slice(0, 3).map((task) => task.label).join(' · '), 'tasks');

  return alerts.sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone]);
}

function readinessSummary(alerts) {
  const danger = alerts.filter((a) => a.tone === 'danger').length, warning = alerts.filter((a) => a.tone === 'warning').length;
  if (danger) return { tone: 'danger', label: `${danger} to fix`, headline: alerts[0].title };
  if (warning) return { tone: 'warning', label: `${warning} to check`, headline: alerts[0].title };
  if (alerts.length) return { tone: 'info', label: 'On track', headline: alerts[0].title };
  return { tone: 'good', label: 'Ready', headline: 'Everything checks out.' };
}
window.DMZPlannerModel = { PLAN_KINDS, PLAN_STATUSES, STATUS_LABELS, SEGMENT_TYPES, spansDays, CERT_REQUIREMENTS, SERVICE_LEAD_DAYS, NO_FLY_MIN_HOURS, NO_FLY_HOURS, MIN_CONNECTION_MINUTES, PASSPORT_VALIDITY_MONTHS, REFRESHER_MONTHS, createPlanId, createSegmentId, createBookingId, parseDay, dayString, addDays, todayString, daysBetween, formatDay, formatRange, shortRange, formatTime, emptyPlan, normalizeSegment, airportKey, formatDuration, layoverMinutes, flightConnections, bookingFlights, connectingFlight, returnFlight, replaceFlights, normalizePlan, normalizePlannerState, planTitle, planPhase, withPlanPacking, packPlan, nextPlanForSetup, sortPlans, planTimeline, dayEntries, currentTripDay, suggestedSegmentType, certLabel, cardsFor, planAlerts, readinessSummary };
})();

// src/features/planner/bookingImport/parseFlightText.js
(() => {
'use strict';
// Reads flights out of an airline confirmation email on the device — no network. Airline emails
// differ, so this looks for the pieces every one of them has (a flight number, two airport codes,
// departure and arrival times, a date) and groups them per flight. Anything it can't pin down is
// reported in `issues`; the caller then offers smart import or leaves it for the diver to fill in.
// Pure and deterministic: pass `today` so years can be inferred for dates printed without one.

const AIRLINES = Object.freeze({
  UA: 'United', AA: 'American', DL: 'Delta', WN: 'Southwest', B6: 'JetBlue', AS: 'Alaska', NK: 'Spirit', F9: 'Frontier',
  HA: 'Hawaiian', SY: 'Sun Country', MX: 'Breeze', G4: 'Allegiant', AC: 'Air Canada', WS: 'WestJet', AM: 'Aeromexico',
  Y4: 'Volaris', VB: 'Viva Aerobus', CM: 'Copa', AV: 'Avianca', BW: 'Caribbean Airlines', KX: 'Cayman Airways', UP: 'Bahamasair',
  BA: 'British Airways', VS: 'Virgin Atlantic', AF: 'Air France', KL: 'KLM', LH: 'Lufthansa', LX: 'Swiss', IB: 'Iberia',
  TP: 'TAP Air Portugal', EI: 'Aer Lingus', EK: 'Emirates', QR: 'Qatar Airways', EY: 'Etihad', TK: 'Turkish Airlines',
  SQ: 'Singapore Airlines', CX: 'Cathay Pacific', QF: 'Qantas', NZ: 'Air New Zealand', JL: 'Japan Airlines', NH: 'ANA',
  KE: 'Korean Air', PR: 'Philippine Airlines', '5J': 'Cebu Pacific', GA: 'Garuda Indonesia', MH: 'Malaysia Airlines',
  TG: 'Thai Airways', FJ: 'Fiji Airways', TN: 'Air Tahiti Nui', MS: 'EgyptAir', ET: 'Ethiopian', MU: 'China Eastern', CI: 'China Airlines',
});
const NAME_TO_CODE = Object.fromEntries(Object.entries(AIRLINES).map(([code, name]) => [name.toLowerCase(), code]));
const NAME_PATTERN = Object.values(AIRLINES).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|');
const CODE_PATTERN = Object.keys(AIRLINES).join('|');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_PATTERN = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
// Three-letter words in capitals that are not airports.
const NOT_AIRPORTS = new Set(`THE AND FOR YOU ARE NOT BUT ALL ANY CAN HAS HER HIS HOW ITS MAY NEW NOW OFF ONE OUR OUT OWN SEE SHE TOO TWO USE WAY WHO WHY YES YET
  USD EUR GBP CAD MXN AUD NZD JPY PDF EST EDT CST CDT MST MDT PST PDT AKST HST UTC GMT MON TUE WED THU FRI SAT SUN JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC
  TSA FAQ APP SMS VIP ROW FLT DEP ARR TKT REF PNR BAG QTY TAX FEE NON AIR KID MRS DOB ETA ETD APT CTR DAY WEB URL MPH KGS LBS INC LLC CEO MIN MAX REV`.split(/\s+/));

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : '');
const addDay = (iso, days) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

function normalizeEmailText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[–—→➝➡]/g, (c) => (c === '–' || c === '—' ? '-' : ' → '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

// A date printed without a year belongs to the next time that month/day comes round.
function withYear(month, day, year, today) {
  if (year) return isoDate(year < 100 ? 2000 + year : year, month, day);
  const base = today || new Date().toISOString().slice(0, 10);
  const guess = isoDate(Number(base.slice(0, 4)), month, day);
  return guess && guess < addDay(base, -60) ? isoDate(Number(base.slice(0, 4)) + 1, month, day) : guess;
}

function findDates(text, today) {
  const found = [];
  const push = (index, value) => { if (value) found.push({ index, value }); };
  const monthIndex = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
  let m;
  const monthFirst = new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'gi');
  while ((m = monthFirst.exec(text))) push(m.index, withYear(monthIndex(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0, today));
  const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_PATTERN},?(?:\\s+(\\d{4}))?`, 'gi');
  while ((m = dayFirst.exec(text))) push(m.index, withYear(monthIndex(m[2]), Number(m[1]), m[3] ? Number(m[3]) : 0, today));
  const compact = /\b(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2}|\d{4})?\b/g;
  while ((m = compact.exec(text))) push(m.index, withYear(monthIndex(m[2]), Number(m[1]), m[3] ? Number(m[3]) : 0, today));
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(text))) push(m.index, isoDate(Number(m[1]), Number(m[2]), Number(m[3])));
  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/g; // US order, as US airlines print it
  while ((m = numeric.exec(text))) push(m.index, withYear(Number(m[1]), Number(m[2]), Number(m[3]), today));
  // Overlapping matches ("Nov 7, 2026" also looks like "7, 2026") — keep the first at each spot.
  // Booking, payment and offer dates are paperwork, never travel: "Booking date 10 October 2025".
  const paperwork = /\b(?:book(?:ing|ed)(?: date| on)?|reserv(?:ation|ed)(?: date| on)|received(?: on)?|paid(?: on)?|payment(?: date)?|issued?(?: date| on)?|purchase(?:d| date)?(?: on)?|valid until|expires?|sent|order date)\W*$/i;
  return found.sort((a, b) => a.index - b.index)
    .filter((entry, i, all) => i === 0 || entry.index - all[i - 1].index > 3)
    .filter((entry) => !paperwork.test(text.slice(Math.max(0, entry.index - 40), entry.index)));
}

function findTimes(text) {
  const found = [];
  // Colon times only: "12.50" is usually a price.
  const re = /\b([01]?\d|2[0-3]):([0-5]\d)(?!\d)\s*([ap])?\.?\s*(m\b\.?)?/gi;
  let m;
  while ((m = re.exec(text))) {
    let h = Number(m[1]);
    // "4:00 - 4:30 pm": the range's am/pm belongs to both times.
    const shared = !m[3] && h <= 12 ? /^\s*(?:-|to)\s*\d{1,2}:\d{2}\s*([ap])\.?\s*m\b/i.exec(text.slice(re.lastIndex, re.lastIndex + 24))?.[1] : null;
    const suffix = (m[3] || shared)?.toLowerCase();
    if (suffix) { if (h > 12 || h === 0) continue; if (suffix === 'p' && h < 12) h += 12; if (suffix === 'a' && h === 12) h = 0; }
    found.push({ index: m.index, value: `${pad(h)}:${m[2]}` });
  }
  return found;
}

function findAirports(text) {
  const inParens = [], bare = [];
  let m;
  const parens = /\(([A-Z]{3})\)/g;
  while ((m = parens.exec(text))) if (!NOT_AIRPORTS.has(m[1])) inParens.push({ index: m.index, value: m[1] });
  const words = /(?<![A-Za-z0-9])([A-Z]{3})(?![A-Za-z0-9])/g;
  while ((m = words.exec(text))) if (!NOT_AIRPORTS.has(m[1])) bare.push({ index: m.index, value: m[1] });
  return { inParens, bare };
}

function findFlightNumbers(text, fallbackCode) {
  const found = [];
  let m;
  const byCode = new RegExp(`(?<![A-Za-z0-9])(${CODE_PATTERN})\\s?-?(\\d{1,4})(?![\\d:])`, 'g');
  while ((m = byCode.exec(text))) found.push({ index: m.index, code: m[1], number: m[2] });
  const byName = new RegExp(`\\b(${NAME_PATTERN})(?:\\s+(?:Airlines|Air Lines|Airways))?\\s+(?:flight\\s+)?#?\\s?(\\d{1,4})\\b(?![:/])`, 'gi');
  while ((m = byName.exec(text))) found.push({ index: m.index, code: NAME_TO_CODE[m[1].toLowerCase()], number: m[2] });
  if (fallbackCode) {
    // "Flight 1 of 3" counts flights; it isn't a flight number.
    const bare = /\bflight(?:\s+(?:number|no\.?))?\s*[:#]?\s*(\d{1,4})\b(?!\s*of\s+\d)/gi;
    while ((m = bare.exec(text))) found.push({ index: m.index, code: fallbackCode, number: m[1] });
  }
  // One flight per spot, first match wins ("United flight 1234" and "flight 1234" are the same).
  return found.sort((a, b) => a.index - b.index).filter((entry, i, all) => i === 0 || entry.index - all[i - 1].index > 25 || `${entry.code}${entry.number}` !== `${all[i - 1].code}${all[i - 1].number}`);
}

function mostMentionedAirline(text) {
  let best = '', count = 0;
  for (const [code, name] of Object.entries(AIRLINES)) {
    const hits = (text.match(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')) || []).length;
    if (hits > count) { best = code; count = hits; }
  }
  return best;
}

function findConfirmation(text) {
  const re = /\b(?:confirmation(?:\s+(?:number|code|#))?|record\s+locator|booking\s+(?:reference|code|number)|reservation\s+(?:code|number)|trip\s+confirmation|PNR)\b\s*(?:is|:|#|-)?\s*:?\s*([A-Z0-9]{6})\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const code = m[1].toUpperCase();
    if (/[A-Z]/.test(code) && !/^(NUMBER|NUMBERS)$/.test(code)) return code;
  }
  return '';
}

const within = (list, start, end) => list.filter((entry) => entry.index >= start && entry.index < end);
const lastBefore = (list, index) => [...list].reverse().find((entry) => entry.index < index);

// Reads one flight from the stretch of text around its flight number.
function readFlight(text, flight, start, end, tokens) {
  const region = text.slice(start, end);
  const parens = within(tokens.airports.inParens, start, end);
  const airports = (parens.length >= 2 ? parens : within(tokens.airports.bare, start, end)).map((entry) => entry.value)
    .filter((code, i, all) => all.indexOf(code) === i);
  const times = within(tokens.times, start, end).map((entry) => entry.value);
  const dates = within(tokens.dates, start, end).map((entry) => entry.value);
  const carried = lastBefore(tokens.dates, start)?.value || '';
  const startDate = dates[0] || carried;
  let endDate = dates[1] && dates[1] >= startDate ? dates[1] : startDate;
  if (startDate && endDate === startDate && /\+\s?1\b|next day|arrives the following day/i.test(region)) endDate = addDay(startDate, 1);
  const seat = /\bseats?\s*(?:number)?\s*:?\s*(\d{1,2}[A-K])\b/i.exec(region)?.[1];
  return {
    type: 'flight', title: `${flight.code} ${flight.number}`, provider: AIRLINES[flight.code] || '',
    from: airports[0] || '', to: airports[1] || '', startDate, startTime: times[0] || '', endDate, endTime: times[1] || '',
    notes: seat ? `Seat ${seat.toUpperCase()}` : '',
  };
}

const completeness = (flight) => ['from', 'to', 'startDate', 'startTime', 'endTime'].filter((key) => flight[key]).length;

function parseFlightText(input, { today } = {}) {
  const text = normalizeEmailText(input);
  const fallback = mostMentionedAirline(text);
  const tokens = { dates: findDates(text, today), times: findTimes(text), airports: findAirports(text) };
  const numbers = findFlightNumbers(text, fallback);

  // Some emails put a flight's details after its number, others before. Read both ways and keep
  // whichever explains more of the email.
  const read = (after) => numbers.map((flight, i) => {
    const start = after ? flight.index : (i ? numbers[i - 1].index + 8 : Math.max(0, flight.index - 400));
    const end = after ? (numbers[i + 1]?.index ?? Math.min(text.length, flight.index + 600)) : flight.index + 12;
    return readFlight(text, flight, start, end, tokens);
  });
  const score = (list) => list.reduce((sum, flight) => sum + completeness(flight), 0);
  const after = read(true), before = read(false);
  const candidates = score(before) > score(after) ? before : after;

  // Emails repeat flights (summary + details): keep the most complete copy of each.
  const byKey = new Map();
  for (const flight of candidates) {
    const key = `${flight.title}|${flight.startDate}`;
    const existing = byKey.get(key);
    if (!existing || completeness(flight) > completeness(existing)) byKey.set(key, flight);
  }
  const flights = [...byKey.values()]
    .filter((flight) => completeness(flight) >= 2)
    .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));

  const issues = [];
  if (!flights.length) issues.push('No flights found.');
  flights.forEach((flight, i) => {
    const missing = [!flight.from || !flight.to ? 'airports' : '', !flight.startDate ? 'date' : '', !flight.startTime || !flight.endTime ? 'times' : ''].filter(Boolean);
    if (missing.length) issues.push(`Flight ${i + 1} (${flight.title}) is missing ${missing.join(' and ')}.`);
  });
  return { flights, reference: findConfirmation(text), issues, complete: flights.length > 0 && issues.length === 0 };
}
window.DMZFlightParser = { AIRLINES, addDay, normalizeEmailText, findDates, findTimes, mostMentionedAirline, findConfirmation, parseFlightText };
})();

// src/features/planner/bookingImport/parseBookingText.js
(() => {
'use strict';
// Reads non-flight bookings — hotels, rental cars, liveaboards, tours and dive bookings, ferries and
// transfers — out of a confirmation email on the device. Emails for these vary far more than airline
// ones, so this only claims a booking when the email clearly is one (a hotel needs both check-in and
// check-out, a car both pick-up and drop-off) and reads the dates printed beside those labels.
// Anything it can't pin down goes in `issues` and the caller offers smart import instead.
const { addDay, findConfirmation, findDates, findTimes, normalizeEmailText } = window.DMZFlightParser;

const RENTAL_COMPANIES = ['Hertz', 'Avis', 'Enterprise', 'Budget', 'National', 'Alamo', 'Sixt', 'Thrifty', 'Dollar', 'Europcar', 'Fox Rent A Car', 'Payless', 'Turo', 'Mex Rent a Car', 'America Car Rental'];
const ACTIVITY_PLATFORMS = ['Viator', 'Tripadvisor', 'GetYourGuide', 'Klook', 'Airbnb Experiences'];
const STAY_PLATFORMS = ['Booking.com', 'Airbnb', 'Expedia', 'Hotels.com', 'Vrbo', 'Agoda', 'Marriott', 'Hilton', 'Hyatt', 'IHG'];
const LIVEABOARD_PLATFORMS = ['LiveAboard.com', 'Aggressor', 'Dancer Fleet', 'Blue O Two', 'Master Liveaboards', 'PADI Travel', 'Scuba Travel', 'Dive Worldwide'];

const has = (text, pattern) => pattern.test(text);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const firstNamed = (text, names) => names.find((name) => new RegExp(`\\b${escape(name)}\\b`, 'i').test(text)) || '';

// The first date (and time) printed within a short stretch after a label like "Check-in". A list
// of labels is tried in order and the first one followed by a date wins, so "Return date" beats
// a "Return to" line that happens to sit above the departure date.
function labelled(text, label, tokens, reach = 160) {
  for (const option of Array.isArray(label) ? label : [label]) {
    const match = option.exec(text);
    if (!match) continue;
    const start = match.index, end = match.index + match[0].length + reach;
    const date = tokens.dates.find((entry) => entry.index >= start && entry.index < end);
    if (!date) continue;
    // The time belongs to this date: on its line, not the next label's.
    const lineEnd = text.indexOf('\n', date.index);
    const time = tokens.times.find((entry) => entry.index >= start && entry.index < (lineEnd < 0 ? end : Math.min(end, lineEnd)));
    return { date: date.value, time: time?.value || '' };
  }
  return null;
}

// A value printed after its label — on the same line ("Vessel: Manta Queen 3") or, as text copied
// from a PDF comes out, on the line below ("Vessel" / "Manta Queen 3"). A list of labels is tried in
// order, so "Pick-up location" wins over a bare "Pick-up" line that holds the time.
function field(text, label, max = 120) {
  for (const option of Array.isArray(label) ? label : [label]) {
    const match = new RegExp(`(?:^|\\n)[ \\t]*(?:${option})[ \\t]*(?:[:#-][ \\t]*|\\n[ \\t]*)([^\\n]{2,${max}})`, 'i').exec(text);
    if (match) return match[1].trim().replace(/\s{2,}/g, ' ');
  }
  return '';
}

// "Your reservation at Casa Mexicana" / "Booking confirmed: Snorkel tour" in the subject line.
function subjectName(text) {
  const subject = /(?:^|\n)Subject:\s*([^\n]+)/i.exec(text)?.[1] || '';
  const match = /(?:reservation|booking|stay|trip|order)\s+(?:at|for|to|with)\s+(.+?)(?:\s+(?:is|has been)\s+confirmed|[,!|]|\s+-\s+|$)/i.exec(subject)
    || /(?:confirmed|confirmation|booked)\s*[:!-]\s*(.+?)(?:[,!|]|\s+-\s+|$)/i.exec(subject);
  return match ? match[1].trim().replace(/[.:]$/, '') : '';
}

// Booking numbers hotels and tour sites use: "Booking ID: 4012.559.873", "Itinerary # 7291038847".
function findReference(text) {
  const airline = findConfirmation(text);
  if (airline) return airline;
  const match = /\b(?:booking|reservation|confirmation|itinerary|order|voucher|trip)\s*(?:id|number|no\.?|code|ref(?:erence)?|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9.-]{3,20}[A-Z0-9])\b/i.exec(text);
  return match && /\d/.test(match[1]) ? match[1].toUpperCase() : '';
}

// Kinds of booking the email clearly contains, strongest evidence first. Hotels, cars and
// liveaboards need their paired labels; the rest are weaker and only count when nothing else does
// (`strongOnly` — an airline email mentions tickets and dates, which doesn't make it a tour).
function bookingKinds(text, { strongOnly = false } = {}) {
  const kinds = [];
  if (has(text, /\blive-?aboard\b|\bdive (?:cruise|safari)\b/i) || (has(text, /\bembark(?:ation)?\b/i) && has(text, /\bdisembark(?:ation)?\b/i))) kinds.push('liveaboard');
  if (has(text, /\b(?:rental car|car rental|rent a car|vehicle|car class|car type)\b/i) && has(text, /\bpick[- ]?up\b/i) && has(text, /\b(?:drop[- ]?off|return)\b/i)) kinds.push('car');
  // A liveaboard's cabin check-in, "5 nights" and "hotel transfer" are not a hotel booking; with a
  // liveaboard, a stay needs a hotel actually named under its own label.
  if (has(text, /\bcheck[- ]?in\b/i) && has(text, /\bcheck[- ]?out\b/i) && has(text, /\b(?:hotel|resort|room|nights?|guests?|property|villa|apartment|condo|suite)\b/i)
    && !(kinds.includes('liveaboard') && !field(text, ['Hotel', 'Hotel name', 'Property', 'Accommodation', 'Resort']))) kinds.push('stay');
  if (kinds.length || strongOnly) return kinds;
  const kind = weakKind(text);
  return kind ? [kind] : [];
}

function weakKind(text) {
  const diving = has(text, /\b(?:\d\s?-?\s?tank|two[- ]tank|boat dives?|shore dives?|dive trip|guided dives?|dives?\s+(?:at|to|with))\b/i);
  const activity = has(text, /\b(?:tour|activity|excursion|experience|tickets?|admission)\b/i) || Boolean(firstNamed(text, ACTIVITY_PLATFORMS));
  if (diving) return 'diving';
  // A tour that meets at the ferry pier is still a tour: tour sites and "tour" wording come first.
  const tour = Boolean(firstNamed(text, ACTIVITY_PLATFORMS)) || has(text, /\b(?:tour|excursion|experience)\b/i);
  const dated = has(text, /\b(?:date|when|meeting point|pick-?up|starts?|departs?)\b/i);
  if (tour && dated) return 'activity';
  if (has(text, /\bferry\b/i) && has(text, /\b(?:ticket|crossing|sailing|departs?|departure|boarding)\b/i)) return 'ferry';
  if (has(text, /\b(?:airport transfer|shuttle|private transfer|transfer service|driver will meet)\b/i)) return 'transfer';
  if (activity && dated) return 'activity';
  return '';
}

function parseBookingText(input, { today, strongOnly = false } = {}) {
  const text = normalizeEmailText(input);
  const kinds = bookingKinds(text, { strongOnly });
  const kind = kinds[0];
  if (!kind) return { items: [], reference: '', issues: [], kind: '', complete: false };
  const tokens = { dates: findDates(text, today), times: findTimes(text) };
  const reference = findReference(text);
  const sender = /(?:^|\n)From:\s*([^\n]+)/i.exec(text)?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
  const firstDate = tokens.dates.find((entry) => !/(?:^|\n)(?:Date|Sent):/i.test(text.slice(Math.max(0, entry.index - 12), entry.index)))?.value || '';
  let item;

  if (kind === 'stay') {
    const checkIn = labelled(text, /\bcheck[- ]?in\b/i, tokens), checkOut = labelled(text, /\bcheck[- ]?out\b/i, tokens);
    const title = field(text, 'Hotel|Property|Accommodation|Hotel name|Resort') || subjectName(text);
    item = { type: 'stay', title, provider: firstNamed(text, STAY_PLATFORMS), from: field(text, 'Address|Location', 160),
      startDate: checkIn?.date || '', startTime: checkIn?.time || '', endDate: checkOut?.date || '', endTime: checkOut?.time || '',
      notes: field(text, 'Room(?: type)?|Room details', 80) };
  } else if (kind === 'car') {
    const pickUp = labelled(text, /\bpick[- ]?up\b(?!\s+location)/i, tokens), dropOff = labelled(text, /\b(?:drop[- ]?off|return)\b(?!\s+location)/i, tokens);
    item = { type: 'car', title: field(text, 'Car(?: class| type)?|Vehicle(?: class| type)?', 60), provider: firstNamed(text, RENTAL_COMPANIES) || sender,
      from: field(text, ['Pick[- ]?up location', 'Pick[- ]?up at', 'Pick[- ]?up'], 120), to: field(text, ['(?:Drop[- ]?off|Return) location', '(?:Drop[- ]?off|Return) at'], 120),
      startDate: pickUp?.date || '', startTime: pickUp?.time || '', endDate: dropOff?.date || '', endTime: dropOff?.time || '' };
    if (!item.to) item.to = item.from;
    if (/\d{1,2}:\d{2}/.test(item.from)) item.from = ''; // the label line held the time, not a place
  } else if (kind === 'liveaboard') {
    // Operators say embark/disembark; booking sites (LiveAboard.com) say departure/return date.
    const on = labelled(text, [/\bembark(?:ation)? date\b/i, /\bembark(?:ation)?\b/i, /\bdeparture date\b/i, /\bstart date\b/i, /\bdeparts?\b(?! from)/i], tokens, 200);
    const off = labelled(text, [/\bdisembark(?:ation)? date\b/i, /\bdisembark(?:ation)?\b/i, /\breturn date\b/i, /\bend date\b/i, /\breturns?\b(?! to)/i], tokens, 200);
    const dives = Number(/\b(?:up to\s+)?(\d{1,2})\s+dives\b/i.exec(text)?.[1]) || 0;
    const startDate = on?.date || firstDate;
    // "6 Days / 5 Nights" gives the return when no return date is printed.
    const nights = Number(/\b(\d{1,2})\s*nights?\b/i.exec(text)?.[1]) || 0;
    item = { type: 'liveaboard', title: field(text, ['Vessel', 'Yacht', 'Boat', 'Ship']) || subjectName(text),
      provider: field(text, ['Name of the Organizer', 'Organizer', 'Operator'], 80) || firstNamed(text, LIVEABOARD_PLATFORMS) || sender,
      from: field(text, ['(?:Embarkation|Departure) port', 'Port of embarkation', 'Embark(?:ation)? at', 'Departure from', 'Departs from'], 120),
      to: field(text, ['(?:Disembarkation|Arrival) port', 'Port of disembarkation', 'Disembark(?:ation)? at', 'Return to', 'Returns to'], 120),
      startDate, startTime: on?.time || '', endDate: off?.date || (startDate && nights ? addDay(startDate, nights) : ''), endTime: off?.time || '', dives,
      notes: [field(text, ['Itinerary', 'Route'], 200), field(text, ['Cabin type', 'Cabin'], 80)].filter(Boolean).join(' · ') };
  } else {
    // Dive bookings, tours, ferries and transfers: one date, a start time, a meeting place.
    const when = labelled(text, /\b(?:date|when|departs?|departure|pick-?up time|start(?:s| time)?|tour date|activity date)\b/i, tokens) || { date: firstDate, time: '' };
    const title = field(text, 'Tour|Activity|Experience|Product|Excursion|Trip') || subjectName(text);
    const dives = kind === 'diving' ? Number(/\b(\d)\s?-?\s?tank\b/i.exec(text)?.[1] || /\b(\d{1,2})\s+dives\b/i.exec(text)?.[1]) || 0 : 0;
    item = { type: kind, title, provider: firstNamed(text, ACTIVITY_PLATFORMS) || sender,
      from: field(text, 'Meeting point|Meeting location|Pick-?up location|Pick-?up point|Departs from|Departure point|Location', 160),
      startDate: when.date || firstDate, startTime: when.time || tokens.times[0]?.value || '', endDate: '', endTime: '', dives };
  }
  item.reference = reference;

  const issues = [];
  // A bundle (hotel + car, say) is read one booking at a time here; let smart import take it whole.
  if (kinds.length > 1) issues.push('This email holds more than one booking.');
  const label = { stay: 'hotel', car: 'rental car', liveaboard: 'liveaboard', diving: 'dive booking', activity: 'activity', ferry: 'ferry', transfer: 'transfer' }[kind];
  if (!item.title && !item.provider) issues.push(`The ${label}’s name wasn’t found.`);
  if (!item.startDate) issues.push(`The ${label}’s date wasn’t found.`);
  if (['stay', 'car', 'liveaboard'].includes(kind) && !item.endDate) issues.push(`The ${label}’s ${kind === 'stay' ? 'check-out' : kind === 'car' ? 'drop-off' : 'disembarkation'} date wasn’t found.`);
  return { items: [item], reference, issues, kind, complete: issues.length === 0 };
}
window.DMZBookingParser = { findReference, bookingKinds, parseBookingText };
})();

// src/features/planner/bookingImport/planImport.js
(() => {
'use strict';
// Fits imported bookings into a trip: flights on one confirmation become one booking; anything the
// trip already has (same confirmation, or the same thing on the same day) is updated rather than
// duplicated; dive days inside an imported liveaboard fold into it; and when bookings fall outside
// the trip's dates the trip can be stretched to cover them. Pure — the review sheet renders `rows`.
const { createBookingId, normalizeSegment } = window.DMZPlannerModel;

const same = (a, b) => Boolean(a) && Boolean(b) && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
const similar = (a, b) => {
  const x = String(a || '').trim().toLowerCase(), y = String(b || '').trim().toLowerCase();
  return Boolean(x) && Boolean(y) && (x === y || x.includes(y) || y.includes(x));
};

function existingMatches(plan, leg) {
  return plan.segments.filter((current) => current.type === leg.type && (
    same(current.reference, leg.reference)
    || (current.startDate === leg.startDate && (similar(current.title, leg.title) || similar(current.provider, leg.provider)))
  ));
}

function planImport(plan, items) {
  let legs = items.map((item) => normalizeSegment({ ...item, id: undefined }));

  // A liveaboard's itinerary lists its dive days; they belong to the liveaboard, not beside it.
  for (const boat of legs.filter((leg) => leg.type === 'liveaboard' && leg.startDate)) {
    const inside = legs.filter((leg) => leg.type === 'diving' && leg.startDate >= boat.startDate && leg.startDate <= (boat.endDate || boat.startDate));
    if (!boat.dives) boat.dives = Math.min(12, inside.reduce((sum, leg) => sum + (leg.dives || 0), 0));
    legs = legs.filter((leg) => !inside.includes(leg));
  }

  const rows = [];
  // Flights: one row per confirmation, so connections and the return stay together.
  const flightGroups = new Map();
  for (const leg of legs.filter((entry) => entry.type === 'flight')) {
    const key = leg.reference.toUpperCase() || 'flights';
    flightGroups.set(key, [...(flightGroups.get(key) || []), leg]);
  }
  for (const [key, flights] of flightGroups) {
    const planFlights = plan.segments.filter((leg) => leg.type === 'flight');
    const byReference = planFlights.filter((leg) => flights.some((flight) => same(leg.reference, flight.reference)));
    const replaces = byReference.length ? byReference : planFlights.filter((leg) => flights.some((flight) => flight.title === leg.title && flight.startDate === leg.startDate));
    const booking = replaces.find((leg) => leg.booking)?.booking || createBookingId();
    rows.push({ key: `flights-${key}`, kind: 'flights', legs: flights.map((flight) => ({ ...flight, booking })), replaces: replaces.map((leg) => leg.id) });
  }
  legs.filter((leg) => leg.type !== 'flight').forEach((leg, index) => {
    rows.push({ key: `leg-${index}`, kind: 'leg', legs: [leg], replaces: existingMatches(plan, leg).map((match) => match.id) });
  });
  rows.sort((a, b) => (a.legs[0].startDate || '9999').localeCompare(b.legs[0].startDate || '9999'));
  return { rows, extend: tripExtension(plan, rows) };
}

// The trip dates that would cover these rows, when they don't already.
function tripExtension(plan, rows) {
  const legs = rows.flatMap((row) => row.legs);
  const starts = legs.map((leg) => leg.startDate).filter(Boolean).sort();
  const ends = legs.map((leg) => leg.endDate || leg.startDate).filter(Boolean).sort();
  if (!starts.length) return null;
  const startDate = !plan.startDate || starts[0] < plan.startDate ? starts[0] : plan.startDate;
  const endDate = !plan.endDate || ends.at(-1) > plan.endDate ? ends.at(-1) : plan.endDate;
  return startDate === plan.startDate && endDate === plan.endDate ? null : { startDate, endDate };
}

// The trip after adding the chosen rows: replaced legs removed, new ones in, dates stretched if asked.
function applyImport(plan, rows, extend = null) {
  const drop = new Set(rows.flatMap((row) => row.replaces));
  const segments = [...plan.segments.filter((leg) => !drop.has(leg.id)), ...rows.flatMap((row) => row.legs)];
  return { ...plan, segments, ...(extend ? { startDate: extend.startDate, endDate: extend.endDate } : {}) };
}
window.DMZBookingImport = { planImport, tripExtension, applyImport };
})();
