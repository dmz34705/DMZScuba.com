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

  function monthsBetween(a, b) {
    return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
  }

  function nthWeekdayOfMonth(year, monthIndex, weekOfMonth, weekday) {
    const first = new Date(year, monthIndex, 1);
    const shift = (7 + weekday - first.getDay()) % 7;
    const dayNumber = 1 + shift + (weekOfMonth - 1) * 7;
    const candidate = new Date(year, monthIndex, dayNumber);
    if (candidate.getMonth() !== monthIndex) return null;
    return candidate;
  }

  function normalizeEventInstance(eventItem) {
    if (!eventItem || !eventItem.date) return null;
    const dateObj = parseEventDate(eventItem);
    if (!dateObj) return null;
    const durationDays = Math.max(1, Number(eventItem.durationDays) || 1);
    const explicitEndDate = String(eventItem.endDate || "").trim();
    const explicitEndDateObj = explicitEndDate ? parseDateKey(explicitEndDate) : null;
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
      const rule = template && template.rule ? template.rule : null;
      if (!rule) return;
      const anchor = parseMonthAnchor(template.startMonth) || currentMonth;
      const intervalMonths = Math.max(1, Number(template.intervalMonths) || 1);
      const allowedMonths = Array.isArray(template.months) ? template.months : null;
      const weekOfMonth = Number(rule.weekOfMonth);
      const weekday = Number(rule.weekday);
      if (!Number.isFinite(weekOfMonth) || !Number.isFinite(weekday)) return;

      for (let offset = -1; offset < horizonMonths; offset += 1) {
        const monthDate = addMonths(currentMonth, offset);
        if (monthDate < anchor) continue;
        if (allowedMonths && !allowedMonths.includes(monthDate.getMonth() + 1)) continue;
        if (monthsBetween(monthDate, anchor) % intervalMonths !== 0) continue;

        const occurrence = nthWeekdayOfMonth(
          monthDate.getFullYear(),
          monthDate.getMonth(),
          weekOfMonth,
          weekday
        );
        if (!occurrence) continue;
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

  function buildEventDetailHref(eventItem) {
    const eventId = String((eventItem && (eventItem.eventId || eventItem.id)) || "").trim();
    if (!eventId) {
      return eventItem && eventItem.ctaHref ? eventItem.ctaHref : "/pages/contact/index.html#dive-now";
    }
    const params = new URLSearchParams({ id: eventId });
    if (eventItem && eventItem.date) params.set("date", eventItem.date);
    return `/pages/events/event.html?${params.toString()}`;
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

  function renderEventCard(eventItem, variant = "default") {
    const compact = variant === "compact";
    const agenda = variant === "agenda";
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
        <span class="event-chip-icon" aria-hidden="true">${typeMeta.icon}</span>
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
    const ctaLabel = compact ? "Details" : agenda ? "View" : "Event Details";
    const ctaClass = compact || agenda ? "secondary" : "primary";
    actions.innerHTML = `<a class="btn ${ctaClass}" href="${buildEventDetailHref(eventItem)}">${ctaLabel}</a>`;

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
    actions.innerHTML = `<a class="btn secondary" href="${buildEventDetailHref(eventItem)}">View</a>`;

    article.append(content, actions);
    return article;
  }

  function renderPreview(events, payload) {
    if (!previewRoot) return;
    const list = previewRoot.querySelector("[data-events-preview-list]");
    const empty = previewRoot.querySelector("[data-events-preview-empty]");
    const stamp = previewRoot.querySelector("[data-events-updated]");
    if (!list || !empty) return;

    const previewCount = Math.max(1, Number(payload && payload.previewCount) || 3);
    list.innerHTML = "";

    if (!events.length) {
      empty.hidden = false;
      list.hidden = true;
    } else {
      empty.hidden = true;
      list.hidden = false;
      events.slice(0, previewCount).forEach((eventItem) => {
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
    let activeMonthIndex = Math.max(
      0,
      monthGroups.findIndex((group) => group.key === currentMonthKey)
    );

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

    let selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);

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

    function renderMonth() {
      const group = monthGroups[activeMonthIndex];
      if (!group) return;

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

      if (!selectedDateKey || (!eventMap.has(selectedDateKey) && selectedDateKey !== todayKey)) {
        selectedDateKey = fallbackSelectedKey(group);
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
          <button class="events-nav-btn" type="button" data-events-today>Current Month</button>
          <button class="events-nav-btn" type="button" data-events-prev ${prevDisabled}>Previous</button>
          <button class="events-nav-btn" type="button" data-events-next ${nextDisabled}>Next</button>
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
          renderMonth();
        });
        cell.appendChild(button);
        grid.appendChild(cell);
      }

      card.append(head, selectedSummary, legend, grid);
      monthHost.appendChild(card);

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

      const todayButton = head.querySelector("[data-events-today]");
      const monthSelect = head.querySelector("[data-events-month-select]");
      const yearSelect = head.querySelector("[data-events-year-select]");
      const prevButton = head.querySelector("[data-events-prev]");
      const nextButton = head.querySelector("[data-events-next]");

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

      if (todayButton) {
        todayButton.addEventListener("click", () => {
          activeMonthIndex = Math.max(
            0,
            monthGroups.findIndex((item) => item.key === currentMonthKey)
          );
          selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
          renderMonth();
        });
      }

      if (prevButton) {
        prevButton.addEventListener("click", () => {
          if (activeMonthIndex <= 0) return;
          activeMonthIndex -= 1;
          selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
          renderMonth();
        });
      }

      if (nextButton) {
        nextButton.addEventListener("click", () => {
          if (activeMonthIndex >= monthGroups.length - 1) return;
          activeMonthIndex += 1;
          selectedDateKey = fallbackSelectedKey(monthGroups[activeMonthIndex]);
          renderMonth();
        });
      }

      if (stamp) {
        stamp.textContent = `Auto-updating rolling calendar. Showing ${monthFormatter.format(group.monthDate)} with coverage through ${monthFormatter.format(monthGroups[monthGroups.length - 1].monthDate)}.`;
      }
      if (total) {
        total.textContent = String(events.length);
      }

      notifyParentSelection(selectedDateKey, selectedItems);
      notifyParentHeight();
    }

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

  if (embedFrame) {
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
        const events = expandTemplateEvents(payload);
        renderPreview(events, payload);
        renderCalendar(events, payload);
        resizeEmbedFrame();
      })
      .catch(() => {
        renderError();
      });
  }
})();
