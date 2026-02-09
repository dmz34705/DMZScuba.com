(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.DMZMediaLogic = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function buildSearchText(item) {
    const source = item || {};
    const parts = [
      source.title,
      source.description,
      source.location,
      source.badge,
      source.type,
      ...(source.tags || []),
      ...(source.meta || []),
    ];
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeTag(tag) {
    return String(tag || "").trim().toLowerCase();
  }

  function matchesLocationKey(locationKey, targetKey) {
    if (!locationKey || !targetKey) return false;
    return locationKey === targetKey || locationKey.includes(targetKey) || targetKey.includes(locationKey);
  }

  function parseDateValue(item) {
    const raw = item && (item.createdAt || item.uploadedAt || item.date || item.uploadDate);
    if (!raw) return null;
    const timestamp = Date.parse(raw);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function parseViewsValue(item) {
    const raw = item && (item.views || item.viewCount);
    if (raw == null) return null;
    const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9]/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  function shuffleArray(items, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    const array = Array.isArray(items) ? [...items] : [];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function applySort(items, options) {
    const opts = options || {};
    const sort = String(opts.sort || "manual");
    const indexMap = opts.indexMap || null;
    const list = Array.isArray(items) ? [...items] : [];
    let nextShuffleOrder = Array.isArray(opts.shuffleOrder) ? [...opts.shuffleOrder] : null;

    if (sort === "manual") {
      return { list, shuffleOrder: nextShuffleOrder };
    }

    if (sort === "shuffle") {
      const keys = list.map((item, index) => (item && item.id ? item.id : `__idx-${index}`));
      if (!nextShuffleOrder || nextShuffleOrder.length !== keys.length) {
        nextShuffleOrder = shuffleArray(keys, opts.rng);
      }
      const orderMap = new Map(nextShuffleOrder.map((key, index) => [key, index]));
      list.sort((a, b) => {
        const aKey = a && a.id ? a.id : "";
        const bKey = b && b.id ? b.id : "";
        return (orderMap.get(aKey) ?? 0) - (orderMap.get(bKey) ?? 0);
      });
      return { list, shuffleOrder: nextShuffleOrder };
    }

    if (sort === "recent" || sort === "oldest") {
      list.sort((a, b) => {
        const aVal = parseDateValue(a);
        const bVal = parseDateValue(b);
        const aScore = aVal == null ? -Infinity : aVal;
        const bScore = bVal == null ? -Infinity : bVal;
        if (aScore === bScore) {
          const aIdx = indexMap && a && a.id ? indexMap.get(a.id) : 0;
          const bIdx = indexMap && b && b.id ? indexMap.get(b.id) : 0;
          return sort === "recent" ? aIdx - bIdx : bIdx - aIdx;
        }
        return sort === "recent" ? bScore - aScore : aScore - bScore;
      });
      return { list, shuffleOrder: nextShuffleOrder };
    }

    if (sort === "views") {
      list.sort((a, b) => {
        const aVal = parseViewsValue(a);
        const bVal = parseViewsValue(b);
        return (bVal == null ? -Infinity : bVal) - (aVal == null ? -Infinity : aVal);
      });
      return { list, shuffleOrder: nextShuffleOrder };
    }

    return { list, shuffleOrder: nextShuffleOrder };
  }

  function matchesItemFilter(item, filter) {
    const value = String(filter || "all").toLowerCase();
    if (value === "all") return true;
    const tags = Array.isArray(item && item.tags) ? item.tags.map((tag) => String(tag).toLowerCase()) : [];
    return tags.some((tag) => tag.includes(value));
  }

  function matchesItemSelectedTags(item, selectedTags) {
    const selected = Array.isArray(selectedTags) ? selectedTags : [...(selectedTags || [])];
    if (!selected.length) return true;
    const tags = Array.isArray(item && item.tags) ? item.tags.map((tag) => normalizeTag(tag)) : [];
    return selected.every((tag) => tags.includes(normalizeTag(tag)));
  }

  function matchesItemSelectedLocation(item, selectedLocationId, locationNameById) {
    if (!selectedLocationId) return true;
    const itemLocation = normalizeKey(item && item.location ? item.location : "");
    const selectedName =
      locationNameById && typeof locationNameById.get === "function"
        ? locationNameById.get(selectedLocationId) || ""
        : "";
    const selectedKey = normalizeKey(selectedName);
    return matchesLocationKey(itemLocation, selectedKey);
  }

  function matchesItemSearch(item, searchQuery) {
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) return true;
    const haystack = buildSearchText(item);
    if (!haystack) return false;
    return query
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => haystack.includes(term));
  }

  return {
    applySort,
    buildSearchText,
    matchesItemFilter,
    matchesItemSearch,
    matchesItemSelectedLocation,
    matchesItemSelectedTags,
    matchesLocationKey,
    normalizeKey,
    normalizeTag,
    parseDateValue,
    parseViewsValue,
    shuffleArray,
  };
});
