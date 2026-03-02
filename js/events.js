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

  function parseEventDate(eventItem) {
    const parsed = new Date(`${eventItem.date}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeEvents(payload) {
    const items = payload && Array.isArray(payload.events) ? payload.events : [];
    return items
      .map((eventItem) => {
        const date = parseEventDate(eventItem);
        if (!date) return null;
        return {
          ...eventItem,
          dateObj: date,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dateObj - b.dateObj);
  }

  function buildMonthGroups(events) {
    const groups = [];
    const byKey = new Map();
    events.forEach((eventItem) => {
      const monthKey = `${eventItem.dateObj.getFullYear()}-${String(eventItem.dateObj.getMonth() + 1).padStart(2, "0")}`;
      let group = byKey.get(monthKey);
      if (!group) {
        const monthDate = new Date(eventItem.dateObj.getFullYear(), eventItem.dateObj.getMonth(), 1);
        group = { key: monthKey, monthDate, events: [] };
        byKey.set(monthKey, group);
        groups.push(group);
      }
      group.events.push(eventItem);
    });
    return groups;
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

    list.innerHTML = "";
    if (!events.length) {
      empty.hidden = false;
      list.hidden = true;
    } else {
      empty.hidden = true;
      list.hidden = false;
      events.slice(0, 3).forEach((eventItem) => list.appendChild(renderEventCard(eventItem, true)));
    }

    if (stamp && payload && payload.updated) {
      stamp.textContent = `Last updated ${payload.updated}`;
    }
  }

  function renderCalendar(events) {
    if (!pageRoot) return;
    const monthHost = pageRoot.querySelector("[data-events-calendar]");
    const listHost = pageRoot.querySelector("[data-events-list]");
    const empty = pageRoot.querySelector("[data-events-empty]");
    const stamp = pageRoot.querySelector("[data-events-updated]");
    const total = pageRoot.querySelector("[data-events-total]");
    if (!monthHost || !listHost || !empty) return;

    monthHost.innerHTML = "";
    listHost.innerHTML = "";

    if (!events.length) {
      empty.hidden = false;
      monthHost.hidden = true;
      listHost.hidden = true;
      return;
    }

    empty.hidden = true;
    monthHost.hidden = false;
    listHost.hidden = false;

    const monthGroups = buildMonthGroups(events);
    let activeMonthIndex = 0;
    let selectedDateKey = monthGroups[0] && monthGroups[0].events[0] ? monthGroups[0].events[0].date : "";

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

      const card = document.createElement("section");
      card.className = "events-month-card";

      const firstOfMonth = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth(), 1);
      const lastOfMonth = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth() + 1, 0);
      const offset = firstOfMonth.getDay();
      const totalDays = lastOfMonth.getDate();
      const eventMap = new Map();

      group.events.forEach((eventItem) => {
        const key = eventItem.date;
        const items = eventMap.get(key) || [];
        items.push(eventItem);
        eventMap.set(key, items);
      });
      if (!selectedDateKey || !eventMap.has(selectedDateKey)) {
        selectedDateKey = group.events[0] ? group.events[0].date : "";
      }

      const head = document.createElement("div");
      head.className = "events-month-head";
      const prevDisabled = activeMonthIndex === 0 ? "disabled" : "";
      const nextDisabled = activeMonthIndex >= monthGroups.length - 1 ? "disabled" : "";
      head.innerHTML = `
        <div>
          <h2>${monthFormatter.format(group.monthDate)}</h2>
          <p>${group.events.length} scheduled item${group.events.length === 1 ? "" : "s"}</p>
        </div>
        <div class="events-month-nav" aria-label="Calendar month controls">
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

      for (let blank = 0; blank < offset; blank += 1) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "events-day events-day-empty";
        grid.appendChild(emptyCell);
      }

      for (let day = 1; day <= totalDays; day += 1) {
        const dateObj = new Date(group.monthDate.getFullYear(), group.monthDate.getMonth(), day);
        const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const items = eventMap.get(dateKey) || [];
        const cell = document.createElement("div");
        cell.className = items.length ? "events-day events-day-active" : "events-day";
        const selectedClass = items.length && selectedDateKey === dateKey ? " events-day-selected" : "";
        if (selectedClass) cell.className += selectedClass;

        if (!items.length) {
          cell.innerHTML = `<span class="events-day-number">${day}</span>`;
          grid.appendChild(cell);
          continue;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "events-day-button";
        button.setAttribute("aria-pressed", selectedDateKey === dateKey ? "true" : "false");
        button.setAttribute("aria-label", `${weekdayLongFormatter.format(dateObj)} with ${items.length} event${items.length === 1 ? "" : "s"}`);
        button.innerHTML = `
          <span class="events-day-number">${day}</span>
          <span class="events-day-dot"></span>
          <span class="events-day-count">${items.length} event${items.length === 1 ? "" : "s"}</span>
        `;
        button.addEventListener("click", () => {
          selectedDateKey = dateKey;
          renderMonth();
        });
        cell.appendChild(button);

        grid.appendChild(cell);
      }

      card.append(head, grid);
      monthHost.appendChild(card);

      const selectedItems = eventMap.get(selectedDateKey) || [];
      const selectedDate = selectedItems[0] ? selectedItems[0].dateObj : group.monthDate;
      const agendaHead = document.createElement("div");
      agendaHead.className = "events-agenda-head";
      agendaHead.innerHTML = `
        <h3>${selectedItems.length ? weekdayLongFormatter.format(selectedDate) : monthFormatter.format(group.monthDate)}</h3>
        <p>${selectedItems.length ? "Full details for the selected day." : "No events loaded for this month."}</p>
      `;
      listHost.appendChild(agendaHead);

      if (!selectedItems.length) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "events-agenda-empty";
        emptyItem.textContent = "No scheduled events on the selected date. Use the month controls to browse other dates.";
        listHost.appendChild(emptyItem);
      } else {
        selectedItems.forEach((eventItem) => listHost.appendChild(renderEventCard(eventItem)));
      }

      const prevButton = head.querySelector("[data-events-prev]");
      const nextButton = head.querySelector("[data-events-next]");
      if (prevButton) {
        prevButton.addEventListener("click", () => {
          if (activeMonthIndex <= 0) return;
          activeMonthIndex -= 1;
          selectedDateKey = monthGroups[activeMonthIndex] && monthGroups[activeMonthIndex].events[0]
            ? monthGroups[activeMonthIndex].events[0].date
            : "";
          renderMonth();
        });
      }
      if (nextButton) {
        nextButton.addEventListener("click", () => {
          if (activeMonthIndex >= monthGroups.length - 1) return;
          activeMonthIndex += 1;
          selectedDateKey = monthGroups[activeMonthIndex] && monthGroups[activeMonthIndex].events[0]
            ? monthGroups[activeMonthIndex].events[0].date
            : "";
          renderMonth();
        });
      }

      if (stamp) {
        stamp.textContent = `Showing ${monthFormatter.format(group.monthDate)}. Use Previous and Next to browse the calendar.`;
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
        const events = normalizeEvents(payload);
        renderPreview(events, payload);
        renderCalendar(events, payload);
        resizeEmbedFrame();
      })
      .catch(() => {
        renderError();
      });
  }
})();
