const OPTIONS = {
  home: ['summary', 'gear', 'upNext', 'quickAccess', 'season', 'learning'],
  tools: ['dive-calculator', 'ocean-atlas', 'dive-planner', 'gear-checklist', 'dive-log', 'dive-lens'],
  learn: ['color-loss', 'boyles-law', 'gear-setup', 'compass-nav', 'dive-computer-simulator'],
};
const QUICK_DEFAULTS = ['ocean-atlas', 'dive-calculator', 'gear-checklist', 'dive-lens'];
export function normalizeCustomerLayout(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const clean = (list, allowed, append = true) => {
    const ids = Array.isArray(list) ? [...new Set(list.filter(id => allowed.includes(id)))] : [...allowed];
    return append ? [...ids, ...allowed.filter(id => !ids.includes(id))] : ids;
  };
  return {
    home: clean(value.home, OPTIONS.home), tools: clean(value.tools, OPTIONS.tools), learn: clean(value.learn, OPTIONS.learn),
    quickAccess: Array.isArray(value.quickAccess) ? clean(value.quickAccess, [...OPTIONS.tools, ...OPTIONS.learn.filter(id => id !== 'gear-setup')], false) : [...QUICK_DEFAULTS],
  };
}
