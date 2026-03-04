(() => {
  const root = document.querySelector("[data-event-detail-page]");
  if (!root) return;

  const scheduleUrl = root.getAttribute("data-events-src") || "/assets/data/events.json";
  const expandedUrl = root.getAttribute("data-events-expanded-src") || "/assets/data/events-expanded.json";

  const titleEl = document.getElementById("eventDetailTitle");
  const eyebrowEl = document.getElementById("eventDetailEyebrow");
  const heroSummaryEl = document.getElementById("eventDetailHeroSummary");
  const scheduleChipEl = document.getElementById("eventDetailScheduleChip");
  const typeChipEl = document.getElementById("eventDetailTypeChip");
  const narrativeEl = document.getElementById("eventDetailNarrative");
  const experienceEl = document.getElementById("eventDetailExperience");
  const scheduleNoteEl = document.getElementById("eventDetailScheduleNote");
  const whatToExpectEl = document.getElementById("eventDetailWhatToExpect");
  const includedEl = document.getElementById("eventDetailIncluded");
  const metaDateEl = document.getElementById("eventDetailMetaDate");
  const metaTimeEl = document.getElementById("eventDetailMetaTime");
  const metaLocationEl = document.getElementById("eventDetailMetaLocation");
  const summaryEl = document.getElementById("eventDetailSummary");
  const primaryLinkEl = document.getElementById("eventDetailPrimaryLink");
  const backLinks = document.querySelectorAll("[data-event-back-link]");
  const errorEl = document.getElementById("eventDetailError");

  const params = new URLSearchParams(window.location.search);
  const requestedId = String(params.get("id") || "").trim();
  const requestedDate = String(params.get("date") || "").trim();

  function findDefinition(payload, idValue) {
    const definitions = Array.isArray(payload && payload.definitions) ? payload.definitions : [];
    const needle = String(idValue || "").trim();
    if (!needle) return null;
    return (
      definitions.find((item) => item && (item.id === needle || item.slug === needle)) || null
    );
  }

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(date, count) {
    return new Date(date.getFullYear(), date.getMonth() + count, 1);
  }

  function addDays(date, count) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
  }

  function parseMonthAnchor(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-");
    if (parts.length !== 2) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
    return new Date(year, month - 1, 1);
  }

  function nthWeekdayOfMonth(year, monthIndex, weekOfMonth, weekday) {
    const first = new Date(year, monthIndex, 1);
    const shift = (7 + weekday - first.getDay()) % 7;
    const dayNumber = 1 + shift + (weekOfMonth - 1) * 7;
    const candidate = new Date(year, monthIndex, dayNumber);
    if (candidate.getMonth() !== monthIndex) return null;
    return candidate;
  }

  function getLegacyTemplateStartDate(template) {
    if (!template || !template.startMonth || !template.rule) return null;
    const anchor = parseMonthAnchor(template.startMonth);
    if (!anchor) return null;
    const weekOfMonth = Number(template.rule.weekOfMonth);
    const weekday = Number(template.rule.weekday);
    if (!Number.isFinite(weekOfMonth) || !Number.isFinite(weekday)) return null;
    return nthWeekdayOfMonth(anchor.getFullYear(), anchor.getMonth(), weekOfMonth, weekday);
  }

  function getTemplateStartDate(template) {
    const explicitStart = parseEventDate(String((template && template.startDate) || "").trim());
    if (explicitStart) return explicitStart;
    return getLegacyTemplateStartDate(template);
  }

  function addRepeatInterval(date, count, unit) {
    const interval = Math.max(1, Number(count) || 1);
    if (unit === "week") return addDays(date, interval * 7);
    if (unit === "year") return new Date(date.getFullYear() + interval, date.getMonth(), date.getDate());
    return new Date(date.getFullYear(), date.getMonth() + interval, date.getDate());
  }

  function parseEventDate(value) {
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeInstance(item) {
    if (!item || !item.date) return null;
    const dateObj = parseEventDate(item.date);
    if (!dateObj) return null;
    const anchorStartObj = parseEventDate(String(item.startDate || item.date || "").trim());
    const explicitEndDate = String(item.endDate || "").trim();
    const explicitEndDateObj = explicitEndDate ? parseEventDate(explicitEndDate) : null;
    const derivedDurationDays =
      anchorStartObj && explicitEndDateObj && explicitEndDateObj >= anchorStartObj
        ? Math.max(1, Math.round((explicitEndDateObj.getTime() - anchorStartObj.getTime()) / 86400000) + 1)
        : 1;
    const durationDays = Math.max(1, Number(item.durationDays) || derivedDurationDays);
    const endDateObj =
      explicitEndDateObj && explicitEndDateObj >= dateObj
        ? explicitEndDateObj
        : durationDays > 1
          ? addDays(dateObj, durationDays - 1)
          : dateObj;
    return {
      ...item,
      date: dateKey(dateObj),
      endDate: endDateObj > dateObj ? dateKey(endDateObj) : "",
      dateObj,
      endDateObj,
    };
  }

  function isTemplateDateExcluded(template, occurrenceDate) {
    const dateValue = occurrenceDate instanceof Date ? dateKey(occurrenceDate) : String(occurrenceDate || "").trim();
    return Array.isArray(template && template.excludedDates) && template.excludedDates.includes(dateValue);
  }

  function formatScheduleLine(item) {
    if (!item || !item.date) return "Date coming soon";
    const date = item.dateObj || parseEventDate(item.date);
    if (!date) return item.date;
    const parts = [
      date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    ];
    if (item.endDateObj && item.endDateObj > date) {
      parts[0] = `${parts[0]} - ${item.endDateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    if (item.time) {
      parts.push(item.endTime ? `${item.time} - ${item.endTime}` : item.time);
    }
    return parts.join(" | ");
  }

  function setList(el, items) {
    if (!el) return;
    el.innerHTML = "";
    (Array.isArray(items) ? items : []).forEach((value) => {
      const text = String(value || "").trim();
      if (!text) return;
      const li = document.createElement("li");
      li.textContent = text;
      el.appendChild(li);
    });
    if (!el.children.length) {
      const li = document.createElement("li");
      li.textContent = "Details will be added here.";
      el.appendChild(li);
    }
  }

  function buildInstances(payload) {
    const today = startOfDay(new Date());
    const currentMonth = startOfMonth(today);
    const horizonMonths = Math.max(1, Number(payload && payload.horizonMonths) || 30);
    const items = [];

    (Array.isArray(payload && payload.events) ? payload.events : []).forEach((eventItem) => {
      if (!eventItem || !eventItem.id || !eventItem.date) return;
      const normalized = normalizeInstance({
        ...eventItem,
        eventId: eventItem.eventId || eventItem.id,
      });
      if (!normalized || normalized.endDateObj < today) return;
      items.push(normalized);
    });

    (Array.isArray(payload && payload.templates) ? payload.templates : []).forEach((template) => {
      if (!template || !template.id) return;
      const anchor = getTemplateStartDate(template);
      if (!anchor) return;
      const repeatInterval = Math.max(1, Number(template.repeatInterval || template.intervalMonths) || 1);
      const repeatUnit = ["week", "month", "year"].includes(String(template.repeatUnit || "").trim())
        ? String(template.repeatUnit || "").trim()
        : "month";
      const allowedMonths = Array.isArray(template.months) ? template.months : null;
      const coverageEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + horizonMonths, 0);

      for (let occurrence = new Date(anchor); occurrence <= coverageEnd; occurrence = addRepeatInterval(occurrence, repeatInterval, repeatUnit)) {
        if (allowedMonths && !allowedMonths.includes(occurrence.getMonth() + 1)) continue;
        if (isTemplateDateExcluded(template, occurrence)) continue;

        const normalized = normalizeInstance({
          ...template,
          id: `${template.id}-${dateKey(occurrence)}`,
          eventId: template.eventId || template.id,
          date: dateKey(occurrence),
        });
        if (!normalized || normalized.endDateObj < today) continue;
        items.push(normalized);
      }
    });

    return items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function findBestInstance(instances, idValue, dateValue) {
    if (!idValue) return null;
    if (dateValue) {
      const exact = instances.find((item) => item.eventId === idValue && item.date === dateValue);
      if (exact) return exact;
      const inRange = instances.find((item) => {
        const endDate = String(item.endDate || item.date || "").trim();
        return item.eventId === idValue && item.date <= dateValue && endDate >= dateValue;
      });
      if (inRange) return inRange;
    }
    return instances.find((item) => item.eventId === idValue) || null;
  }

  function setText(el, value) {
    if (el) el.textContent = String(value || "");
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  async function loadJson(url) {
    const resp = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    if (!resp || !resp.ok) return null;
    return resp.json().catch(() => null);
  }

  async function init() {
    if (!requestedId) {
      showError("No event was selected.");
      return;
    }

    const [scheduleData, expandedData] = await Promise.all([
      loadJson(scheduleUrl),
      loadJson(expandedUrl),
    ]);

    if (!scheduleData) {
      showError("The event schedule could not be loaded.");
      return;
    }

    const instances = buildInstances(scheduleData);
    const definition = findDefinition(scheduleData, requestedId);
    const resolvedId = definition ? definition.id : requestedId;
    const instance = findBestInstance(instances, resolvedId, requestedDate);
    const extra =
      (Array.isArray(expandedData) ? expandedData : []).find((item) => item && item.id === resolvedId) || {};

    if (!instance && !extra.id && !definition) {
      showError("We could not find that event.");
      return;
    }

    const title = (definition && definition.title) || extra.title || (instance && instance.title) || "Event";
    const heroSummary =
      (definition && definition.heroSummary) ||
      extra.heroSummary ||
      (instance && instance.summary) ||
      "Event details are loading.";
    const summary =
      (instance && instance.summary) ||
      (definition && definition.heroSummary) ||
      extra.heroSummary ||
      "";
    const scheduleLine = instance ? formatScheduleLine(instance) : "Schedule will be posted soon";
    const timeLine = instance && instance.time
      ? instance.endTime
        ? `${instance.time} - ${instance.endTime}`
        : instance.time
      : "Time announced soon";

    document.title = `DMZ Scuba | ${title}`;
    setText(titleEl, title);
    setText(
      eyebrowEl,
      (definition && definition.eyebrow) ||
      extra.eyebrow ||
      (definition && definition.type) ||
      (instance && instance.type) ||
      "DMZ Event"
    );
    setText(heroSummaryEl, heroSummary);
    setText(scheduleChipEl, scheduleLine);
    setText(
      typeChipEl,
      instance && instance.status
        ? `${instance.type || "Event"} | ${instance.status}`
        : (instance && instance.type) || "Event"
    );
    setText(
      narrativeEl,
      (definition && definition.narrative) || extra.narrative || summary || "Full event detail content will appear here."
    );
    setText(
      experienceEl,
      (definition && definition.experience) || extra.experience || "Experience guidance for this event will be added here."
    );
    setText(
      scheduleNoteEl,
      (definition && definition.scheduleNote) ||
        extra.scheduleNote ||
        "This event will support both recurring templates and one-time date overrides."
    );
    setText(metaDateEl, instance ? scheduleLine : "Schedule will be posted soon");
    setText(metaTimeEl, timeLine);
    setText(metaLocationEl, (instance && instance.location) || "Location announced soon");
    setText(summaryEl, summary || "The event summary will appear here once the schedule is finalized.");
    setList(whatToExpectEl, (definition && definition.whatToExpect) || extra.whatToExpect);
    setList(includedEl, (definition && definition.included) || extra.included);

    if (primaryLinkEl) {
      primaryLinkEl.textContent =
        (definition && definition.primaryCtaLabel) ||
        extra.primaryCtaLabel ||
        (instance && instance.ctaLabel) ||
        "Contact DMZ";
      primaryLinkEl.href =
        (definition && definition.primaryCtaHref) ||
        extra.primaryCtaHref ||
        (instance && instance.ctaHref) ||
        "/pages/contact/index.html#dive-now";
    }

    backLinks.forEach((link) => {
      link.setAttribute(
        "href",
        requestedDate
          ? `/pages/events/index.html?date=${encodeURIComponent(requestedDate)}`
          : "/pages/events/index.html"
      );
    });
  }

  init();
})();
