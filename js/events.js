(() => {
  const pageRoot = document.querySelector("[data-events-page]");
  const previewRoot = document.querySelector("[data-events-preview]");
  const embedFrame = document.querySelector("[data-events-embed-frame]");
  if (!pageRoot && !previewRoot && !embedFrame) return;

  const dataUrl =
    (pageRoot && pageRoot.getAttribute("data-events-src")) ||
    (previewRoot && previewRoot.getAttribute("data-events-src")) ||
    "/assets/data/events.json";

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  });
  const weekdayLongFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(date, count) {
    return new Date(date.getFullYear(), date.getMonth() + count, 1);
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

  function expandTemplateEvents(payload) {
    const today = startOfDay(new Date());
    const currentMonth = startOfMonth(today);
    const horizonMonths = Math.max(1, Number(payload && payload.horizonMonths) || 30);
    const explicitEvents = payload && Array.isArray(payload.events) ? payload.events : [];
    const templates = payload && Array.isArray(payload.templates) ? payload.templates : [];
    const generated = [];

    explicitEvents.forEach((eventItem) => {
      const dateObj = parseEventDate(eventItem);
      if (!dateObj || dateObj < today) return;
      generated.push({
        ...eventItem,
        dateObj,
      });
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

      for (let offset = 0; offset < horizonMonths; offset += 1) {
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
        if (!occurrence || occurrence < today) continue;

        generated.push({
          ...template,
          id: `${template.id}-${dateKey(occurrence)}`,
          date: dateKey(occurrence),
          dateObj: occurrence,
        });
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
      const group = groupsByKey.get(monthKey(eventItem.dateObj));
      if (group) group.events.push(eventItem);
    });

    return months;
  }

  function eventDateLabel(eventItem) {
    const parts = [dayFormatter.format(eventItem.dateObj)];
    if (eventItem.time) {
      parts.push(eventItem.endTime ? `${eventItem.time} - ${eventItem.endTime}` : eventItem.time);
    }
    return parts.join(" | ");
  }

  function renderEventCard(eventItem, compact = false) {
    const article = document.createElement("article");
    article.className = compact ? "event-card event-card-compact" : "event-card";

    const meta = document.createElement("div");
    meta.className = "event-card-meta";
    meta.innerHTML = `
      <span class="event-chip">${eventItem.type || "Event"}</span>
      <span class="event-status">${eventItem.status || "Planned"}</span>
    `;

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
    summary.textContent = eventItem.summary || "";

    const actions = document.createElement("div");
    actions.className = "event-card-actions";
    actions.innerHTML = `<a class="btn ${compact ? "secondary" : "primary"}" href="${eventItem.ctaHref || "/pages/contact/index.html#dive-now"}">${eventItem.ctaLabel || "Get Details"}</a>`;

    article.append(meta, title, dateLine, location, summary, actions);
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
        list.appendChild(renderEventCard(eventItem, true));
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
      const todayItem = group.events.find((eventItem) => eventItem.date === todayKey);
      if (todayItem) return todayItem.date;
      return group.events[0] ? group.events[0].date : "";
    }

    let selectedDateKey = defaultSelectedKey(monthGroups[activeMonthIndex]);

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

    function renderMonth() {
      const group = monthGroups[activeMonthIndex];
      if (!group) return;

      monthHost.innerHTML = "";
      listHost.innerHTML = "";

      const eventMap = new Map();
      group.events.forEach((eventItem) => {
        const items = eventMap.get(eventItem.date) || [];
        items.push(eventItem);
        eventMap.set(eventItem.date, items);
      });

      if (!selectedDateKey || (!eventMap.has(selectedDateKey) && selectedDateKey !== todayKey)) {
        selectedDateKey = defaultSelectedKey(group) || todayKey;
      }

      const card = document.createElement("section");
      card.className = "events-month-card";

      const prevDisabled = activeMonthIndex === 0 ? "disabled" : "";
      const nextDisabled = activeMonthIndex >= monthGroups.length - 1 ? "disabled" : "";
      const head = document.createElement("div");
      head.className = "events-month-head";
      head.innerHTML = `
        <div class="events-month-title">
          <div class="events-month-kicker">Rolling ${horizonMonths}-Month Calendar</div>
          <h2>${monthFormatter.format(group.monthDate)}</h2>
          <p>Today is ${weekdayLongFormatter.format(today)}. ${group.events.length} scheduled item${group.events.length === 1 ? "" : "s"} this month.</p>
        </div>
        <div class="events-month-nav" aria-label="Calendar month controls">
          <button class="events-nav-btn" type="button" data-events-today>Current Month</button>
          <button class="events-nav-btn" type="button" data-events-prev ${prevDisabled}>Previous</button>
          <button class="events-nav-btn" type="button" data-events-next ${nextDisabled}>Next</button>
        </div>
      `;

      const grid = document.createElement("div");
      grid.className = "events-month-grid";

      for (let day = 0; day < 7; day += 1) {
        const labelDate = new Date(2026, 2, 1 + day);
        const header = document.createElement("div");
        header.className = "events-weekday";
        header.textContent = weekdayFormatter.format(labelDate);
        grid.appendChild(header);
      }

      const firstOfMonth = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth(), 1);
      const lastOfMonth = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth() + 1, 0);
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

        if (!items.length) {
          cell.innerHTML = `
            <span class="events-day-number">${day}</span>
            ${isToday ? '<span class="events-day-label">Today</span>' : ""}
          `;
          grid.appendChild(cell);
          continue;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "events-day-button";
        button.setAttribute("aria-pressed", isSelected ? "true" : "false");
        button.setAttribute(
          "aria-label",
          `${weekdayLongFormatter.format(currentDate)} with ${items.length} event${items.length === 1 ? "" : "s"}`
        );
        button.innerHTML = `
          <span class="events-day-number">${day}</span>
          ${isToday ? '<span class="events-day-label">Today</span>' : ""}
          <span class="events-day-count">${items.length} scheduled</span>
          <span class="events-day-preview">${items[0].title}</span>
        `;
        button.addEventListener("click", () => {
          selectedDateKey = currentKey;
          renderMonth();
        });
        cell.appendChild(button);
        grid.appendChild(cell);
      }

      card.append(head, grid);
      monthHost.appendChild(card);

      const selectedItems = eventMap.get(selectedDateKey) || [];
      const agendaHead = document.createElement("div");
      agendaHead.className = "events-agenda-head";

      if (selectedItems.length) {
        agendaHead.innerHTML = `
          <div class="events-agenda-kicker">Selected Date</div>
          <h3>${weekdayLongFormatter.format(selectedItems[0].dateObj)}</h3>
          <p>${selectedItems.length} event${selectedItems.length === 1 ? "" : "s"} scheduled on this day.</p>
        `;
      } else if (selectedDateKey === todayKey) {
        agendaHead.innerHTML = `
          <div class="events-agenda-kicker">Today</div>
          <h3>${weekdayLongFormatter.format(today)}</h3>
          <p>No scheduled event today. Use the month controls to browse what is coming next.</p>
        `;
      } else {
        agendaHead.innerHTML = `
          <div class="events-agenda-kicker">Selected Date</div>
          <h3>${monthFormatter.format(group.monthDate)}</h3>
          <p>No scheduled events on the selected day.</p>
        `;
      }
      listHost.appendChild(agendaHead);

      if (!selectedItems.length) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "events-agenda-empty";
        emptyItem.textContent = "No scheduled events on this date. Use Current Month, Previous, or Next to move through the rolling calendar.";
        listHost.appendChild(emptyItem);
      } else {
        selectedItems.forEach((eventItem) => {
          listHost.appendChild(renderEventCard(eventItem, true));
        });
      }

      const todayButton = head.querySelector("[data-events-today]");
      const prevButton = head.querySelector("[data-events-prev]");
      const nextButton = head.querySelector("[data-events-next]");

      if (todayButton) {
        todayButton.addEventListener("click", () => {
          activeMonthIndex = Math.max(
            0,
            monthGroups.findIndex((item) => item.key === currentMonthKey)
          );
          selectedDateKey = defaultSelectedKey(monthGroups[activeMonthIndex]) || todayKey;
          renderMonth();
        });
      }

      if (prevButton) {
        prevButton.addEventListener("click", () => {
          if (activeMonthIndex <= 0) return;
          activeMonthIndex -= 1;
          selectedDateKey = defaultSelectedKey(monthGroups[activeMonthIndex]) || todayKey;
          renderMonth();
        });
      }

      if (nextButton) {
        nextButton.addEventListener("click", () => {
          if (activeMonthIndex >= monthGroups.length - 1) return;
          activeMonthIndex += 1;
          selectedDateKey = defaultSelectedKey(monthGroups[activeMonthIndex]) || todayKey;
          renderMonth();
        });
      }

      if (stamp) {
        stamp.textContent = `Auto-updating rolling calendar. Showing ${monthFormatter.format(group.monthDate)} with coverage through ${monthFormatter.format(monthGroups[monthGroups.length - 1].monthDate)}.`;
      }
      if (total) {
        total.textContent = String(events.length);
      }

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
    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Event data failed (${response.status})`);
        return response.json();
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
