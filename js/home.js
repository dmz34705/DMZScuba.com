(() => {
  const apiRoot =
    (document.body && (document.body.dataset.adminApi || document.body.dataset.mediaApi)) || "";
  const tickerUrl = apiRoot ? `${apiRoot}/api/v2/home-ticker` : "/api/v2/home-ticker";
  const fallbackUrl = "/assets/data/home-ticker.json";
  const rotationMs = 5600;

  const tickerRoot = document.querySelector("[data-home-ticker]");
  const tickerLine = document.querySelector("[data-home-ticker-line]");

  if (!tickerRoot || !tickerLine) return;

  const state = {
    lines: [],
    activeIndex: 0,
    intervalId: 0,
  };

  function normalizeLines(input) {
    return (Array.isArray(input) ? input : [])
      .map((entry) => String(entry || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 24);
  }

  function stopTickerRotation() {
    if (!state.intervalId) return;
    window.clearInterval(state.intervalId);
    state.intervalId = 0;
  }

  function renderTickerLine(index) {
    if (!state.lines.length) {
      tickerRoot.hidden = true;
      tickerLine.textContent = "";
      return;
    }
    const safeIndex = ((index % state.lines.length) + state.lines.length) % state.lines.length;
    state.activeIndex = safeIndex;
    tickerRoot.hidden = false;
    tickerLine.classList.remove("is-visible");
    window.requestAnimationFrame(() => {
      tickerLine.textContent = state.lines[safeIndex];
      tickerLine.classList.add("is-visible");
    });
  }

  function startTickerRotation() {
    stopTickerRotation();
    if (state.lines.length <= 1) return;
    state.intervalId = window.setInterval(() => {
      renderTickerLine(state.activeIndex + 1);
    }, rotationMs);
  }

  function applyTickerLines(lines) {
    state.lines = normalizeLines(lines);
    renderTickerLine(0);
    startTickerRotation();
  }

  async function loadTickerLines() {
    const tryUrls = [tickerUrl, fallbackUrl];
    for (const url of tryUrls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json().catch(() => ({}));
        const lines = normalizeLines(payload && payload.lines);
        if (lines.length) {
          applyTickerLines(lines);
          return;
        }
      } catch (_error) {
        // Try next source.
      }
    }
    applyTickerLines([]);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopTickerRotation();
      return;
    }
    renderTickerLine(state.activeIndex);
    startTickerRotation();
  });

  loadTickerLines();
})();
