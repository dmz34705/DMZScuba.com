(() => {
  const root = document.querySelector("[data-nfc-events]");
  if (!root) return;

  const list = root.querySelector("[data-nfc-events-list]");
  const empty = root.querySelector("[data-nfc-events-empty]");
  const monthLabel = root.querySelector("[data-nfc-events-month]");
  const countLabel = root.querySelector("[data-nfc-events-count]");
  const dataUrl = root.getAttribute("data-events-src") || "/api/v2/events";
  const fallbackUrl = root.getAttribute("data-events-fallback-src") || "/assets/data/events.json";

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
  const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function parseDateKey(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-");
    if (parts.length !== 3) return null;
    const parsed = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function parseMonthAnchor(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-");
    if (parts.length !== 2) return null;
    const parsed = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function addDays(date, count) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
  }

  function addMonths(date, count) {
    return new Date(date.getFullYear(), date.getMonth() + count, date.getDate());
  }

  function addRepeatInterval(date, count, unit) {
    const interval = Math.max(1, Number(count) || 1);
    if (unit === "week") return addDays(date, interval * 7);
    if (unit === "year") return new Date(date.getFullYear() + interval, date.getMonth(), date.getDate());
    return addMonths(date, interval);
  }

  function nthWeekdayOfMonth(year, monthIndex, weekOfMonth, weekday) {
    const first = new Date(year, monthIndex, 1);
    const shift = (7 + weekday - first.getDay()) % 7;
    const candidate = new Date(year, monthIndex, 1 + shift + (weekOfMonth - 1) * 7);
    return candidate.getMonth() === monthIndex ? candidate : null;
  }

  function templateStartDate(template) {
    const explicit = parseDateKey(String((template && template.startDate) || "").trim());
    if (explicit) return explicit;
    const anchor = parseMonthAnchor(String((template && template.startMonth) || "").trim());
    const rule = template && template.rule;
    if (!anchor || !rule) return null;
    return nthWeekdayOfMonth(anchor.getFullYear(), anchor.getMonth(), Number(rule.weekOfMonth), Number(rule.weekday));
  }

  function normalizeEvent(item, sourceDate) {
    const dateObj = sourceDate || parseDateKey(String((item && item.date) || "").trim());
    if (!dateObj) return null;
    const endDateObj = parseDateKey(String((item && item.endDate) || "").trim()) || dateObj;
    return {
      id: String((item && item.id) || `${dateKey(dateObj)}-${Math.random()}`),
      title: String((item && item.title) || "DMZ Scuba Event"),
      type: String((item && item.type) || "Event"),
      summary: String((item && item.summary) || ""),
      location: String((item && item.location) || ""),
      time: String((item && item.time) || ""),
      dateObj,
      endDateObj,
    };
  }

  function expandEvents(payload) {
    const today = startOfDay(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const events = [];

    (Array.isArray(payload.events) ? payload.events : []).forEach((item) => {
      const eventItem = normalizeEvent(item);
      if (eventItem && eventItem.endDateObj >= today && eventItem.dateObj <= monthEnd) events.push(eventItem);
    });

    (Array.isArray(payload.templates) ? payload.templates : []).forEach((template) => {
      const start = templateStartDate(template);
      if (!start) return;
      const repeatInterval = Math.max(1, Number(template.repeatInterval || template.intervalMonths) || 1);
      const repeatUnit = ["week", "month", "year"].includes(String(template.repeatUnit || "").trim())
        ? String(template.repeatUnit || "").trim()
        : "month";
      const excluded = Array.isArray(template.excludedDates) ? template.excludedDates : [];

      for (let occurrence = new Date(start); occurrence <= monthEnd; occurrence = addRepeatInterval(occurrence, repeatInterval, repeatUnit)) {
        if (occurrence < monthStart) continue;
        if (occurrence < today) continue;
        if (excluded.includes(dateKey(occurrence))) continue;
        const eventItem = normalizeEvent(template, occurrence);
        if (eventItem) events.push(eventItem);
      }
    });

    return events.sort((a, b) => a.dateObj - b.dateObj).slice(0, 6);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!response || !response.ok) return null;
    return response.json().catch(() => null);
  }

  function render(events) {
    const today = new Date();
    monthLabel.textContent = monthFormatter.format(today);
    countLabel.textContent = events.length ? `${events.length} open` : "No public posts";
    empty.hidden = events.length > 0;
    list.innerHTML = events
      .map((eventItem) => {
        const typeClass = eventItem.type.toLowerCase().includes("travel")
          ? "travel"
          : eventItem.type.toLowerCase().includes("training")
            ? "training"
            : "";
        const meta = [dayFormatter.format(eventItem.dateObj), eventItem.time].filter(Boolean).join(" | ");
        const summary = eventItem.summary || eventItem.location || "Reach out for details and availability.";
        return `
          <article class="nfc-event-item ${typeClass}">
            <div class="nfc-event-date">${escapeHtml(meta)}</div>
            <h3>${escapeHtml(eventItem.title)}</h3>
            <p>${escapeHtml(summary)}</p>
          </article>
        `;
      })
      .join("");
  }

  (async function init() {
    const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const payload = isLocalPreview
      ? (await fetchJson(fallbackUrl)) || {}
      : (await fetchJson(dataUrl)) || (await fetchJson(fallbackUrl)) || {};
    render(expandEvents(payload));
  })();
})();
