(() => {
  const pageRoot = document.querySelector("[data-events-page]");
  const previewRoot = document.querySelector("[data-events-preview]");
  const embedFrame = document.querySelector("[data-events-embed-frame]");
  if (!pageRoot && !previewRoot && !embedFrame) return;

  const dataUrl =
    (pageRoot && pageRoot.getAttribute("data-events-src")) ||
    (previewRoot && previewRoot.getAttribute("data-events-src")) ||
    "/assets/data/events.json";
  const fallbackDataUrl =
    (pageRoot && pageRoot.getAttribute("data-events-fallback-src")) ||
    (previewRoot && previewRoot.getAttribute("data-events-fallback-src")) ||
    "/assets/data/events.json";
  const registrationApiRoot = "/api/v2/events";
  const previewTypeFilter = previewRoot
    ? String(previewRoot.getAttribute("data-events-preview-type") || "")
        .split(",")
        .map((value) => normalizeText(value))
        .filter(Boolean)
    : [];
  const previewCallToAction = previewRoot
    ? normalizeText(previewRoot.getAttribute("data-events-preview-cta") || "")
    : "";

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const monthShortFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
  });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  });
  const weekdayLongFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const EVENT_TYPE_META = {
    Training: { icon: "T", className: "event-type-training" },
    Travel: { icon: "TR", className: "event-type-travel" },
    "Local Dive": { icon: "LD", className: "event-type-local-dive" },
    Workshop: { icon: "WS", className: "event-type-workshop" },
    Community: { icon: "CM", className: "event-type-community" },
    Event: { icon: "EV", className: "event-type-default" },
  };
  const state = {
    payload: {},
    eventsById: new Map(),
    publicModal: null,
    registrationSnapshotByKey: new Map(),
    lastDateModalContext: null,
    activeEventShareUrl: "",
    adminCanEditDate: false,
    openDateModalRequestKey: "",
    calendarView: {
      activeMonthKey: "",
      selectedDateKey: "",
    },
  };

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

  function dateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function monthKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
    ].join("-");
  }

  function parseEventDate(eventItem) {
    const parsed = new Date(`${eventItem.date}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function parseDateKey(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("-");
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
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

  function addRepeatInterval(date, count, unit) {
    const interval = Math.max(1, Number(count) || 1);
    if (unit === "week") return addDays(date, interval * 7);
    if (unit === "year") return new Date(date.getFullYear() + interval, date.getMonth(), date.getDate());
    return new Date(date.getFullYear(), date.getMonth() + interval, date.getDate());
  }

  function getTemplateStartDate(template) {
    const explicitStart = parseDateKey(String((template && template.startDate) || "").trim());
    if (explicitStart) return explicitStart;
    return getLegacyTemplateStartDate(template);
  }

  function normalizeEventInstance(eventItem) {
    if (!eventItem || !eventItem.date) return null;
    const dateObj = parseEventDate(eventItem);
    if (!dateObj) return null;
    const anchorStartObj = parseDateKey(String(eventItem.startDate || eventItem.date || "").trim());
    const explicitEndDate = String(eventItem.endDate || "").trim();
    const explicitEndDateObj = explicitEndDate ? parseDateKey(explicitEndDate) : null;
    const derivedDurationDays =
      anchorStartObj && explicitEndDateObj && explicitEndDateObj >= anchorStartObj
        ? Math.max(1, Math.round((explicitEndDateObj.getTime() - anchorStartObj.getTime()) / 86400000) + 1)
        : 1;
    const durationDays = Math.max(1, Number(eventItem.durationDays) || derivedDurationDays);
    const endDateObj =
      explicitEndDateObj && explicitEndDateObj >= dateObj
        ? explicitEndDateObj
        : durationDays > 1
          ? addDays(dateObj, durationDays - 1)
          : dateObj;
    return {
      ...eventItem,
      date: dateKey(dateObj),
      endDate: endDateObj > dateObj ? dateKey(endDateObj) : "",
      dateObj,
      endDateObj,
      sourceId: eventItem.sourceId || eventItem.id || "",
    };
  }

  function eventLastDateKey(eventItem) {
    return String((eventItem && (eventItem.endDate || eventItem.date)) || "").trim();
  }

  function eventCoversDateKey(eventItem, targetKey) {
    const start = String((eventItem && eventItem.date) || "").trim();
    const end = eventLastDateKey(eventItem);
    return Boolean(start && targetKey && start <= targetKey && end >= targetKey);
  }

  function eventOverlapsMonth(eventItem, monthDate) {
    if (!eventItem || !monthDate) return false;
    const monthStart = dateKey(monthDate);
    const monthEnd = dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    return String(eventItem.date || "") <= monthEnd && eventLastDateKey(eventItem) >= monthStart;
  }

  function isTemplateDateExcluded(template, occurrenceDate) {
    const dateValue = occurrenceDate instanceof Date ? dateKey(occurrenceDate) : String(occurrenceDate || "").trim();
    return Array.isArray(template && template.excludedDates) && template.excludedDates.includes(dateValue);
  }

  function firstVisibleDateKeyForMonth(eventItem, monthDate) {
    if (!eventItem || !monthDate) return "";
    const monthStart = dateKey(monthDate);
    if (eventCoversDateKey(eventItem, monthStart)) return monthStart;
    return String(eventItem.date || "").trim();
  }

  function expandTemplateEvents(payload) {
    const today = startOfDay(new Date());
    const currentMonth = startOfMonth(today);
    const horizonMonths = Math.max(1, Number(payload && payload.horizonMonths) || 30);
    const explicitEvents = payload && Array.isArray(payload.events) ? payload.events : [];
    const templates = payload && Array.isArray(payload.templates) ? payload.templates : [];
    const generated = [];

    explicitEvents.forEach((eventItem) => {
      const normalized = normalizeEventInstance({
        ...eventItem,
        eventId: eventItem.eventId || eventItem.id,
        sourceId: eventItem.id || "",
      });
      if (!normalized || normalized.endDateObj < today) return;
      generated.push(normalized);
    });

    templates.forEach((template) => {
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

        const normalized = normalizeEventInstance({
          ...template,
          id: `${template.id}-${dateKey(occurrence)}`,
          eventId: template.eventId || template.id,
          date: dateKey(occurrence),
          sourceId: template.id || "",
        });
        if (!normalized || normalized.endDateObj < today) continue;
        generated.push(normalized);
      }
    });

    return generated.sort((a, b) => a.dateObj - b.dateObj);
  }

  function buildMonthGroups(events, horizonMonths) {
    const today = startOfDay(new Date());
    const currentMonth = startOfMonth(today);
    const months = [];
    const groupsByKey = new Map();

    for (let offset = 0; offset < horizonMonths; offset += 1) {
      const monthDate = addMonths(currentMonth, offset);
      const group = {
        key: monthKey(monthDate),
        monthDate,
        events: [],
      };
      months.push(group);
      groupsByKey.set(group.key, group);
    }

    events.forEach((eventItem) => {
      months.forEach((group) => {
        if (eventOverlapsMonth(eventItem, group.monthDate)) group.events.push(eventItem);
      });
    });

    return months;
  }

  function eventDateLabel(eventItem, options = {}) {
    const parts = [dayFormatter.format(eventItem.dateObj)];
    if (eventItem.endDateObj && eventItem.endDateObj > eventItem.dateObj) {
      parts[0] = `${parts[0]} - ${dayFormatter.format(eventItem.endDateObj)}`;
    }
    if (options.includeTime !== false && eventItem.time) {
      parts.push(eventItem.endTime ? `${eventItem.time} - ${eventItem.endTime}` : eventItem.time);
    }
    return parts.join(" | ");
  }

  function getEventTypeMeta(type) {
    return EVENT_TYPE_META[type] || EVENT_TYPE_META.Event;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeList(value) {
    return Array.isArray(value)
      ? value.map((item) => normalizeText(item)).filter(Boolean)
      : [];
  }

  function normalizeCompareText(value) {
    return normalizeText(value).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getRegistrationSourceId(eventItem) {
    return normalizeText(eventItem && (eventItem.sourceId || eventItem.id)).toLowerCase();
  }

  function getRegistrationDateKey(eventItem) {
    return normalizeText(eventItem && eventItem.date);
  }

  function isRegistrationEnabled(eventItem) {
    const enabled = Boolean(eventItem && eventItem.registrationEnabled);
    const capacity = Math.max(0, Number((eventItem && eventItem.registrationCapacity) || 0) || 0);
    return enabled && capacity > 0;
  }

  function isRegistrationClosed(eventItem) {
    return Boolean(eventItem && eventItem.registrationClosed);
  }

  function getRegistrationApprovalStatus(registrant) {
    const source = normalizeText(registrant && registrant.source);
    if (source === "management_roster" || normalizeText(registrant && registrant.contactId)) return "approved";
    return normalizeText(registrant && registrant.approvalStatus) === "approved" ? "approved" : "pending";
  }

  function registrationSnapshotCacheKey(sourceId, eventDate) {
    return `${String(sourceId || "").trim().toLowerCase()}|${String(eventDate || "").trim()}`;
  }

  async function fetchRegistrationSnapshot(sourceId, eventDate) {
    const cacheKey = registrationSnapshotCacheKey(sourceId, eventDate);
    if (state.registrationSnapshotByKey.has(cacheKey)) {
      return state.registrationSnapshotByKey.get(cacheKey);
    }
    const url = `${registrationApiRoot}/${encodeURIComponent(sourceId)}/registrations?date=${encodeURIComponent(eventDate)}`;
    const resp = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!resp || !resp.ok) {
      state.registrationSnapshotByKey.set(cacheKey, null);
      return null;
    }
    const json = await resp.json().catch(() => null);
    state.registrationSnapshotByKey.set(cacheKey, json);
    return json;
  }

  async function submitRegistration(sourceId, payload) {
    const url = `${registrationApiRoot}/${encodeURIComponent(sourceId)}/registrations`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!resp) return { ok: false, error: "Network error." };
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json || !json.ok) {
      return { ok: false, error: (json && json.error) || "Registration failed." };
    }
    return json;
  }

  function getEventDefinition(eventItem) {
    if (!eventItem || !state.payload || !Array.isArray(state.payload.definitions)) return null;
    const eventId = normalizeText(eventItem.eventId || eventItem.id);
    if (!eventId) return null;
    return state.payload.definitions.find((item) => normalizeText(item && item.id) === eventId) || null;
  }

  function createDetailTrigger(eventItem, label, tone = "secondary", options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn ${tone}`;
    button.textContent = label;
    button.setAttribute("data-events-open-detail", normalizeText(eventItem && eventItem.id));
    if (options.autoOpenRegistration) {
      button.setAttribute("data-events-open-register", "true");
    }
    return button;
  }

  function buildEventShareUrl(eventItem, options = {}) {
    const key = normalizeText(eventItem && eventItem.id);
    if (!key) return "";
    const url = new URL("/pages/events/index.html", window.location.origin);
    url.searchParams.set("event", key);
    if (eventItem && eventItem.date) url.searchParams.set("date", String(eventItem.date).trim());
    if (options.register) url.searchParams.set("register", "1");
    return url.toString();
  }

  function syncEventShareUrl(eventItem, options = {}) {
    if (!pageRoot || !window.history || !window.location) return;
    const nextUrl = buildEventShareUrl(eventItem, options);
    if (!nextUrl) return;
    state.activeEventShareUrl = nextUrl;
    window.history.replaceState({ eventId: normalizeText(eventItem && eventItem.id) }, "", nextUrl);
  }

  function clearEventShareUrl() {
    state.activeEventShareUrl = "";
    if (!pageRoot || !window.history || !window.location) return;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("event");
    cleanUrl.searchParams.delete("register");
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}`);
  }

  async function shareEventLink(url, title) {
    const shareUrl = String(url || "").trim();
    if (!shareUrl) return { ok: false, message: "Share link unavailable right now." };
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || "DMZ Scuba Event",
          text: "Sign up for this DMZ Scuba event.",
          url: shareUrl,
        });
        return { ok: true, message: "Share sheet opened." };
      } catch (error) {
        if (error && error.name === "AbortError") return { ok: false, message: "" };
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        return { ok: true, message: "Direct event link copied." };
      } catch (_error) {
        // Fall through to manual copy guidance.
      }
    }
    return { ok: false, message: shareUrl };
  }

  function ensurePublicModal() {
    if (state.publicModal) return state.publicModal;
    const modal = document.createElement("div");
    modal.className = "events-public-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="events-public-modal-card" role="dialog" aria-modal="true" aria-label="Event details">
        <div class="events-public-modal-head">
          <div class="events-public-modal-copy">
            <span class="events-public-modal-kicker" data-events-modal-kicker></span>
            <h3 data-events-modal-title></h3>
            <p data-events-modal-subtitle></p>
          </div>
          <div class="events-public-modal-head-actions">
            <button class="events-public-modal-back" type="button" aria-label="Back to selected date events" hidden>Back</button>
            <button class="events-public-modal-close" type="button" aria-label="Close event details">Close</button>
          </div>
        </div>
        <div class="events-public-modal-body" data-events-modal-body></div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("events-public-modal-open");
    };
    const closeBtn = modal.querySelector(".events-public-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", close);
    const backBtn = modal.querySelector(".events-public-modal-back");
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.getAttribute("aria-hidden") === "false") close();
    });
    state.publicModal = {
      root: modal,
      body: modal.querySelector("[data-events-modal-body]"),
      kicker: modal.querySelector("[data-events-modal-kicker]"),
      title: modal.querySelector("[data-events-modal-title]"),
      subtitle: modal.querySelector("[data-events-modal-subtitle]"),
      backBtn,
    };
    return state.publicModal;
  }

  function openPublicModal({ kicker, title, subtitle, bodyBuilder }) {
    const modal = ensurePublicModal();
    if (!modal || !modal.body || !modal.kicker || !modal.title || !modal.subtitle) return;
    modal.kicker.textContent = normalizeText(kicker);
    modal.title.textContent = normalizeText(title);
    modal.subtitle.textContent = normalizeText(subtitle);
    if (modal.backBtn) {
      modal.backBtn.hidden = true;
      modal.backBtn.onclick = null;
    }
    modal.body.innerHTML = "";
    if (typeof bodyBuilder === "function") bodyBuilder(modal.body);
    modal.root.setAttribute("aria-hidden", "false");
    document.body.classList.add("events-public-modal-open");
  }

  function openDateEventsModal(dateValue, items) {
    const modal = ensurePublicModal();
    const selectedDate = parseDateKey(dateValue) || new Date();
    const eventItems = Array.isArray(items) ? items : [];
    state.lastDateModalContext = {
      dateValue: dateKey(selectedDate),
      items: eventItems.slice(),
    };
    openPublicModal({
      kicker: "Selected Date",
      title: weekdayLongFormatter.format(selectedDate),
      subtitle: eventItems.length
        ? `${eventItems.length} event${eventItems.length === 1 ? "" : "s"} on this date`
        : "No events on this date",
      bodyBuilder: (body) => {
        if (!eventItems.length) {
          const empty = document.createElement("p");
          empty.className = "events-public-empty";
          empty.textContent = "There are no published events for this date yet.";
          body.appendChild(empty);
          return;
        }
        const list = document.createElement("div");
        list.className = "events-public-day-list";
        eventItems.forEach((eventItem) => {
          const row = renderAgendaRow(eventItem);
          row.classList.add("events-public-day-row");
          if (state.adminCanEditDate) {
            const actions = row.querySelector(".event-card-actions");
            if (actions) {
              const editBtn = document.createElement("button");
              editBtn.type = "button";
              editBtn.className = "btn secondary";
              editBtn.textContent = "Edit";
              editBtn.addEventListener("click", () => {
                const sourceId = getRegistrationSourceId(eventItem);
                if (window.parent !== window) {
                  window.parent.postMessage(
                    {
                      type: "dmzEventsAdminEditDate",
                      date: dateKey(selectedDate),
                      eventIds: sourceId ? [sourceId] : [],
                    },
                    "*"
                  );
                }
                closePublicModal();
              });
              actions.appendChild(editBtn);
            }
          }
          list.appendChild(row);
          if (isRegistrationEnabled(eventItem)) {
            const sourceId = getRegistrationSourceId(eventItem);
            const eventDate = getRegistrationDateKey(eventItem);
            if (sourceId && eventDate) {
              const infoLine = row.querySelector(".event-card-agenda-info");
              if (infoLine) {
                const spots = document.createElement("span");
                spots.className = "event-card-spots";
                spots.textContent = " | Checking spots...";
                infoLine.appendChild(spots);
                fetchRegistrationSnapshot(sourceId, eventDate).then((snapshot) => {
                  if (!snapshot || !snapshot.ok) {
                    spots.textContent = " | Spots unavailable";
                    return;
                  }
                  const closed = Boolean(snapshot.registrationClosed || isRegistrationClosed(eventItem));
                  const remaining = Math.max(0, Number(snapshot.remainingSpots) || 0);
                  const capacity = Math.max(0, Number(snapshot.registrationCapacity) || 0);
                  spots.textContent = closed ? " | registration closed" : ` | ${remaining}/${capacity} open`;
                });
              }
            }
          }
        });
        body.appendChild(list);
      },
    });
  }

  function openEventDetailModalById(eventKey, options = {}) {
    const key = normalizeText(eventKey);
    if (!key) return;
    const eventItem = state.eventsById.get(key);
    if (!eventItem) return;
    const urlParams = new URLSearchParams(window.location.search);
    const autoOpenRegistration =
      Boolean(options && options.autoOpenRegistration) ||
      (urlParams.get("register") === "1" && normalizeText(urlParams.get("event")) === key);
    const definition = getEventDefinition(eventItem);
    const typeMeta = getEventTypeMeta(eventItem.type);
    const summary = normalizeText(eventItem.summary || "");
    const heroSummary = normalizeText((definition && definition.heroSummary) || "");
    const narrative = normalizeText((definition && definition.narrative) || "");
    const explicitDefinitionId = normalizeText(eventItem && eventItem.eventId);
    const eventItemKey = normalizeText(eventItem && eventItem.id);
    const hasSeparateDefinition = Boolean(explicitDefinitionId && explicitDefinitionId !== eventItemKey);
    const primaryDescription = hasSeparateDefinition
      ? (narrative || summary || heroSummary)
      : (summary || narrative || heroSummary);
    const locationText = normalizeText(eventItem.location) || "Location announced soon";
    const whenText = eventDateLabel(eventItem);
    const ctaLabel = normalizeText(
      eventItem.ctaLabel ||
        (definition && definition.primaryCtaLabel) ||
        "Contact Us"
    );
    const ctaHref = normalizeText(
      eventItem.ctaHref ||
        (definition && definition.primaryCtaHref) ||
        "/pages/contact/index.html#dive-now"
    );
    const registrationEnabled = isRegistrationEnabled(eventItem);
    const whatToExpect = normalizeList(definition && definition.whatToExpect);
    const included = normalizeList(definition && definition.included);
    const modal = ensurePublicModal();
    const shareUrl = buildEventShareUrl(eventItem, { register: registrationEnabled });
    syncEventShareUrl(eventItem, { register: autoOpenRegistration && registrationEnabled });

    openPublicModal({
      kicker: eventItem.type || "Event",
      title: normalizeText(eventItem.title || (definition && definition.title) || "Event"),
      subtitle: `${whenText} | ${locationText}`,
      bodyBuilder: (body) => {
        const meta = document.createElement("div");
        meta.className = "events-public-meta";
        meta.innerHTML = `
          <span class="event-chip">
            <span class="event-chip-icon" aria-hidden="true">${typeMeta.icon}</span>
            <span>${eventItem.type || "Event"}</span>
          </span>
          ${eventItem.status ? `<span class="event-status">${eventItem.status}</span>` : ""}
        `;
        body.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "events-public-actions";
        const shareBtn = document.createElement("button");
        shareBtn.type = "button";
        shareBtn.className = "btn secondary";
        shareBtn.textContent = registrationEnabled ? "Share Sign-Up Link" : "Share Event Link";
        let registerBtn = null;
        if (registrationEnabled) {
          registerBtn = document.createElement("button");
          registerBtn.type = "button";
          registerBtn.className = "btn primary";
          registerBtn.textContent = "Register For Event";
          actions.appendChild(registerBtn);
        }
        if (!registrationEnabled) {
          const actionLink = document.createElement("a");
          actionLink.className = "btn secondary";
          actionLink.href = ctaHref;
          actionLink.textContent = ctaLabel || "Contact Us";
          actions.appendChild(actionLink);
        }
        actions.appendChild(shareBtn);
        body.appendChild(actions);
        const shareFeedback = document.createElement("p");
        shareFeedback.className = "events-registration-feedback";
        shareFeedback.hidden = true;
        body.appendChild(shareFeedback);

        if (primaryDescription) {
          const intro = document.createElement("p");
          intro.className = "events-public-summary";
          intro.textContent = primaryDescription;
          body.appendChild(intro);
        }

        if (whatToExpect.length) {
          const title = document.createElement("h4");
          title.className = "events-public-list-title";
          title.textContent = "What To Expect";
          body.appendChild(title);
          const list = document.createElement("ul");
          list.className = "events-public-list";
          whatToExpect.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            list.appendChild(li);
          });
          body.appendChild(list);
        }

        if (included.length) {
          const title = document.createElement("h4");
          title.className = "events-public-list-title";
          title.textContent = "Highlights";
          body.appendChild(title);
          const list = document.createElement("ul");
          list.className = "events-public-list";
          included.forEach((item) => {
            const li = document.createElement("li");
            li.textContent = item;
            list.appendChild(li);
          });
          body.appendChild(list);
        }

        shareBtn.addEventListener("click", async () => {
          const result = await shareEventLink(shareUrl, eventItem.title || "DMZ Scuba Event");
          if (!result.message) return;
          shareFeedback.hidden = false;
          shareFeedback.textContent = result.ok ? result.message : `Copy this link: ${result.message}`;
        });

        if (isRegistrationEnabled(eventItem)) {
          const sourceId = getRegistrationSourceId(eventItem);
          const eventDate = getRegistrationDateKey(eventItem);
          if (sourceId && eventDate) {
            const regWrap = document.createElement("section");
            regWrap.className = "events-registration";
            regWrap.hidden = true;
            regWrap.innerHTML = `
              <h4 class="events-public-list-title">Event Registration</h4>
              <p class="events-registration-meta" data-events-registration-meta>Loading registration status...</p>
              <div class="events-registration-list-wrap">
                <h5>Currently Registered</h5>
                <ul class="events-registration-list" data-events-registration-list></ul>
              </div>
              <p class="events-registration-closed" data-events-registration-closed hidden>Registration has closed for this event.</p>
              <form class="events-registration-form" data-events-registration-form>
                <label><span>First Name</span><input type="text" name="firstName" required /></label>
                <label><span>Last Name</span><input type="text" name="lastName" required /></label>
                <label><span>Email</span><input type="email" name="email" required /></label>
                <label><span>Phone</span><input type="tel" name="phone" required /></label>
                <label><span>Certification Level</span>
                  <select name="certificationLevel" required>
                    <option value="">Select one</option>
                    <option value="Open Water">Open Water</option>
                    <option value="Advanced Open Water">Advanced Open Water</option>
                    <option value="Rescue Diver">Rescue Diver</option>
                    <option value="Divemaster">Divemaster</option>
                    <option value="Instructor">Instructor</option>
                    <option value="Not Certified Yet">Not Certified Yet</option>
                  </select>
                </label>
                <label><span>Additional Guests</span><input type="number" min="0" max="20" name="additionalGuests" value="0" /></label>
                <div class="events-registration-actions">
                  <button class="btn primary" type="submit">Submit Registration</button>
                </div>
              </form>
              <p class="events-registration-feedback" data-events-registration-feedback aria-live="polite"></p>
            `;
            body.appendChild(regWrap);

            const metaEl = regWrap.querySelector("[data-events-registration-meta]");
            const feedbackEl = regWrap.querySelector("[data-events-registration-feedback]");
            const listEl = regWrap.querySelector("[data-events-registration-list]");
            const formEl = regWrap.querySelector("[data-events-registration-form]");
            const closedEl = regWrap.querySelector("[data-events-registration-closed]");

            const renderSnapshot = (snapshot) => {
              if (!snapshot || !metaEl || !listEl) return;
              const capacity = Math.max(0, Number(snapshot.registrationCapacity) || 0);
              const remaining = Math.max(0, Number(snapshot.remainingSpots) || 0);
              const isClosed = Boolean(snapshot.registrationClosed || isRegistrationClosed(eventItem));
              const isFull = capacity > 0 && remaining <= 0;
              const isUnavailable = isClosed || isFull;
              metaEl.textContent = isClosed
                ? "Registration is closed for this event."
                : isFull
                  ? "This event is fully booked."
                  : `${remaining} of ${capacity} spots remaining`;
              if (formEl) formEl.hidden = isUnavailable;
              if (closedEl) closedEl.hidden = !isUnavailable;
              const registrants = Array.isArray(snapshot.registeredDivers)
                ? snapshot.registeredDivers
                : (Array.isArray(snapshot.registrants) ? snapshot.registrants : []);
              listEl.innerHTML = "";
              if (!registrants.length) {
                const li = document.createElement("li");
                li.textContent = "No registered divers yet.";
                listEl.appendChild(li);
                return;
              }
              registrants.forEach((entry) => {
                const li = document.createElement("li");
                const name = entry && entry.name ? entry.name : "Registered diver";
                li.textContent = getRegistrationApprovalStatus(entry) === "pending" ? `${name} (registration pending)` : name;
                listEl.appendChild(li);
              });
            };

            const loadSnapshot = async () => {
              const snapshot = await fetchRegistrationSnapshot(sourceId, eventDate);
              if (!snapshot || !snapshot.ok) {
                if (metaEl) metaEl.textContent = "Registration status is unavailable right now.";
                return null;
              }
              renderSnapshot(snapshot);
              return snapshot;
            };

            if (formEl) {
              formEl.addEventListener("submit", async (event) => {
                event.preventDefault();
                if (feedbackEl) feedbackEl.textContent = "";
                const formData = new FormData(formEl);
                const requestBody = {
                  eventDate,
                  firstName: String(formData.get("firstName") || "").trim(),
                  lastName: String(formData.get("lastName") || "").trim(),
                  email: String(formData.get("email") || "").trim(),
                  phone: String(formData.get("phone") || "").trim(),
                  certificationLevel: String(formData.get("certificationLevel") || "").trim(),
                  additionalGuests: Math.max(0, Number(formData.get("additionalGuests") || 0) || 0),
                };
                const result = await submitRegistration(sourceId, requestBody);
                if (!result || !result.ok) {
                  if (feedbackEl) feedbackEl.textContent = (result && result.error) || "Registration failed.";
                  return;
                }
                if (feedbackEl) feedbackEl.textContent = "Registration received. You are on the list.";
                formEl.reset();
                const guestsInput = formEl.querySelector("input[name='additionalGuests']");
                if (guestsInput) guestsInput.value = "0";
                renderSnapshot(result);
              });
            }

            if (registerBtn) {
              registerBtn.addEventListener("click", () => {
                regWrap.hidden = false;
                syncEventShareUrl(eventItem, { register: true });
                regWrap.scrollIntoView({ behavior: "smooth", block: "start" });
                const firstInput = formEl && formEl.querySelector("input[name='firstName']");
                if (firstInput && !formEl.hidden) firstInput.focus();
              });
            }

            loadSnapshot();
            if (autoOpenRegistration) {
              regWrap.hidden = false;
              const firstInput = formEl && formEl.querySelector("input[name='firstName']");
              if (firstInput) {
                requestAnimationFrame(() => {
                  if (!formEl.hidden) firstInput.focus();
                });
              }
            }
          }
        }
      },
    });

    if (modal && modal.backBtn && state.lastDateModalContext && Array.isArray(state.lastDateModalContext.items)) {
      modal.backBtn.hidden = false;
      modal.backBtn.onclick = () => {
        const context = state.lastDateModalContext;
        if (!context) return;
        openDateEventsModal(context.dateValue, context.items);
      };
    }
  }

  function indexEvents(events, payload) {
    state.payload = payload && typeof payload === "object" ? payload : {};
    state.eventsById.clear();
    (Array.isArray(events) ? events : []).forEach((eventItem) => {
      const key = normalizeText(eventItem && eventItem.id);
      if (key) state.eventsById.set(key, eventItem);
    });
  }

  function bindDetailTriggers(host) {
    if (!host || host.dataset.eventsDetailBound === "true") return;
    host.dataset.eventsDetailBound = "true";
    host.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-events-open-detail]");
      if (!trigger) return;
      event.preventDefault();
      const inSelectedDateModal = Boolean(trigger.closest(".events-public-day-row"));
      if (!inSelectedDateModal) state.lastDateModalContext = null;
      openEventDetailModalById(trigger.getAttribute("data-events-open-detail"), {
        autoOpenRegistration: trigger.getAttribute("data-events-open-register") === "true",
      });
    });
  }

  function closePublicModal() {
    if (!state.publicModal) return;
    state.publicModal.root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("events-public-modal-open");
    clearEventShareUrl();
  }

  function buildLegendMarkup() {
    const entries = Object.entries(EVENT_TYPE_META).filter(([key]) => key !== "Event");
    return entries
      .map(([label, meta]) => {
        return `
          <span class="events-legend-item">
            <span class="events-legend-swatch ${meta.className}" aria-hidden="true">${meta.icon}</span>
            <span>${label}</span>
          </span>
        `;
      })
      .join("");
  }

  function buildMonthNavButtonsMarkup(prevDisabled, nextDisabled) {
    return `
      <button class="events-nav-btn" type="button" data-events-today>Current Month</button>
      <button class="events-nav-btn" type="button" data-events-prev ${prevDisabled}>Previous</button>
      <button class="events-nav-btn" type="button" data-events-next ${nextDisabled}>Next</button>
    `;
  }

  function renderEventCard(eventItem, variant = "default") {
    const compact = variant === "compact";
    const agenda = variant === "agenda";
    const showTypeIcon = !compact;
    const previewWantsRegister =
      compact && previewCallToAction === "register" && isRegistrationEnabled(eventItem);
    const article = document.createElement("article");
    const typeMeta = getEventTypeMeta(eventItem.type);
    article.className = agenda
      ? `event-card event-card-agenda ${typeMeta.className}`
      : compact
        ? `event-card event-card-compact ${typeMeta.className}`
        : `event-card ${typeMeta.className}`;

    const meta = document.createElement("div");
    meta.className = "event-card-meta";
    const metaParts = [`
      <span class="event-chip">
        ${showTypeIcon ? `<span class="event-chip-icon" aria-hidden="true">${typeMeta.icon}</span>` : ""}
        <span>${eventItem.type || "Event"}</span>
      </span>
    `];
    if (!compact && !agenda && eventItem.status) {
      metaParts.push(`<span class="event-status">${eventItem.status || "Planned"}</span>`);
    }
    meta.innerHTML = metaParts.join("");

    const title = document.createElement("h3");
    title.textContent = eventItem.title;

    const dateLine = document.createElement("p");
    dateLine.className = "event-card-date";
    dateLine.textContent = eventDateLabel(eventItem);

    const location = document.createElement("p");
    location.className = "event-card-location";
    location.textContent = eventItem.location || "Location announced soon";

    const summary = document.createElement("p");
    summary.className = "event-card-summary";
    const summaryText = eventItem.summary || "";
    summary.textContent =
      compact && summaryText.length > 110 ? `${summaryText.slice(0, 107).trimEnd()}...` : summaryText;

    const actions = document.createElement("div");
    actions.className = "event-card-actions";
    const ctaLabel = previewWantsRegister ? "Register" : compact ? "Details" : agenda ? "View" : "Event Details";
    const ctaClass = previewWantsRegister ? "primary" : compact || agenda ? "secondary" : "primary";
    actions.appendChild(createDetailTrigger(eventItem, ctaLabel, ctaClass, {
      autoOpenRegistration: previewWantsRegister,
    }));

    if (agenda) {
      const dateBadge = document.createElement("div");
      dateBadge.className = "event-card-agenda-date";
      dateBadge.innerHTML = `
        <span class="event-card-agenda-month">${monthShortFormatter.format(eventItem.dateObj)}</span>
        <strong class="event-card-agenda-day">${eventItem.dateObj.getDate()}</strong>
      `;

      const content = document.createElement("div");
      content.className = "event-card-agenda-main";

      const infoLine = document.createElement("p");
      infoLine.className = "event-card-agenda-info";
      const locationText = eventItem.location || "Location announced soon";
      infoLine.textContent = `${eventDateLabel(eventItem)} | ${locationText}`;

      content.append(meta, title, infoLine);
      article.append(dateBadge, content, actions);
      return article;
    }

    article.append(meta, title, dateLine, location, summary, actions);
    return article;
  }

  function renderAgendaRow(eventItem) {
    const article = document.createElement("article");
    const typeMeta = getEventTypeMeta(eventItem.type);
    article.className = `event-card event-card-agenda-row ${typeMeta.className}`;

    const meta = document.createElement("div");
    meta.className = "event-card-meta";
    meta.innerHTML = `
      <span class="event-chip">
        <span class="event-chip-icon" aria-hidden="true">${typeMeta.icon}</span>
        <span>${eventItem.type || "Event"}</span>
      </span>
    `;

    const title = document.createElement("h3");
    title.textContent = eventItem.title;

    const infoLine = document.createElement("p");
    infoLine.className = "event-card-agenda-info";
    const locationText = eventItem.location || "Location announced soon";
    const infoParts = [];
    if (eventItem.endDateObj && eventItem.endDateObj > eventItem.dateObj) {
      infoParts.push(eventDateLabel(eventItem, { includeTime: false }));
    }
    if (eventItem.time) {
      infoParts.push(eventItem.endTime ? `${eventItem.time} - ${eventItem.endTime}` : eventItem.time);
    } else if (!infoParts.length) {
      infoParts.push("Time announced soon");
    }
    infoParts.push(locationText);
    infoLine.textContent = infoParts.join(" | ");

    const content = document.createElement("div");
    content.className = "event-card-agenda-main";
    content.append(meta, title, infoLine);

    const actions = document.createElement("div");
    actions.className = "event-card-actions";
    actions.appendChild(createDetailTrigger(eventItem, "View", "secondary"));

    article.append(content, actions);
    return article;
  }

  function renderPreview(events, payload) {
    if (!previewRoot) return;
    bindDetailTriggers(previewRoot);
    const list = previewRoot.querySelector("[data-events-preview-list]");
    const empty = previewRoot.querySelector("[data-events-preview-empty]");
    const stamp = previewRoot.querySelector("[data-events-updated]");
    if (!list || !empty) return;

    const previewCount = Math.max(1, Number(payload && payload.previewCount) || 3);
    const filteredEvents = previewTypeFilter.length
      ? events.filter((eventItem) => previewTypeFilter.includes(normalizeText(eventItem && eventItem.type)))
      : events;
    list.innerHTML = "";

    if (!filteredEvents.length) {
      empty.hidden = false;
      list.hidden = true;
    } else {
      empty.hidden = true;
      list.hidden = false;
      filteredEvents.slice(0, previewCount).forEach((eventItem) => {
        list.appendChild(renderEventCard(eventItem, "compact"));
      });
    }

    if (stamp) {
      const months = Math.max(1, Number(payload && payload.horizonMonths) || 30);
      stamp.textContent = `Rolling ${months}-month schedule. Updates automatically as the date changes.`;
    }
  }

  function renderCalendar(events, payload) {
    if (!pageRoot) return;
    const monthHost = pageRoot.querySelector("[data-events-calendar]");
    const listHost = pageRoot.querySelector("[data-events-list]");
    const empty = pageRoot.querySelector("[data-events-empty]");
    const stamp = pageRoot.querySelector("[data-events-updated]");
    const total = pageRoot.querySelector("[data-events-total]");
    if (!monthHost || !listHost || !empty) return;

    monthHost.innerHTML = "";
    listHost.innerHTML = "";

    const horizonMonths = Math.max(1, Number(payload && payload.horizonMonths) || 30);
    const monthGroups = buildMonthGroups(events, horizonMonths);
    if (!monthGroups.length) {
      empty.hidden = false;
      monthHost.hidden = true;
      listHost.hidden = true;
      return;
    }

    empty.hidden = true;
    monthHost.hidden = false;
    listHost.hidden = false;

    const today = startOfDay(new Date());
    const todayKey = dateKey(today);
    const currentMonthKey = monthKey(today);
    const urlParams = new URLSearchParams(window.location.search);
    const requestedDateFromUrl = String(urlParams.get("date") || "").trim();
    const requestedDateObj = parseDateKey(requestedDateFromUrl);
    const requestedDateKey = requestedDateObj ? dateKey(requestedDateObj) : "";
    const requestedMonthKey = requestedDateObj ? monthKey(startOfMonth(requestedDateObj)) : "";
    const requestedModalDateKey = parseDateKey(String(state.openDateModalRequestKey || "").trim())
      ? dateKey(parseDateKey(String(state.openDateModalRequestKey || "").trim()))
      : "";
    const requestedModalMonthKey = requestedModalDateKey
      ? monthKey(startOfMonth(parseDateKey(requestedModalDateKey)))
      : "";
    const savedMonthKey = String((state.calendarView && state.calendarView.activeMonthKey) || "").trim();
    const initialMonthKey = requestedModalMonthKey || savedMonthKey || requestedMonthKey || currentMonthKey;
    let activeMonthIndex = monthGroups.findIndex((group) => group.key === initialMonthKey);
    if (activeMonthIndex < 0) {
      activeMonthIndex = Math.max(
        0,
        monthGroups.findIndex((group) => group.key === currentMonthKey)
      );
    }

    function defaultSelectedKey(group) {
      if (!group) return "";
      const todayItem = group.events.find((eventItem) => eventCoversDateKey(eventItem, todayKey));
      if (todayItem) return todayKey;
      return group.events[0] ? firstVisibleDateKeyForMonth(group.events[0], group.monthDate) : "";
    }

    function fallbackSelectedKey(group) {
      if (!group) return todayKey;
      return defaultSelectedKey(group) || dateKey(group.monthDate);
    }

    function buildSelectedSummaryMarkup(group, selectedItems) {
      const selectedDate = parseDateKey(selectedDateKey) || group.monthDate;
      if (selectedItems.length) {
        const labels = selectedItems
          .slice(0, 2)
          .map((item) => item.title)
          .join(" | ");
        const moreCount = Math.max(0, selectedItems.length - 2);
        return `
          <div class="events-selected-summary-kicker">Selected Date</div>
          <strong>${weekdayLongFormatter.format(selectedDate)}</strong>
          <span>${selectedItems.length} event${selectedItems.length === 1 ? "" : "s"} scheduled${moreCount ? ` | ${labels} + ${moreCount} more` : ` | ${labels}`}</span>
        `;
      }
      if (selectedDateKey === todayKey) {
        return `
          <div class="events-selected-summary-kicker">Selected Date</div>
          <strong>${weekdayLongFormatter.format(today)}</strong>
          <span>No scheduled events today. Use the month controls to browse what is coming next.</span>
        `;
      }
      return `
        <div class="events-selected-summary-kicker">Selected Date</div>
        <strong>${weekdayLongFormatter.format(selectedDate)}</strong>
        <span>No scheduled events on this date. Use the upcoming list below to scan nearby options.</span>
      `;
    }

    const savedSelectedDateKey = String((state.calendarView && state.calendarView.selectedDateKey) || "").trim();
    const initialSelectedDateKey =
      (requestedModalDateKey && parseDateKey(requestedModalDateKey) && requestedModalDateKey) ||
      (savedSelectedDateKey && parseDateKey(savedSelectedDateKey) && savedSelectedDateKey) ||
      (requestedDateKey && parseDateKey(requestedDateKey) && requestedDateKey) ||
      "";
    let selectedDateKey = initialSelectedDateKey || fallbackSelectedKey(monthGroups[activeMonthIndex]);
    let pendingDateModal = requestedModalDateKey || "";
    let pendingDateItems = [];
    let selectedRegistrationRequestId = 0;
    let shouldNotifyParentSelection = false;

    async function renderSelectedDateRegistration(items, host) {
      if (!host) return;
      const registrationItems = (Array.isArray(items) ? items : [])
        .filter((item) => isRegistrationEnabled(item))
        .filter((item, index, list) => {
          const sourceId = getRegistrationSourceId(item);
          const dateValue = getRegistrationDateKey(item);
          return Boolean(
            sourceId &&
            dateValue &&
            list.findIndex((entry) =>
              getRegistrationSourceId(entry) === sourceId &&
              getRegistrationDateKey(entry) === dateValue
            ) === index
          );
        });

      if (!registrationItems.length) {
        host.hidden = true;
        host.innerHTML = "";
        return;
      }

      host.hidden = false;
      host.innerHTML = `<p class="events-selected-registration-note">Checking open spots...</p>`;
      const requestId = ++selectedRegistrationRequestId;

      const rows = await Promise.all(
        registrationItems.map(async (item) => {
          const sourceId = getRegistrationSourceId(item);
          const dateValue = getRegistrationDateKey(item);
          const fallbackCapacity = Math.max(0, Number(item.registrationCapacity) || 0);
          const snapshot = await fetchRegistrationSnapshot(sourceId, dateValue);
          if (snapshot && snapshot.ok) {
            return {
              title: item.title || "Event",
              remaining: Math.max(0, Number(snapshot.remainingSpots) || 0),
              capacity: Math.max(0, Number(snapshot.registrationCapacity) || 0),
              closed: Boolean(snapshot.registrationClosed || isRegistrationClosed(item)),
            };
          }
          return {
            title: item.title || "Event",
            remaining: -1,
            capacity: fallbackCapacity,
            closed: isRegistrationClosed(item),
          };
        })
      );

      if (requestId !== selectedRegistrationRequestId) return;
      host.innerHTML = "";

      const label = document.createElement("p");
      label.className = "events-selected-registration-label";
      label.textContent = "Open Spots";
      host.appendChild(label);

      const list = document.createElement("ul");
      list.className = "events-selected-registration-list";
      rows.forEach((row) => {
        const li = document.createElement("li");
        li.className = "events-selected-registration-item";
        const countText =
          row.closed
            ? "registration closed"
            : row.remaining >= 0
            ? `${row.remaining}/${row.capacity} open`
            : `${row.capacity} spots configured`;
        li.textContent = `${row.title}: ${countText}`;
        list.appendChild(li);
      });
      host.appendChild(list);
    }

    function notifyParentHeight() {
      if (window.parent === window) return;
      const root = document.querySelector(".events-embed-main") || document.body;
      if (!root) return;
      const height = Math.max(
        root.scrollHeight || 0,
        root.offsetHeight || 0,
        document.body ? document.body.scrollHeight || 0 : 0
      );
      if (height > 0) {
        window.parent.postMessage({ type: "dmzEventsResize", height }, "*");
      }
    }

    function notifyParentSelection(selectedDate, selectedItems) {
      if (window.parent === window || !selectedDate) return;
      window.parent.postMessage(
        {
          type: "dmzEventsDateSelected",
          date: selectedDate,
          eventIds: Array.isArray(selectedItems)
            ? selectedItems.map((item) => item.sourceId || item.id).filter(Boolean)
            : [],
        },
        "*"
      );
    }

    function requestParentEditDate(selectedDate, selectedItems) {
      const dateValue = String(selectedDate || "").trim();
      if (window.parent === window || !dateValue) return false;
      window.parent.postMessage(
        {
          type: "dmzEventsAdminEditDate",
          date: dateValue,
          eventIds: Array.isArray(selectedItems)
            ? selectedItems.map((item) => item.sourceId || item.id).filter(Boolean)
            : [],
        },
        "*"
      );
      return true;
    }

    function renderMonth() {
      const group = monthGroups[activeMonthIndex];
      if (!group) return;
      state.calendarView.activeMonthKey = group.key;
      state.calendarView.selectedDateKey = selectedDateKey;

      monthHost.innerHTML = "";
      listHost.innerHTML = "";

      const eventMap = new Map();
      const monthStart = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth(), 1);
      const monthEnd = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth() + 1, 0);
      group.events.forEach((eventItem) => {
        let cursor = eventItem.dateObj > monthStart ? eventItem.dateObj : monthStart;
        const lastVisibleDate = eventItem.endDateObj < monthEnd ? eventItem.endDateObj : monthEnd;
        while (cursor <= lastVisibleDate) {
          const currentDateKey = dateKey(cursor);
          const items = eventMap.get(currentDateKey) || [];
          items.push(eventItem);
          eventMap.set(currentDateKey, items);
          cursor = addDays(cursor, 1);
        }
      });

      if (!selectedDateKey) {
        selectedDateKey = fallbackSelectedKey(group);
      }
      if (pendingDateModal && pendingDateModal.slice(0, 7) === group.key && !pendingDateItems.length) {
        pendingDateItems = eventMap.get(pendingDateModal) || [];
      }

      const card = document.createElement("section");
      card.className = "events-month-card";

      const prevDisabled = activeMonthIndex === 0 ? "disabled" : "";
      const nextDisabled = activeMonthIndex >= monthGroups.length - 1 ? "disabled" : "";
      const availableYears = Array.from(
        new Set(monthGroups.map((item) => item.monthDate.getFullYear()))
      );
      const activeYear = group.monthDate.getFullYear();
      const activeMonth = group.monthDate.getMonth();
      const monthOptions = Array.from({ length: 12 }, (_unused, monthNumber) => {
        const monthDate = new Date(2026, monthNumber, 1);
        const hasMonth = monthGroups.some(
          (item) =>
            item.monthDate.getFullYear() === activeYear &&
            item.monthDate.getMonth() === monthNumber
        );
        return `<option value="${monthNumber}" ${monthNumber === activeMonth ? "selected" : ""} ${hasMonth ? "" : "disabled"}>${monthFormatter.format(monthDate)}</option>`;
      }).join("");
      const yearOptions = availableYears
        .map((yearValue) => {
          return `<option value="${yearValue}" ${yearValue === activeYear ? "selected" : ""}>${yearValue}</option>`;
        })
        .join("");

      const head = document.createElement("div");
      head.className = "events-month-head";
      head.innerHTML = `
        <div class="events-month-title">
          <div class="events-month-kicker">Rolling ${horizonMonths}-Month Calendar</div>
          <h2>${monthFormatter.format(group.monthDate)}</h2>
          <p>Today is ${weekdayLongFormatter.format(today)}. ${group.events.length} scheduled item${group.events.length === 1 ? "" : "s"} this month.</p>
        </div>
        <div class="events-month-nav" aria-label="Calendar month controls">
          <div class="events-month-jump">
            <label class="events-jump-label">
              <span class="events-jump-text">Month</span>
              <select class="events-jump-select" data-events-month-select>
                ${monthOptions}
              </select>
            </label>
            <label class="events-jump-label">
              <span class="events-jump-text">Year</span>
              <select class="events-jump-select" data-events-year-select>
                ${yearOptions}
              </select>
            </label>
          </div>
          ${buildMonthNavButtonsMarkup(prevDisabled, nextDisabled)}
        </div>
      `;

      const legend = document.createElement("div");
      legend.className = "events-legend";
      legend.setAttribute("aria-label", "Event type key");
      legend.innerHTML = buildLegendMarkup();

      const selectedItems = eventMap.get(selectedDateKey) || [];
      const selectedSummary = document.createElement("div");
      selectedSummary.className = "events-selected-summary";
      selectedSummary.innerHTML = buildSelectedSummaryMarkup(group, selectedItems);

      const selectedRegistration = document.createElement("div");
      selectedRegistration.className = "events-selected-registration";
      selectedRegistration.hidden = true;

      const grid = document.createElement("div");
      grid.className = "events-month-grid";

      for (let day = 0; day < 7; day += 1) {
        const labelDate = new Date(2026, 2, 1 + day);
        const header = document.createElement("div");
        header.className = "events-weekday";
        header.textContent = weekdayFormatter.format(labelDate);
        grid.appendChild(header);
      }

      const firstOfMonth = monthStart;
      const lastOfMonth = monthEnd;
      const offset = firstOfMonth.getDay();
      const totalDays = lastOfMonth.getDate();

      for (let blank = 0; blank < offset; blank += 1) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "events-day events-day-empty";
        grid.appendChild(emptyCell);
      }

      for (let day = 1; day <= totalDays; day += 1) {
        const currentDate = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth(), day);
        const currentKey = dateKey(currentDate);
        const items = eventMap.get(currentKey) || [];
        const isToday = currentKey === todayKey;
        const isSelected = currentKey === selectedDateKey;
        const isPast = currentDate < today;

        const cell = document.createElement("div");
        cell.className = items.length ? "events-day events-day-active" : "events-day";
        if (isToday) cell.className += " events-day-today";
        if (isSelected) cell.className += " events-day-selected";
        if (isPast) cell.className += " events-day-past";

        const button = document.createElement("button");
        button.type = "button";
        button.className = items.length ? "events-day-button" : "events-day-button events-day-button-empty";
        button.setAttribute("aria-pressed", isSelected ? "true" : "false");
        button.setAttribute(
          "aria-label",
          items.length
            ? `${weekdayLongFormatter.format(currentDate)} with ${items.length} event${items.length === 1 ? "" : "s"}`
            : `${weekdayLongFormatter.format(currentDate)} with no scheduled events`
        );
        if (items.length) {
          const uniqueTypes = Array.from(
            new Set(items.map((item) => (item.type || "Event")))
          )
            .slice(0, 4)
            .map((type) => {
              const meta = getEventTypeMeta(type);
              return `<span class="events-day-bar ${meta.className}" title="${type}" aria-hidden="true"></span>`;
            })
            .join("");

          button.innerHTML = `
            <span class="events-day-number">${day}</span>
            ${isToday ? '<span class="events-day-label">Today</span>' : ""}
            <span class="events-day-count">
              <span class="events-day-count-number">${items.length}</span>
              <span class="events-day-count-label">event${items.length === 1 ? "" : "s"}</span>
            </span>
            <span class="events-day-bar-stack">${uniqueTypes}</span>
            ${items.length === 1 ? `<span class="events-day-preview">${items[0].title}</span>` : ""}
            ${items.length > 4 ? `<span class="events-day-more-count">+${items.length - 4} more</span>` : ""}
          `;
        } else {
          button.innerHTML = `
            <span class="events-day-number">${day}</span>
            ${isToday ? '<span class="events-day-label">Today</span>' : ""}
            <span class="events-day-empty-copy">Select date</span>
          `;
        }
        button.addEventListener("click", () => {
          selectedDateKey = currentKey;
          shouldNotifyParentSelection = true;
          if (state.adminCanEditDate) {
            pendingDateModal = "";
            pendingDateItems = [];
            requestParentEditDate(currentKey, items);
          } else {
            pendingDateModal = currentKey;
            pendingDateItems = items;
          }
          renderMonth();
        });
        cell.appendChild(button);
        grid.appendChild(cell);
      }

      const bottomNav = document.createElement("div");
      bottomNav.className = "events-month-nav events-month-nav-bottom";
      bottomNav.setAttribute("aria-label", "Calendar month controls");
      bottomNav.innerHTML = buildMonthNavButtonsMarkup(prevDisabled, nextDisabled);

      card.append(head, selectedSummary, selectedRegistration, legend, grid, bottomNav);
      monthHost.appendChild(card);
      renderSelectedDateRegistration(selectedItems, selectedRegistration);

      const upcomingItems = [];
      const seenUpcomingIds = new Set();
      const agendaLimit = 6;
      for (let monthIndex = activeMonthIndex; monthIndex < monthGroups.length; monthIndex += 1) {
        const monthItems = monthGroups[monthIndex].events.filter((eventItem) => eventItem.endDateObj >= today);
        monthItems.forEach((eventItem) => {
          const dedupeKey = String(eventItem.id || `${eventItem.eventId}-${eventItem.date}`);
          if (seenUpcomingIds.has(dedupeKey)) return;
          seenUpcomingIds.add(dedupeKey);
          upcomingItems.push(eventItem);
        });
        if (upcomingItems.length >= agendaLimit) break;
      }
      const listItems = upcomingItems.slice(0, agendaLimit);
      if (!listItems.length) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "events-agenda-empty";
        emptyItem.textContent = "No upcoming events are scheduled right now. Use the contact page if you need a custom date or training window.";
        listHost.appendChild(emptyItem);
      } else {
        const scrollList = document.createElement("div");
        scrollList.className = "events-upcoming-scroll";
        let firstMatch = null;

        const agendaGroups = new Map();
        listItems.forEach((eventItem) => {
          const items = agendaGroups.get(eventItem.date) || [];
          items.push(eventItem);
          agendaGroups.set(eventItem.date, items);
        });

        agendaGroups.forEach((items, dateValue) => {
          const group = document.createElement("section");
          group.className = "events-agenda-group";
          if (items.some((item) => eventCoversDateKey(item, selectedDateKey))) {
            group.classList.add("is-selected");
            if (!firstMatch) firstMatch = group;
          }

          const heading = document.createElement("div");
          heading.className = "events-agenda-date-head";
          const headingDate = parseDateKey(dateValue) || items[0].dateObj;
          heading.innerHTML = `
            <strong>${weekdayLongFormatter.format(headingDate)}</strong>
            <span>${items.length} event${items.length === 1 ? "" : "s"}</span>
          `;
          group.appendChild(heading);

          items.forEach((eventItem) => {
            const row = renderAgendaRow(eventItem);
            row.classList.add("events-upcoming-card");
            group.appendChild(row);
          });

          scrollList.appendChild(group);
        });

        listHost.appendChild(scrollList);
        if (firstMatch) {
          requestAnimationFrame(() => {
            const targetTop = Math.max(0, firstMatch.offsetTop - scrollList.offsetTop - 8);
            scrollList.scrollTop = targetTop;
          });
        }
      }

      const todayButtons = card.querySelectorAll("[data-events-today]");
      const monthSelect = head.querySelector("[data-events-month-select]");
      const yearSelect = head.querySelector("[data-events-year-select]");
      const prevButtons = card.querySelectorAll("[data-events-prev]");
      const nextButtons = card.querySelectorAll("[data-events-next]");

      function jumpToMonth(monthValue, yearValue) {
        const targetIndex = monthGroups.findIndex(
          (item) =>
            item.monthDate.getFullYear() === yearValue &&
            item.monthDate.getMonth() === monthValue
        );
        if (targetIndex < 0) return false;
        activeMonthIndex = targetIndex;
        selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
        renderMonth();
        return true;
      }

      if (yearSelect) {
        yearSelect.addEventListener("change", () => {
          const yearValue = Number(yearSelect.value);
          const monthValue = monthSelect ? Number(monthSelect.value) : activeMonth;
          if (jumpToMonth(monthValue, yearValue)) return;
          const fallback = monthGroups.findIndex(
            (item) => item.monthDate.getFullYear() === yearValue
          );
          if (fallback < 0) return;
          activeMonthIndex = fallback;
          selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
          renderMonth();
        });
      }

      if (monthSelect) {
        monthSelect.addEventListener("change", () => {
          const monthValue = Number(monthSelect.value);
          const yearValue = yearSelect ? Number(yearSelect.value) : activeYear;
          jumpToMonth(monthValue, yearValue);
        });
      }

      todayButtons.forEach((todayButton) => {
        todayButton.addEventListener("click", () => {
          activeMonthIndex = Math.max(
            0,
            monthGroups.findIndex((item) => item.key === currentMonthKey)
          );
          selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
          renderMonth();
        });
      });

      prevButtons.forEach((prevButton) => {
        prevButton.addEventListener("click", () => {
          if (activeMonthIndex <= 0) return;
          activeMonthIndex -= 1;
          selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
          renderMonth();
        });
      });

      nextButtons.forEach((nextButton) => {
        nextButton.addEventListener("click", () => {
          if (activeMonthIndex >= monthGroups.length - 1) return;
          activeMonthIndex += 1;
          selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
          renderMonth();
        });
      });

      if (stamp) {
        stamp.textContent = `Auto-updating rolling calendar. Showing ${monthFormatter.format(group.monthDate)} with coverage through ${monthFormatter.format(monthGroups[monthGroups.length - 1].monthDate)}.`;
      }
      if (total) {
        total.textContent = String(events.length);
      }

      if (shouldNotifyParentSelection) {
        notifyParentSelection(selectedDateKey, selectedItems);
        shouldNotifyParentSelection = false;
      }
      notifyParentHeight();
      if (pendingDateModal) {
        const modalDate = pendingDateModal;
        const modalItems = pendingDateItems;
        pendingDateModal = "";
        pendingDateItems = [];
        state.openDateModalRequestKey = "";
        openDateEventsModal(modalDate, modalItems);
      }
    }

    bindDetailTriggers(monthHost);
    bindDetailTriggers(listHost);
    renderMonth();
  }

  function renderError() {
    if (previewRoot) {
      const empty = previewRoot.querySelector("[data-events-preview-empty]");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Event calendar is loading. Check back soon.";
      }
    }

    if (pageRoot) {
      const empty = pageRoot.querySelector("[data-events-empty]");
      const monthHost = pageRoot.querySelector("[data-events-calendar]");
      const listHost = pageRoot.querySelector("[data-events-list]");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "We could not load the event calendar right now. Use the contact page and we will help you plan the right next step.";
      }
      if (monthHost) monthHost.hidden = true;
      if (listHost) listHost.hidden = true;
    }
  }

  function resizeEmbedFrame() {
    if (!embedFrame) return;
    try {
      const frameDoc = embedFrame.contentDocument;
      if (!frameDoc) return;
      const frameBody = frameDoc.body;
      const frameMain = frameDoc.querySelector(".events-embed-main");
      const target = frameMain || frameBody;
      if (!target) return;
      const height = Math.max(
        target.scrollHeight || 0,
        target.offsetHeight || 0,
        frameBody ? frameBody.scrollHeight || 0 : 0
      );
      if (height > 0) {
        embedFrame.style.height = `${height + 6}px`;
      }
    } catch (_error) {
      // Same-origin embed expected. If that changes later, fixed min-height still applies.
    }
  }

  function syncEmbedFrameQuery() {
    if (!embedFrame || !window.location) return;
    const currentSrc = embedFrame.getAttribute("src") || "./embed.html";
    const nextUrl = new URL(currentSrc, window.location.href);
    const pageUrl = new URL(window.location.href);
    nextUrl.search = pageUrl.search;
    const nextSrc = `${nextUrl.pathname}${nextUrl.search}`;
    if (embedFrame.getAttribute("src") !== nextSrc) {
      embedFrame.setAttribute("src", nextSrc);
    }
  }

  if (embedFrame) {
    syncEmbedFrameQuery();
    window.addEventListener("message", (event) => {
      const data = event && event.data;
      if (!data || data.type !== "dmzEventsResize" || !data.height) return;
      embedFrame.style.height = `${Math.max(920, Number(data.height) + 6)}px`;
    });

    embedFrame.addEventListener("load", () => {
      resizeEmbedFrame();
      try {
        const frameWindow = embedFrame.contentWindow;
        if (frameWindow) {
          frameWindow.addEventListener("resize", resizeEmbedFrame, { passive: true });
        }
      } catch (_error) {
        // Ignore cross-document access issues if the embed source changes later.
      }
    });

    window.addEventListener("resize", resizeEmbedFrame, { passive: true });
  }

  if (pageRoot || previewRoot) {
    bindDetailTriggers(document.body);
    const applyPayload = (payload) => {
      const urlParams = new URLSearchParams(window.location.search);
      const requestedEventKey = normalizeText(urlParams.get("event"));
      const safePayload = payload && typeof payload === "object" ? payload : {};
      const events = expandTemplateEvents(safePayload);
      indexEvents(events, safePayload);
      closePublicModal();
      renderPreview(events, safePayload);
      renderCalendar(events, safePayload);
      resizeEmbedFrame();
      if (requestedEventKey && state.eventsById.has(requestedEventKey)) {
        openEventDetailModalById(requestedEventKey);
      }
    };

    window.addEventListener("message", (event) => {
      const data = event && event.data;
      if (!data || !data.type) return;
      if (data.type === "dmzEventsPayloadPreview" && data.payload) {
        applyPayload(data.payload);
        return;
      }
      if (data.type === "dmzEventsAdminState") {
        state.adminCanEditDate = Boolean(data.canEditDate);
        return;
      }
      if (data.type === "dmzEventsOpenDateModal" && data.date) {
        state.openDateModalRequestKey = String(data.date || "").trim();
        if (state.payload && typeof state.payload === "object") {
          applyPayload(state.payload);
        }
      }
    });

    const loadPayload = (url) =>
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Event data failed (${response.status})`);
          return response.json();
        });

    loadPayload(dataUrl)
      .catch((error) => {
        if (!fallbackDataUrl || fallbackDataUrl === dataUrl) throw error;
        return loadPayload(fallbackDataUrl);
      })
      .then((payload) => {
        applyPayload(payload);
      })
      .catch(() => {
        renderError();
      });
  }
})();
