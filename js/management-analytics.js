(() => {
  "use strict";

  const app = document.querySelector("[data-management-app]");
  if (!app) return;

  const panel = app.querySelector('[data-site-studio-panel="analytics"]');
  const root = panel ? panel.querySelector("[data-funnel-analytics]") : null;
  const daysSelect = panel ? panel.querySelector("[data-analytics-days]") : null;
  const environmentSelect = panel ? panel.querySelector("[data-analytics-environment]") : null;
  const refreshButton = panel ? panel.querySelector("[data-analytics-refresh]") : null;
  if (!panel || !root || !daysSelect || !environmentSelect) return;

  const TOKEN_KEY = "dmzMediaToken";
  const endpoint = "/api/admin/funnel-analytics";
  let loading = false;
  let loadedKey = "";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(toNumber(value));
  }

  function formatPercent(value) {
    return `${toNumber(value).toFixed(1).replace(/\.0$/, "")}%`;
  }

  function titleCase(value) {
    const text = String(value || "unspecified").replace(/[-_]+/g, " ").trim();
    return text.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function formatDate(value, options = {}) {
    if (!value) return "No events yet";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "No events yet";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      ...(options.includeYear ? { year: "numeric" } : {}),
      ...(options.includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
    });
  }

  function comparisonLabel(current, previous) {
    const currentValue = toNumber(current);
    const previousValue = toNumber(previous);
    if (!previousValue) return currentValue ? "New in this period" : "No change";
    const change = Math.round(((currentValue - previousValue) / previousValue) * 100);
    if (!change) return "No change vs. prior period";
    return `${change > 0 ? "+" : ""}${change}% vs. prior period`;
  }

  function fillDailySeries(daily, filters) {
    const source = new Map((Array.isArray(daily) ? daily : []).map((item) => [item.date, item]));
    const start = new Date(filters?.from || "");
    const days = Math.max(1, Math.min(400, toNumber(filters?.days) || 30));
    if (!Number.isFinite(start.getTime())) return Array.from(source.values());
    return Array.from({ length: days }, (_unused, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return source.get(key) || { date: key, pageViews: 0, ctaClicks: 0, formStarts: 0, completions: 0 };
    });
  }

  function statCard(label, value, detail, comparison, modifier = "") {
    return `
      <article class="mgmt-analytics-stat ${modifier}">
        <span class="mgmt-analytics-stat-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(formatNumber(value))}</strong>
        <span class="mgmt-analytics-stat-detail">${escapeHtml(detail)}</span>
        <span class="mgmt-analytics-stat-compare">${escapeHtml(comparison)}</span>
      </article>`;
  }

  function renderFunnel(summary) {
    const stages = [
      { label: "Course-page sessions", shortLabel: "Views", value: summary.pageViews },
      { label: "CTA-click sessions", shortLabel: "CTA clicks", value: summary.ctaClicks },
      { label: "Form-start sessions", shortLabel: "Form starts", value: summary.formStarts },
      { label: "Completed inquiries", shortLabel: "Completed", value: summary.completions },
    ];
    const base = Math.max(1, ...stages.map((stage) => toNumber(stage.value)));
    let largestDrop = null;
    for (let index = 0; index < stages.length - 1; index += 1) {
      const from = toNumber(stages[index].value);
      const to = toNumber(stages[index + 1].value);
      const loss = Math.max(0, from - to);
      if (!largestDrop || loss > largestDrop.loss) {
        largestDrop = { from: stages[index].shortLabel, to: stages[index + 1].shortLabel, loss };
      }
    }

    const rows = stages.map((stage, index) => {
      const value = toNumber(stage.value);
      const width = value ? Math.max(5, Math.round((value / base) * 100)) : 0;
      const conversion = index === 0 ? 100 : (toNumber(stages[0].value) ? (value / toNumber(stages[0].value)) * 100 : 0);
      return `
        <li class="mgmt-funnel-stage">
          <div class="mgmt-funnel-stage-copy">
            <span>${escapeHtml(stage.label)}</span>
            <strong>${escapeHtml(formatNumber(value))}</strong>
          </div>
          <div class="mgmt-funnel-track" aria-hidden="true">
            <span style="width:${width}%"></span>
          </div>
          <span class="mgmt-funnel-rate">${index === 0 ? "Starting point" : `${formatPercent(conversion)} of page sessions`}</span>
        </li>`;
    }).join("");

    const dropText = largestDrop && largestDrop.loss
      ? `Largest measured drop: ${largestDrop.from} to ${largestDrop.to} (${formatNumber(largestDrop.loss)} sessions).`
      : "There is not enough activity yet to identify a meaningful drop-off.";

    return `
      <section class="mgmt-analytics-card mgmt-funnel-card">
        <div class="mgmt-analytics-card-head">
          <div><p class="management-kicker">Conversion path</p><h2>Training Funnel</h2></div>
          <span>${escapeHtml(dropText)}</span>
        </div>
        <ol class="mgmt-funnel-list">${rows}</ol>
      </section>`;
  }

  function renderTrend(daily) {
    if (!daily.length) {
      return `
        <section class="mgmt-analytics-card">
          <div class="mgmt-analytics-card-head"><div><p class="management-kicker">Activity</p><h2>Daily Trend</h2></div></div>
          <p class="mgmt-analytics-message">No daily activity is available for this period.</p>
        </section>`;
    }
    const maxValue = Math.max(1, ...daily.map((day) => Math.max(toNumber(day.pageViews), toNumber(day.completions))));
    const columns = daily.map((day) => {
      const viewHeight = Math.max(2, Math.round((toNumber(day.pageViews) / maxValue) * 100));
      const completionHeight = day.completions ? Math.max(4, Math.round((toNumber(day.completions) / maxValue) * 100)) : 0;
      const label = formatDate(`${day.date}T12:00:00Z`);
      const title = `${label}: ${formatNumber(day.pageViews)} page sessions, ${formatNumber(day.completions)} completed inquiries`;
      return `
        <div class="mgmt-trend-day" title="${escapeHtml(title)}">
          <div class="mgmt-trend-bars" aria-hidden="true">
            <span class="mgmt-trend-bar-views" style="height:${viewHeight}%"></span>
            <span class="mgmt-trend-bar-completions" style="height:${completionHeight}%"></span>
          </div>
          <span>${escapeHtml(label)}</span>
        </div>`;
    }).join("");
    return `
      <section class="mgmt-analytics-card">
        <div class="mgmt-analytics-card-head">
          <div><p class="management-kicker">Activity</p><h2>Daily Trend</h2></div>
          <div class="mgmt-trend-legend"><span class="is-views">Page sessions</span><span class="is-completions">Completed</span></div>
        </div>
        <div class="mgmt-trend-scroll" role="img" aria-label="Daily course-page sessions and completed inquiries">
          <div class="mgmt-trend-chart" style="--trend-days:${daily.length}">${columns}</div>
        </div>
      </section>`;
  }

  function renderCourses(courses) {
    if (!courses.length) {
      return '<p class="mgmt-analytics-message">No course activity is available for this period.</p>';
    }
    const rows = courses.map((course) => `
      <tr>
        <th scope="row">${escapeHtml(titleCase(course.course))}</th>
        <td>${escapeHtml(formatNumber(course.pageViews))}</td>
        <td>${escapeHtml(formatNumber(course.ctaClicks))}</td>
        <td>${escapeHtml(formatNumber(course.formStarts))}</td>
        <td>${escapeHtml(formatNumber(course.completions))}</td>
        <td>${escapeHtml(formatPercent(course.completionRate))}</td>
      </tr>`).join("");
    return `
      <div class="mgmt-analytics-table-wrap">
        <table class="mgmt-analytics-table">
          <thead><tr><th>Course</th><th>Views</th><th>CTA</th><th>Starts</th><th>Completed</th><th>Conversion</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderBreakdown(items, key, label, emptyMessage) {
    if (!items.length) return `<p class="mgmt-analytics-message">${escapeHtml(emptyMessage)}</p>`;
    const max = Math.max(1, ...items.map((item) => toNumber(item.sessions)));
    return `<ul class="mgmt-breakdown-list">${items.map((item) => {
      const width = Math.max(3, Math.round((toNumber(item.sessions) / max) * 100));
      return `
        <li>
          <div><span>${escapeHtml(titleCase(item[key]))}</span><strong>${escapeHtml(formatNumber(item.sessions))}</strong></div>
          <span class="mgmt-breakdown-track" aria-hidden="true"><span style="width:${width}%"></span></span>
        </li>`;
    }).join("")}</ul>`;
  }

  function render(data) {
    const summary = data.summary || {};
    const previous = data.previousSummary || {};
    const environmentLabel = data.filters?.environment === "all" ? "all environments" : `${data.filters?.environment || "live"} traffic`;
    const daysLabel = toNumber(data.filters?.days) === 400 ? "all retained data" : `the last ${toNumber(data.filters?.days)} days`;
    const noData = !toNumber(summary.totalEvents);

    const stats = `
      <div class="mgmt-analytics-stats">
        ${statCard("Course-page sessions", summary.pageViews, "Distinct tabs that viewed training pages", comparisonLabel(summary.pageViews, previous.pageViews))}
        ${statCard("CTA-click sessions", summary.ctaClicks, `${formatPercent(summary.rates?.ctaClick)} of page sessions`, comparisonLabel(summary.ctaClicks, previous.ctaClicks))}
        ${statCard("Form-start sessions", summary.formStarts, `${formatPercent(summary.rates?.formStart)} of page sessions`, comparisonLabel(summary.formStarts, previous.formStarts))}
        ${statCard("Completed inquiries", summary.completions, `${formatPercent(summary.rates?.completion)} overall conversion`, comparisonLabel(summary.completions, previous.completions), "is-completion")}
      </div>`;

    root.innerHTML = `
      <div class="mgmt-analytics-summary-line">
        <p>Showing <strong>${escapeHtml(environmentLabel)}</strong> for <strong>${escapeHtml(daysLabel)}</strong>.</p>
        <p>Last event: <strong>${escapeHtml(formatDate(summary.lastEventAt, { includeTime: true }))}</strong></p>
      </div>
      ${noData ? `
        <section class="mgmt-analytics-empty">
          <strong>No funnel activity has been recorded for this view yet.</strong>
          <p>Events will appear here after visitors use the tracked training pages. Try another environment or time period if you expected data.</p>
        </section>` : ""}
      ${stats}
      ${renderFunnel(summary)}
      <div class="mgmt-analytics-grid">
        ${renderTrend(fillDailySeries(data.daily, data.filters))}
        <section class="mgmt-analytics-card mgmt-course-card">
          <div class="mgmt-analytics-card-head"><div><p class="management-kicker">By course</p><h2>Course Performance</h2></div></div>
          ${renderCourses(Array.isArray(data.courses) ? data.courses : [])}
        </section>
        <section class="mgmt-analytics-card">
          <div class="mgmt-analytics-card-head"><div><p class="management-kicker">Attribution</p><h2>Traffic Sources</h2></div></div>
          ${renderBreakdown(Array.isArray(data.sources) ? data.sources : [], "source", "Traffic source", "No source data is available yet.")}
        </section>
        <section class="mgmt-analytics-card">
          <div class="mgmt-analytics-card-head"><div><p class="management-kicker">Audience</p><h2>Device Mix</h2></div></div>
          ${renderBreakdown(Array.isArray(data.devices) ? data.devices : [], "device", "Device", "No device data is available yet.")}
        </section>
      </div>
      <p class="mgmt-analytics-footnote">Counts use anonymous per-tab sessions, not identified people. Development and live traffic are stored separately. Funnel records are retained for up to 400 days.</p>`;
    root.setAttribute("aria-busy", "false");
  }

  function showError(message) {
    root.innerHTML = `
      <section class="mgmt-analytics-empty is-error">
        <strong>Funnel Analytics could not load.</strong>
        <p>${escapeHtml(message || "Try refreshing this view.")}</p>
      </section>`;
    root.setAttribute("aria-busy", "false");
  }

  async function load(force = false) {
    const token = sessionStorage.getItem("dmzCustomerAccessToken") || localStorage.getItem(TOKEN_KEY) || "";
    if (!token) {
      showError("Your management session is not available. Log in again and retry.");
      return;
    }
    const key = `${environmentSelect.value}:${daysSelect.value}`;
    if (loading || (!force && key === loadedKey)) return;
    loading = true;
    root.setAttribute("aria-busy", "true");
    root.innerHTML = '<p class="mgmt-analytics-message">Loading Funnel Analytics…</p>';
    if (refreshButton) refreshButton.disabled = true;

    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("days", daysSelect.value);
      url.searchParams.set("environment", environmentSelect.value);
      url.searchParams.set("t", String(Date.now()));
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Analytics request failed (${response.status}).`);
      }
      loadedKey = key;
      render(data);
    } catch (error) {
      showError((error && error.message) || "Try refreshing this view.");
    } finally {
      loading = false;
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  let wasHidden = panel.hidden;
  new MutationObserver(() => {
    const isHidden = panel.hidden;
    if (wasHidden && !isHidden) load();
    wasHidden = isHidden;
  }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });

  daysSelect.addEventListener("change", () => load(true));
  environmentSelect.addEventListener("change", () => load(true));
  if (refreshButton) refreshButton.addEventListener("click", () => load(true));
})();
