(() => {
  const apiBase =
    (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const apiBaseUrl = apiBase ? `${apiBase}/api/destinations` : "/api/destinations";
  const apiExpandedUrl = apiBase ? `${apiBase}/api/destinations-expanded` : "/api/destinations-expanded";
  const nameEl = document.getElementById("destName");
  const subtitleEl = document.getElementById("destSubtitle");
  const bulletsEl = document.getElementById("destBullets");
  const isoTitleEl = document.getElementById("isoTitle");
  const isoDescEl = document.getElementById("isoDesc");
  const isoBox = document.getElementById("isoBox");
  const isoImg = document.getElementById("isoImage");
  const isoLabel = document.getElementById("isoLabel");
  const narrativeEl = document.getElementById("destNarrative");
  const summaryEl = document.getElementById("destSummary");
  const resortNameEl = document.getElementById("resortName");
  const resortDescEl = document.getElementById("resortDesc");
  const diveSitesEl = document.getElementById("diveSitesList");
  const conditionsEl = document.getElementById("conditionsList");
  const seasonalityEl = document.getElementById("seasonalityText");
  const logisticsEl = document.getElementById("logisticsText");
  const experienceEl = document.getElementById("experienceText");
  const nonDivingEl = document.getElementById("nonDivingList");
  const heroEl = document.querySelector(".destination-hero");
  const heroRoot = document.documentElement;
  const dayToDayEl = document.getElementById("dayToDayText");
  const resortDetailsEl = document.getElementById("resortDetailsText");
  const logisticsDetailsEl = document.getElementById("logisticsDetailsText");
  const logisticsTipsEl = document.getElementById("logisticsTipsList");
  const diveSiteHighlightsEl = document.getElementById("diveSiteHighlights");
  const dayToDayTitleEl = document.getElementById("dayToDayTitle");
  const resortNotesTitleEl = document.getElementById("resortNotesTitle");
  const travelLogisticsTitleEl = document.getElementById("travelLogisticsTitle");
  const diveHighlightsTitleEl = document.getElementById("diveHighlightsTitle");
  const overviewTitleEl = document.getElementById("overviewTitle");
  const tripSummaryTitleEl = document.getElementById("tripSummaryTitle");
  const seasonalityTitleEl = document.getElementById("seasonalityTitle");
  const overviewLogisticsTitleEl = document.getElementById("overviewLogisticsTitle");
  const experienceTitleEl = document.getElementById("experienceTitle");
  const resortOpsTitleEl = document.getElementById("resortOpsTitle");
  const conditionsTitleEl = document.getElementById("conditionsTitle");
  const diveSitesTitleEl = document.getElementById("diveSitesTitle");
  const nonDivingTitleEl = document.getElementById("nonDivingTitle");
  const tripSnapshotTitleEl = document.getElementById("tripSnapshotTitle");
  const diveNowLinks = document.querySelectorAll(".dive-now-link");

  function mergeDestination(base, extra) {
    if (!base) return base;
    if (!extra) return base;

    const merged = { ...base, ...extra };

    const mergeArray = (primary, addon) => {
      if (!Array.isArray(primary) && !Array.isArray(addon)) return null;
      const seen = new Set();
      const result = [];
      [...(primary || []), ...(addon || [])].forEach((item) => {
        if (!item || seen.has(item)) return;
        seen.add(item);
        result.push(item);
      });
      return result;
    };

    const mergedTags = mergeArray(base.tags, extra.tags);
    if (mergedTags) merged.tags = mergedTags;

    const mergedBullets = mergeArray(base.bullets, extra.bullets);
    if (mergedBullets) merged.bullets = mergedBullets;

    const mergedDiveSites = mergeArray(base.diveSites, extra.diveSites);
    if (mergedDiveSites) merged.diveSites = mergedDiveSites;

    const mergedNonDiving = mergeArray(base.nonDiving, extra.nonDiving);
    if (mergedNonDiving) merged.nonDiving = mergedNonDiving;

    if (base.resort || extra.resort) {
      merged.resort = { ...(base.resort || {}), ...(extra.resort || {}) };
    }

    if (base.conditions || extra.conditions) {
      merged.conditions = { ...(base.conditions || {}), ...(extra.conditions || {}) };
    }

    return merged;
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function renderBullets(bullets) {
    if (!bulletsEl) return;
    bulletsEl.innerHTML = "";
    (bullets || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      bulletsEl.appendChild(li);
    });
  }

  function renderList(el, items) {
    if (!el) return;
    el.innerHTML = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      el.appendChild(li);
    });
  }

  function renderConditions(conditions) {
    if (!conditionsEl) return;
    conditionsEl.innerHTML = "";
    if (!conditions) return;

    const entries = [
      ["Visibility", conditions.visibility],
      ["Temperature", conditions.temperature],
      ["Currents", conditions.currents],
    ];

    entries.forEach(([label, value]) => {
      if (!value) return;
      const li = document.createElement("li");
      li.textContent = `${label}: ${value}`;
      conditionsEl.appendChild(li);
    });
  }

  function renderHighlights(items) {
    if (!diveSiteHighlightsEl) return;
    diveSiteHighlightsEl.innerHTML = "";
    (items || []).forEach((item) => {
      const card = document.createElement("article");
      card.className = "site-highlight-card";

      const title = document.createElement("h3");
      title.textContent = item?.name || item?.title || "Dive Site";

      const desc = document.createElement("p");
      desc.textContent = item?.details || item?.description || "";

      card.append(title, desc);
      diveSiteHighlightsEl.appendChild(card);
    });
  }

  function renderIso(dest) {
    if (!isoBox || !isoImg || !isoLabel) return;

    if (dest.isoImage) {
      isoImg.src = dest.isoImage;
      isoImg.alt = `Isometric view of ${dest.name}`;
      isoBox.classList.add("is-loaded");
      isoLabel.textContent = " ";
    } else {
      isoImg.removeAttribute("src");
      isoImg.alt = "";
      isoBox.classList.remove("is-loaded");
      isoLabel.textContent = "Image coming soon.";
    }
  }

  function setHeroImage(url) {
    if (!heroRoot) return;
    if (url) {
      heroRoot.style.setProperty("--destination-hero-image", `url("${url}")`);
      return;
    }
    heroRoot.style.removeProperty("--destination-hero-image");
  }

  function setDiveNowLinks(dest) {
    if (!diveNowLinks.length) return;

    const params = new URLSearchParams();
    params.set("interest", "travel");

    if (dest?.name) {
      params.set("location", dest.name);
    }

    const href = `../contact/index.html?${params.toString()}#dive-now`;
    diveNowLinks.forEach((link) => {
      link.setAttribute("href", href);
    });
  }

  function renderDestination(dest) {
    if (!dest) {
      setText(nameEl, "Destination Not Found");
      setText(subtitleEl, "Return to the travel page to pick a destination.");
      renderBullets([]);
      renderList(diveSitesEl, []);
      renderList(nonDivingEl, []);
      renderConditions(null);
      setText(narrativeEl, "We could not find that destination.");
      setText(summaryEl, "Summary unavailable.");
      setText(resortNameEl, "Resort name unavailable.");
      setText(resortDescEl, "Resort details unavailable.");
      setText(seasonalityEl, "Seasonality unavailable.");
      setText(logisticsEl, "Logistics unavailable.");
      setText(experienceEl, "Experience info unavailable.");
      setText(dayToDayEl, "Day-to-day details unavailable.");
      setText(resortDetailsEl, "Resort details unavailable.");
      setText(logisticsDetailsEl, "Logistics details unavailable.");
      renderList(logisticsTipsEl, []);
      renderHighlights([]);
      setText(dayToDayTitleEl, "Day-to-Day Diving");
      setText(resortNotesTitleEl, "Resort Notes");
      setText(travelLogisticsTitleEl, "Travel Logistics");
      setText(diveHighlightsTitleEl, "Dive Site Highlights");
      setText(overviewTitleEl, "Overview");
      setText(tripSummaryTitleEl, "Trip Summary");
      setText(seasonalityTitleEl, "Seasonality");
      setText(overviewLogisticsTitleEl, "Logistics");
      setText(experienceTitleEl, "Experience");
      setText(resortOpsTitleEl, "Resort and Dive Ops");
      setText(conditionsTitleEl, "Conditions");
      setText(diveSitesTitleEl, "Dive Sites");
      setText(nonDivingTitleEl, "Non-Diving");
      setText(tripSnapshotTitleEl, "Trip Snapshot");
      if (isoTitleEl) isoTitleEl.textContent = "Resort View (Isometric)";
      if (isoDescEl) isoDescEl.textContent = "Select a destination to load the resort view.";
      if (isoLabel) isoLabel.textContent = "Image coming soon.";
      setHeroImage(null);
      setDiveNowLinks(null);
      return;
    }

    setText(nameEl, dest.name || "Destination");
    setText(subtitleEl, dest.subtitle || "Explore this destination with DMZ Scuba.");
    renderBullets(dest.bullets);
    renderList(diveSitesEl, dest.diveSites);
    renderList(nonDivingEl, dest.nonDiving);
    renderConditions(dest.conditions);
    setText(narrativeEl, dest.narrative || "Explore this destination with DMZ Scuba.");
    setText(summaryEl, dest.summary || "Trip summary coming soon.");
    setText(resortNameEl, dest.resort?.name || "Resort details");
    setText(resortDescEl, dest.resort?.description || "Resort details coming soon.");
    setText(seasonalityEl, dest.seasonality || "Seasonality details coming soon.");
    setText(logisticsEl, dest.logistics || "Logistics details coming soon.");
    setText(experienceEl, dest.experience || "Experience details coming soon.");
    setText(dayToDayEl, dest.dayToDay || "Day-to-day details coming soon.");
    setText(resortDetailsEl, dest.resortDetails || dest.resort?.description || "Resort details coming soon.");
    setText(logisticsDetailsEl, dest.logisticsDetails || dest.logistics || "Logistics details coming soon.");
    renderList(logisticsTipsEl, dest.logisticsTips);
    renderHighlights(dest.diveSiteHighlights);
    setText(dayToDayTitleEl, dest.dayToDayTitle || "Day-to-Day Diving");
    setText(resortNotesTitleEl, dest.resortNotesTitle || "Resort Notes");
    setText(travelLogisticsTitleEl, dest.travelLogisticsTitle || "Travel Logistics");
    setText(diveHighlightsTitleEl, dest.diveHighlightsTitle || "Dive Site Highlights");
    setText(overviewTitleEl, dest.overviewTitle || "Overview");
    setText(tripSummaryTitleEl, dest.tripSummaryTitle || "Trip Summary");
    setText(seasonalityTitleEl, dest.seasonalityTitle || "Seasonality");
    setText(overviewLogisticsTitleEl, dest.overviewLogisticsTitle || "Logistics");
    setText(experienceTitleEl, dest.experienceTitle || "Experience");
    setText(resortOpsTitleEl, dest.resortOpsTitle || "Resort and Dive Ops");
    setText(conditionsTitleEl, dest.conditionsTitle || "Conditions");
    setText(diveSitesTitleEl, dest.diveSitesTitle || "Dive Sites");
    setText(nonDivingTitleEl, dest.nonDivingTitle || "Non-Diving");
    setText(tripSnapshotTitleEl, dest.tripSnapshotTitle || "Trip Snapshot");
    if (isoTitleEl) isoTitleEl.textContent = dest.isoTitle || "Resort View (Isometric)";
    if (isoDescEl) isoDescEl.textContent = dest.isoDesc || "Resort details coming soon.";
    renderIso(dest);
    setHeroImage(dest.heroImage);
    setDiveNowLinks(dest);

    if (dest.name) {
      document.title = `DMZ Scuba | ${dest.name}`;
    }
  }

  async function loadDestination() {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("id") || "").trim();

    try {
      let baseData = [];
      let expandedData = [];

      const [apiRes, apiExpandedRes] = await Promise.all([
        fetch(apiBaseUrl, { cache: "no-store" }).catch(() => null),
        fetch(apiExpandedUrl, { cache: "no-store" }).catch(() => null),
      ]);

      if (apiRes && apiRes.ok) {
        const apiJson = await apiRes.json();
        baseData = Array.isArray(apiJson.items) ? apiJson.items : [];
      }

      if (apiExpandedRes && apiExpandedRes.ok) {
        const apiJson = await apiExpandedRes.json();
        expandedData = Array.isArray(apiJson.items) ? apiJson.items : [];
      }

      if (!baseData.length) {
        const baseRes = await fetch("/assets/data/destinations.json", { cache: "no-store" });
        if (!baseRes.ok) throw new Error("Failed to load destinations");
        baseData = await baseRes.json();
      }

      if (!expandedData.length) {
        const expandedRes = await fetch("/assets/data/destinations-expanded.json", {
          cache: "no-store",
        }).catch(() => null);
        expandedData = expandedRes && expandedRes.ok ? await expandedRes.json() : [];
      }

      const baseDest = (baseData || []).find((item) => item.id === id);
      const extraDest = (expandedData || []).find((item) => item.id === id);
      const dest = mergeDestination(baseDest, extraDest);

      renderDestination(dest);
    } catch (err) {
      console.error("Failed to load destination:", err);
      renderDestination(null);
    }
  }

  loadDestination();
})();
