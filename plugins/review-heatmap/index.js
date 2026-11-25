export const manifest = {
  id: "review-heatmap",
  name: "Review Heatmap",
  version: "1.0.0",
  description:
    "Adds an interactive calendar review heatmap, streaks, and 90-day due forecast to the deck browser — modeled after Glutanimate's Review Heatmap.",
  author: "Cardly",
  homepage: "https://github.com/cardly-anki/plugins",
  defaultEnabled: true,
  permissions: [
    "ui:decks",
    "events:cards",
    "events:app",
    "stats:read",
    "storage",
    "app:read",
  ],
  configHelp:
    "Configure Review Heatmap appearance and behavior.\n\n" +
    "• viewMode: \"year\" | \"continuous\"\n" +
    "• colorScheme: \"ice\" | \"olive\" | \"flame\" | \"lavender\"\n" +
    "• showForecast: true | false\n" +
    "• weekStartsOn: \"monday\" | \"sunday\"\n" +
    "• dailyTarget: number (e.g. 20)\n" +
    "• position: \"below\" | \"above\"",
};

export const defaultConfig = {
  viewMode: "year",
  colorScheme: "ice",
  showForecast: true,
  weekStartsOn: "monday",
  dailyTarget: 20,
  position: "below",
};

const STORAGE_SETTINGS_KEY = "settings";
const STYLE_ELEMENT_ID = "cardly-review-heatmap-styles";
let activePluginCleanup = null;

const PALETTES = {
  ice: {
    label: "Ice",
    dark: {
      empty: "rgba(255, 255, 255, 0.06)",
      levels: ["#1e3a5f", "#1d4ed8", "#0ea5e9", "#7dd3fc"],
      forecastFill: "#38bdf8",
      forecastStroke: "#38bdf8",
      accent: "#7dd3fc",
      todayStroke: "#f8fafc",
    },
    light: {
      empty: "#ebedf0",
      levels: ["#c6e4f7", "#7bc4ee", "#389cd9", "#1668a3"],
      forecastFill: "#389cd9",
      forecastStroke: "#389cd9",
      accent: "#1668a3",
      todayStroke: "#0f172a",
    },
  },
  olive: {
    label: "Olive",
    dark: {
      empty: "rgba(255, 255, 255, 0.06)",
      levels: ["#0e4429", "#006d32", "#26a641", "#39d353"],
      forecastFill: "#39d353",
      forecastStroke: "#39d353",
      accent: "#4ade80",
      todayStroke: "#f8fafc",
    },
    light: {
      empty: "#ebedf0",
      levels: ["#9be9a8", "#40c463", "#30a14e", "#216e39"],
      forecastFill: "#30a14e",
      forecastStroke: "#30a14e",
      accent: "#216e39",
      todayStroke: "#0f172a",
    },
  },
  flame: {
    label: "Flame",
    dark: {
      empty: "rgba(255, 255, 255, 0.06)",
      levels: ["#5c2314", "#9a3412", "#ea580c", "#fb923c"],
      forecastFill: "#fb923c",
      forecastStroke: "#fb923c",
      accent: "#fb923c",
      todayStroke: "#f8fafc",
    },
    light: {
      empty: "#ebedf0",
      levels: ["#fed7aa", "#fb923c", "#ea580c", "#9a3412"],
      forecastFill: "#ea580c",
      forecastStroke: "#ea580c",
      accent: "#c2410c",
      todayStroke: "#0f172a",
    },
  },
  lavender: {
    label: "Lavender",
    dark: {
      empty: "rgba(255, 255, 255, 0.06)",
      levels: ["#3b1d6a", "#5b21b6", "#8b5cf6", "#c4b5fd"],
      forecastFill: "#a78bfa",
      forecastStroke: "#a78bfa",
      accent: "#c4b5fd",
      todayStroke: "#f8fafc",
    },
    light: {
      empty: "#ebedf0",
      levels: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#5b21b6"],
      forecastFill: "#8b5cf6",
      forecastStroke: "#8b5cf6",
      accent: "#6d28d9",
      todayStroke: "#0f172a",
    },
  },
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .rh-root {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      user-select: none;
      font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      color: var(--fg);
      margin: 4px 0 8px;
    }
    .rh-card {
      width: 100%;
      max-width: 820px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 18px 10px;
      border-radius: var(--border-radius-medium, 12px);
      background: var(--canvas-glass, transparent);
      border: 1px solid var(--border-subtle);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    }
    body.minimalist .rh-card {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
      padding: 6px 4px;
    }
    .rh-toolbar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 8px;
      width: 100%;
      position: relative;
    }
    .rh-year-nav {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .rh-year-label {
      font-size: 13px;
      font-weight: 600;
      min-width: 48px;
      text-align: center;
      color: var(--fg);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
    }
    .rh-year-label.continuous {
      min-width: auto;
      padding: 0 6px;
      color: var(--fg-subtle);
      font-weight: 500;
    }
    .rh-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--fg-subtle);
      cursor: pointer;
      transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
    }
    .rh-icon-btn:hover:not(:disabled) {
      background: var(--border-subtle);
      color: var(--fg);
    }
    .rh-icon-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .rh-icon-btn.active {
      color: var(--fg);
      background: var(--border-subtle);
    }
    .rh-tools-right {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin-left: 6px;
    }
    .rh-grid-scroll {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      display: block;
      padding-bottom: 2px;
    }
    .rh-svg {
      display: block;
      margin: 0 auto;
      flex-shrink: 0;
      overflow: visible;
    }
    .rh-axis-label {
      font-size: 10px;
      fill: var(--fg-subtle);
      font-weight: 500;
    }
    .rh-cell {
      cursor: pointer;
      transition: opacity 90ms ease;
    }
    .rh-cell:hover {
      opacity: 0.85;
    }
    .rh-stats {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px 20px;
      font-size: 12.5px;
      color: var(--fg-subtle);
      text-align: center;
      line-height: 1.4;
    }
    .rh-stat-item {
      display: inline-flex;
      align-items: baseline;
      gap: 5px;
      white-space: nowrap;
    }
    .rh-stat-val {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .rh-tooltip {
      position: fixed;
      z-index: 2500;
      pointer-events: none;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.3;
      white-space: nowrap;
      color: #f8fafc;
      background: rgba(17, 24, 39, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      transform: translate(-50%, -100%);
      opacity: 0;
    }
    .rh-tooltip.visible {
      opacity: 1;
    }
    .rh-tooltip strong {
      font-weight: 700;
      color: #ffffff;
    }
    .rh-settings-window {
      width: min(440px, 94vw);
    }
    .rh-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .rh-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .rh-field-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .rh-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--fg);
    }
    .rh-hint {
      font-size: 11.5px;
      color: var(--fg-subtle);
    }
    .rh-seg {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
      background: var(--canvas-inset);
    }
    .rh-seg button {
      border: none;
      background: transparent;
      color: var(--fg-subtle);
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 500;
      padding: 5px 12px;
      cursor: pointer;
    }
    .rh-seg button.active {
      background: var(--button-primary-bg, #306bec);
      color: #ffffff;
    }
    .rh-palette-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .rh-palette-opt {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--canvas-inset);
      color: var(--fg);
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
    }
    .rh-palette-opt.active {
      border-color: var(--border-focus, #3b82f6);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.22);
    }
    .rh-swatches {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .rh-swatch {
      width: 11px;
      height: 11px;
      border-radius: 2px;
      display: inline-block;
    }
    @media (max-width: 640px) {
      .rh-card {
        padding: 10px 10px 8px;
      }
      .rh-grid-scroll {
        justify-content: flex-start;
      }
      .rh-stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px 12px;
        width: 100%;
        font-size: 12px;
      }
      .rh-stat-item {
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
}

function sanitizeSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const viewMode = src.viewMode === "continuous" ? "continuous" : "year";
  const colorScheme = Object.prototype.hasOwnProperty.call(PALETTES, src.colorScheme)
    ? src.colorScheme
    : "ice";
  const showForecast = src.showForecast !== false;
  const weekStartsOn = src.weekStartsOn === "sunday" ? "sunday" : "monday";
  const targetNum = Number(src.dailyTarget);
  const dailyTarget =
    Number.isFinite(targetNum) && targetNum >= 1
      ? Math.min(10000, Math.floor(targetNum))
      : 20;
  const position = src.position === "above" ? "above" : "below";
  return {
    viewMode,
    colorScheme,
    showForecast,
    weekStartsOn,
    dailyTarget,
    position,
  };
}

function parseYmdUtc(ymd) {
  const parts = String(ymd).split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Date.UTC(y, m - 1, d);
}

function formatYmdUtc(ms) {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysUtc(ms, days) {
  return ms + days * 86_400_000;
}

function formatHumanDate(ms) {
  const dt = new Date(ms);
  const weekday = WEEKDAY_LONG[dt.getUTCDay()];
  const month = MONTH_SHORT[dt.getUTCMonth()];
  const day = dt.getUTCDate();
  const year = dt.getUTCFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
}

function getLocalFallbackToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeScaleMax(history, dailyTarget) {
  const values = Object.values(history || {}).filter((v) => typeof v === "number" && v > 0);
  if (values.length === 0) return Math.max(1, dailyTarget || 20);
  values.sort((a, b) => a - b);
  const p95Idx = Math.min(values.length - 1, Math.floor(values.length * 0.95));
  const p95 = values[p95Idx];
  return Math.max(dailyTarget || 20, p95);
}

function getLevelForCount(count, scaleMax) {
  if (!count || count <= 0) return 0;
  const ratio = count / Math.max(1, scaleMax);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function buildCalendarModel(stats, settings, selectedYear) {
  const todayStr = stats?.today || getLocalFallbackToday();
  const todayMs = parseYmdUtc(todayStr) ?? Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const startDow = settings.weekStartsOn === "sunday" ? 0 : 1; // 0=Sun, 1=Mon

  let rangeStartMs;
  let rangeEndMs;
  let restrictYear = null;

  if (settings.viewMode === "continuous") {
    const forecastDays = settings.showForecast ? 42 : 0;
    const anchorEndMs = addDaysUtc(todayMs, forecastDays);
    const endDow = new Date(anchorEndMs).getUTCDay();
    const diffToEnd = (startDow + 6 - endDow + 7) % 7;
    rangeEndMs = addDaysUtc(anchorEndMs, diffToEnd);
    // 53 full weeks (53 * 7 - 1 days)
    rangeStartMs = addDaysUtc(rangeEndMs, -(53 * 7 - 1));
  } else {
    restrictYear = selectedYear;
    const jan1 = Date.UTC(selectedYear, 0, 1);
    const dec31 = Date.UTC(selectedYear, 11, 31);
    const jan1Dow = new Date(jan1).getUTCDay();
    const backDays = (jan1Dow - startDow + 7) % 7;
    rangeStartMs = addDaysUtc(jan1, -backDays);

    const dec31Dow = new Date(dec31).getUTCDay();
    const fwdDays = (startDow + 6 - dec31Dow + 7) % 7;
    rangeEndMs = addDaysUtc(dec31, fwdDays);
  }

  const totalDays = Math.round((rangeEndMs - rangeStartMs) / 86_400_000) + 1;
  const weekCount = Math.ceil(totalDays / 7);
  const weeks = [];
  const monthLabels = [];
  let lastLabeledCol = -99;

  for (let col = 0; col < weekCount; col++) {
    const days = [];
    for (let row = 0; row < 7; row++) {
      const ms = addDaysUtc(rangeStartMs, col * 7 + row);
      const dt = new Date(ms);
      const year = dt.getUTCFullYear();
      const inBounds = restrictYear === null || year === restrictYear;
      const ymd = formatYmdUtc(ms);
      days.push({
        ms,
        ymd,
        row,
        col,
        inBounds,
        isMonthStart: dt.getUTCDate() === 1,
        month: dt.getUTCMonth(),
      });
      if (inBounds && dt.getUTCDate() === 1 && col - lastLabeledCol >= 2) {
        monthLabels.push({
          col,
          label: MONTH_SHORT[dt.getUTCMonth()],
        });
        lastLabeledCol = col;
      }
    }
    weeks.push(days);
  }

  // Ensure first visible month gets a label in Continuous mode if Jan/start month wasn't day 1
  if (monthLabels.length === 0 || monthLabels[0].col > 3) {
    const firstVisible = weeks[0]?.find((d) => d.inBounds);
    if (firstVisible && (monthLabels.length === 0 || monthLabels[0].col - 0 >= 2)) {
      monthLabels.unshift({
        col: 0,
        label: MONTH_SHORT[firstVisible.month],
      });
    }
  }

  return {
    todayStr,
    todayMs,
    weekCount,
    weeks,
    monthLabels,
    startDow,
  };
}

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

function createChevIcon(dir) {
  const svg = createSvgElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.8,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const d = dir === "left" ? "M10 3.5L5.5 8 10 12.5" : "M6 3.5L10.5 8 6 12.5";
  svg.appendChild(createSvgElement("path", { d }));
  return svg;
}

function createModeIcon(mode) {
  const svg = createSvgElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.4,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  if (mode === "continuous") {
    // Rolling / continuous wave-calendar glyph
    svg.appendChild(createSvgElement("rect", { x: 2, y: 3, width: 12, height: 10, rx: 2 }));
    svg.appendChild(createSvgElement("path", { d: "M4.5 8h7M9.5 6l2 2-2 2" }));
  } else {
    // Calendar grid glyph
    svg.appendChild(createSvgElement("rect", { x: 2, y: 3, width: 12, height: 10.5, rx: 2 }));
    svg.appendChild(createSvgElement("path", { d: "M2 6.5h12M5.5 1.8v2.2M10.5 1.8v2.2" }));
  }
  return svg;
}

function createGearIcon() {
  const svg = createSvgElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(createSvgElement("circle", { cx: 12, cy: 12, r: 3 }));
  svg.appendChild(
    createSvgElement("path", {
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    })
  );
  return svg;
}

export default {
  manifest,
  defaultConfig,

  onLoad(sdk) {
    injectStyles();

    const stored = sdk.storage.get(STORAGE_SETTINGS_KEY, null);
    let settings = sanitizeSettings({
      ...defaultConfig,
      ...sdk.config.get(),
      ...(stored && typeof stored === "object" ? stored : {}),
    });

    let stats = null;
    let selectedYear = Number(getLocalFallbackToday().slice(0, 4)) || new Date().getFullYear();
    let loading = false;
    let loadSeq = 0;
    let activeUnmount = null;
    let currentSlotId = null;
    let settingsModalBackdrop = null;
    let tooltipEl = null;

    function isDarkTheme() {
      try {
        return Boolean(sdk.app.getState().isDark);
      } catch {
        return document.documentElement.classList.contains("night-mode");
      }
    }

    function ensureTooltip() {
      if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
      tooltipEl = document.createElement("div");
      tooltipEl.className = "rh-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tooltipEl);
      return tooltipEl;
    }

    function showTooltip(rectEl, count, textAfterCount) {
      const tip = ensureTooltip();
      tip.textContent = "";
      if (count !== null) {
        const strong = document.createElement("strong");
        strong.textContent = String(count);
        tip.appendChild(strong);
        tip.appendChild(document.createTextNode(textAfterCount));
      } else {
        tip.textContent = textAfterCount;
      }
      const box = rectEl.getBoundingClientRect();
      tip.style.left = `${box.left + box.width / 2}px`;
      tip.style.top = `${box.top - 8}px`;
      tip.classList.add("visible");
    }

    function hideTooltip() {
      if (tooltipEl) {
        tooltipEl.classList.remove("visible");
      }
    }

    function targetSlotForPosition(pos) {
      return pos === "above" ? "decks:top" : "decks:bottom";
    }

    function saveSettings(next) {
      settings = sanitizeSettings(next);
      sdk.storage.set(STORAGE_SETTINGS_KEY, settings);
      const desiredSlot = targetSlotForPosition(settings.position);
      if (desiredSlot !== currentSlotId) {
        mountInSlot(desiredSlot);
      } else {
        sdk.ui.refresh(currentSlotId);
      }
    }

    function closeSettingsModal() {
      if (settingsModalBackdrop) {
        settingsModalBackdrop.remove();
        settingsModalBackdrop = null;
      }
    }

    function openSettingsModal() {
      closeSettingsModal();
      const draft = { ...settings };
      const dark = isDarkTheme();

      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.setAttribute("role", "presentation");

      const win = document.createElement("div");
      win.className = "modal-window rh-settings-window";
      win.setAttribute("role", "dialog");
      win.setAttribute("aria-modal", "true");
      win.setAttribute("aria-label", "Review Heatmap Settings");
      win.addEventListener("click", (e) => e.stopPropagation());

      // Header
      const header = document.createElement("div");
      header.className = "modal-header";
      const title = document.createElement("h3");
      title.className = "modal-title";
      title.textContent = "Review Heatmap Settings";
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "modal-close";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", closeSettingsModal);
      header.append(title, closeBtn);

      // Body
      const body = document.createElement("div");
      body.className = "modal-body";
      const form = document.createElement("div");
      form.className = "rh-form";

      // 1. View Mode
      const viewField = document.createElement("div");
      viewField.className = "rh-field-row";
      const viewLabelWrap = document.createElement("div");
      const viewLbl = document.createElement("div");
      viewLbl.className = "rh-label";
      viewLbl.textContent = "View mode";
      const viewHint = document.createElement("div");
      viewHint.className = "rh-hint";
      viewHint.textContent = "Calendar year or rolling 12-month timeline";
      viewLabelWrap.append(viewLbl, viewHint);

      const viewSeg = document.createElement("div");
      viewSeg.className = "rh-seg";
      for (const opt of [
        { id: "year", label: "Year" },
        { id: "continuous", label: "Continuous" },
      ]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = opt.label;
        if (draft.viewMode === opt.id) btn.classList.add("active");
        btn.addEventListener("click", () => {
          draft.viewMode = opt.id;
          for (const b of viewSeg.querySelectorAll("button")) {
            b.classList.remove("active");
          }
          btn.classList.add("active");
        });
        viewSeg.appendChild(btn);
      }
      viewField.append(viewLabelWrap, viewSeg);
      form.appendChild(viewField);

      // 2. Color Scheme
      const palField = document.createElement("div");
      palField.className = "rh-field";
      const palLbl = document.createElement("div");
      palLbl.className = "rh-label";
      palLbl.textContent = "Color scheme";
      const palGrid = document.createElement("div");
      palGrid.className = "rh-palette-grid";
      for (const [key, pal] of Object.entries(PALETTES)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rh-palette-opt";
        btn.dataset.scheme = key;
        if (draft.colorScheme === key) btn.classList.add("active");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = pal.label;

        const swatches = document.createElement("span");
        swatches.className = "rh-swatches";
        const modeColors = dark ? pal.dark.levels : pal.light.levels;
        for (const color of modeColors) {
          const sq = document.createElement("span");
          sq.className = "rh-swatch";
          sq.style.background = color;
          swatches.appendChild(sq);
        }
        btn.append(nameSpan, swatches);
        btn.addEventListener("click", () => {
          draft.colorScheme = key;
          for (const b of palGrid.querySelectorAll(".rh-palette-opt")) {
            b.classList.remove("active");
          }
          btn.classList.add("active");
        });
        palGrid.appendChild(btn);
      }
      palField.append(palLbl, palGrid);
      form.appendChild(palField);

      // 3. Week starts on
      const weekField = document.createElement("div");
      weekField.className = "rh-field-row";
      const weekLbl = document.createElement("div");
      weekLbl.className = "rh-label";
      weekLbl.textContent = "Week starts on";
      const weekSeg = document.createElement("div");
      weekSeg.className = "rh-seg";
      for (const opt of [
        { id: "monday", label: "Monday" },
        { id: "sunday", label: "Sunday" },
      ]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = opt.label;
        if (draft.weekStartsOn === opt.id) btn.classList.add("active");
        btn.addEventListener("click", () => {
          draft.weekStartsOn = opt.id;
          for (const b of weekSeg.querySelectorAll("button")) {
            b.classList.remove("active");
          }
          btn.classList.add("active");
        });
        weekSeg.appendChild(btn);
      }
      weekField.append(weekLbl, weekSeg);
      form.appendChild(weekField);

      // 4. Position
      const posField = document.createElement("div");
      posField.className = "rh-field-row";
      const posLbl = document.createElement("div");
      posLbl.className = "rh-label";
      posLbl.textContent = "Position on Decks screen";
      const posSeg = document.createElement("div");
      posSeg.className = "rh-seg";
      for (const opt of [
        { id: "below", label: "Below decks" },
        { id: "above", label: "Above decks" },
      ]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = opt.label;
        if (draft.position === opt.id) btn.classList.add("active");
        btn.addEventListener("click", () => {
          draft.position = opt.id;
          for (const b of posSeg.querySelectorAll("button")) {
            b.classList.remove("active");
          }
          btn.classList.add("active");
        });
        posSeg.appendChild(btn);
      }
      posField.append(posLbl, posSeg);
      form.appendChild(posField);

      // 5. Daily target
      const targetField = document.createElement("div");
      targetField.className = "rh-field-row";
      const targetWrap = document.createElement("div");
      const targetLbl = document.createElement("label");
      targetLbl.className = "rh-label";
      targetLbl.textContent = "Daily target";
      targetLbl.setAttribute("for", "rh-daily-target-input");
      const targetHint = document.createElement("div");
      targetHint.className = "rh-hint";
      targetHint.textContent = "Reference goal for heatmap intensity";
      targetWrap.append(targetLbl, targetHint);

      const targetInput = document.createElement("input");
      targetInput.id = "rh-daily-target-input";
      targetInput.type = "number";
      targetInput.min = "1";
      targetInput.max = "10000";
      targetInput.className = "anki-input";
      targetInput.style.width = "88px";
      targetInput.value = String(draft.dailyTarget);
      targetInput.addEventListener("input", () => {
        const n = Number(targetInput.value);
        if (Number.isFinite(n) && n >= 1) {
          draft.dailyTarget = Math.floor(n);
        }
      });
      targetField.append(targetWrap, targetInput);
      form.appendChild(targetField);

      // 6. Show forecast
      const forecastField = document.createElement("label");
      forecastField.className = "rh-field-row";
      forecastField.style.cursor = "pointer";
      const forecastWrap = document.createElement("div");
      const forecastLbl = document.createElement("div");
      forecastLbl.className = "rh-label";
      forecastLbl.textContent = "Show forecast";
      const forecastHint = document.createElement("div");
      forecastHint.className = "rh-hint";
      forecastHint.textContent = "Highlight upcoming due cards after today";
      forecastWrap.append(forecastLbl, forecastHint);

      const forecastCb = document.createElement("input");
      forecastCb.type = "checkbox";
      forecastCb.checked = draft.showForecast;
      forecastCb.style.width = "16px";
      forecastCb.style.height = "16px";
      forecastCb.addEventListener("change", () => {
        draft.showForecast = forecastCb.checked;
      });
      forecastField.append(forecastWrap, forecastCb);
      form.appendChild(forecastField);

      body.appendChild(form);

      // Footer
      const footer = document.createElement("div");
      footer.className = "modal-footer";

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "anki-btn";
      resetBtn.textContent = "Reset Defaults";
      resetBtn.style.marginRight = "auto";
      resetBtn.addEventListener("click", () => {
        saveSettings({ ...defaultConfig });
        closeSettingsModal();
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "anki-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", closeSettingsModal);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "anki-btn primary";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", () => {
        saveSettings(draft);
        closeSettingsModal();
      });

      footer.append(resetBtn, cancelBtn, saveBtn);
      win.append(header, body, footer);
      backdrop.appendChild(win);

      backdrop.addEventListener("click", closeSettingsModal);
      const onKey = (e) => {
        if (e.key === "Escape") {
          closeSettingsModal();
          window.removeEventListener("keydown", onKey);
        }
      };
      window.addEventListener("keydown", onKey);

      document.body.appendChild(backdrop);
      settingsModalBackdrop = backdrop;
    }

    async function refreshStats() {
      const seq = ++loadSeq;
      loading = true;
      try {
        const next = await sdk.stats.getHeatmap();
        if (seq !== loadSeq) return;
        const hadToday = Boolean(stats?.today);
        stats = next;
        if (!hadToday && next.today) {
          const y = Number(next.today.slice(0, 4));
          if (Number.isFinite(y)) {
            selectedYear = y;
          }
        }
      } catch (err) {
        console.warn("[Review Heatmap] Failed to load stats:", err);
      } finally {
        if (seq === loadSeq) {
          loading = false;
          if (currentSlotId) {
            sdk.ui.refresh(currentSlotId);
          }
        }
      }
    }

    function renderHeatmap(container) {
      hideTooltip();
      const dark = isDarkTheme();
      const paletteDef = PALETTES[settings.colorScheme] || PALETTES.ice;
      const themeColors = dark ? paletteDef.dark : paletteDef.light;

      const root = document.createElement("div");
      root.className = "rh-root";

      const card = document.createElement("div");
      card.className = "rh-card";

      // 1. Compact top bar
      const toolbar = document.createElement("div");
      toolbar.className = "rh-toolbar";

      const yearNav = document.createElement("div");
      yearNav.className = "rh-year-nav";

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "rh-icon-btn rh-prev-year";
      prevBtn.title = "Previous year";
      prevBtn.setAttribute("aria-label", "Previous year");
      prevBtn.disabled = settings.viewMode === "continuous";
      prevBtn.appendChild(createChevIcon("left"));
      prevBtn.addEventListener("click", () => {
        selectedYear -= 1;
        sdk.ui.refresh(currentSlotId);
      });

      const yearLabel = document.createElement("span");
      yearLabel.className =
        settings.viewMode === "continuous" ? "rh-year-label continuous" : "rh-year-label";
      yearLabel.textContent =
        settings.viewMode === "continuous" ? "Last 12 months" : String(selectedYear);

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "rh-icon-btn rh-next-year";
      nextBtn.title = "Next year";
      nextBtn.setAttribute("aria-label", "Next year");
      nextBtn.disabled = settings.viewMode === "continuous";
      nextBtn.appendChild(createChevIcon("right"));
      nextBtn.addEventListener("click", () => {
        selectedYear += 1;
        sdk.ui.refresh(currentSlotId);
      });

      yearNav.append(prevBtn, yearLabel, nextBtn);

      const rightTools = document.createElement("div");
      rightTools.className = "rh-tools-right";

      const modeBtn = document.createElement("button");
      modeBtn.type = "button";
      modeBtn.className =
        settings.viewMode === "continuous" ? "rh-icon-btn rh-mode-btn active" : "rh-icon-btn rh-mode-btn";
      modeBtn.title =
        settings.viewMode === "year"
          ? "Switch to Continuous mode (last 12 months)"
          : "Switch to Year mode";
      modeBtn.setAttribute("aria-label", "Toggle view mode");
      modeBtn.appendChild(createModeIcon(settings.viewMode));
      modeBtn.addEventListener("click", () => {
        saveSettings({
          ...settings,
          viewMode: settings.viewMode === "year" ? "continuous" : "year",
        });
      });

      const gearBtn = document.createElement("button");
      gearBtn.type = "button";
      gearBtn.className = "rh-icon-btn rh-settings-btn";
      gearBtn.title = "Review Heatmap Settings";
      gearBtn.setAttribute("aria-label", "Review Heatmap Settings");
      gearBtn.appendChild(createGearIcon());
      gearBtn.addEventListener("click", openSettingsModal);

      rightTools.append(modeBtn, gearBtn);
      toolbar.append(yearNav, rightTools);
      card.appendChild(toolbar);

      // 2. SVG Calendar Grid
      const model = buildCalendarModel(stats, settings, selectedYear);
      const cellSize = 11;
      const cellGap = 3;
      const pitch = cellSize + cellGap;
      const leftPad = 30;
      const topPad = 16;
      const rightPad = 4;
      const bottomPad = 2;
      const svgWidth = leftPad + model.weekCount * pitch - cellGap + rightPad;
      const svgHeight = topPad + 7 * pitch - cellGap + bottomPad;

      const gridScroll = document.createElement("div");
      gridScroll.className = "rh-grid-scroll";

      const svg = createSvgElement("svg", {
        class: "rh-svg",
        width: svgWidth,
        height: svgHeight,
        viewBox: `0 0 ${svgWidth} ${svgHeight}`,
        role: "img",
        "aria-label": "Review activity heatmap",
      });

      // Month labels along top
      for (const m of model.monthLabels) {
        const text = createSvgElement("text", {
          x: leftPad + m.col * pitch,
          y: 10,
          class: "rh-axis-label",
        });
        text.textContent = m.label;
        svg.appendChild(text);
      }

      // Weekday labels on left (Mon, Wed, Fri)
      const weekdayMarks =
        model.startDow === 1
          ? [
              { row: 0, text: "Mon" },
              { row: 2, text: "Wed" },
              { row: 4, text: "Fri" },
            ]
          : [
              { row: 1, text: "Mon" },
              { row: 3, text: "Wed" },
              { row: 5, text: "Fri" },
            ];
      for (const mark of weekdayMarks) {
        const label = createSvgElement("text", {
          x: 0,
          y: topPad + mark.row * pitch + 9,
          class: "rh-axis-label",
        });
        label.textContent = mark.text;
        svg.appendChild(label);
      }

      const history = stats?.history || {};
      const forecast = stats?.forecast || {};
      const scaleMax = computeScaleMax(history, settings.dailyTarget);

      for (const week of model.weeks) {
        for (const day of week) {
          if (!day.inBounds) continue;
          const x = leftPad + day.col * pitch;
          const y = topPad + day.row * pitch;
          const isToday = day.ymd === model.todayStr;
          const isFuture = day.ms > model.todayMs;
          const reviewCount = Number(history[day.ymd] || 0);
          const dueCount = Number(forecast[day.ymd] || 0);

          const attrs = {
            class: "rh-cell",
            x,
            y,
            width: cellSize,
            height: cellSize,
            rx: 2,
            ry: 2,
            "data-date": day.ymd,
          };

          if (isFuture) {
            if (settings.showForecast && dueCount > 0) {
              attrs.fill = themeColors.forecastFill;
              attrs["fill-opacity"] = dark ? "0.28" : "0.24";
              attrs.stroke = themeColors.forecastStroke;
              attrs["stroke-opacity"] = "0.6";
              attrs["stroke-width"] = "1";
              attrs["data-forecast"] = dueCount;
            } else {
              attrs.fill = themeColors.empty;
              if (settings.showForecast) {
                attrs["fill-opacity"] = "0.55";
              }
            }
          } else {
            const level = getLevelForCount(reviewCount, scaleMax);
            attrs.fill = level === 0 ? themeColors.empty : themeColors.levels[level - 1];
            attrs["data-level"] = level;
            attrs["data-count"] = reviewCount;
            if (isToday) {
              attrs.stroke = themeColors.todayStroke;
              attrs["stroke-width"] = "1.6";
              attrs["data-today"] = "true";
            }
          }

          const rect = createSvgElement("rect", attrs);
          rect.addEventListener("mouseenter", () => {
            const humanDate = formatHumanDate(day.ms);
            if (isFuture) {
              if (!settings.showForecast || dueCount === 0) {
                showTooltip(rect, null, `No cards due on ${humanDate}`);
              } else if (dueCount === 1) {
                showTooltip(rect, 1, ` card due on ${humanDate}`);
              } else {
                showTooltip(rect, dueCount, ` cards due on ${humanDate}`);
              }
            } else if (reviewCount === 0) {
              showTooltip(rect, null, `No reviews on ${humanDate}`);
            } else if (reviewCount === 1) {
              showTooltip(rect, 1, ` review on ${humanDate}`);
            } else {
              showTooltip(rect, reviewCount, ` reviews on ${humanDate}`);
            }
          });
          rect.addEventListener("mouseleave", hideTooltip);
          svg.appendChild(rect);
        }
      }

      gridScroll.appendChild(svg);
      card.appendChild(gridScroll);

      // 3. Stats line strictly below grid
      const statsRow = document.createElement("div");
      statsRow.className = "rh-stats";

      const dailyAvg = Math.round(Number(stats?.dailyAverage || 0));
      const daysLearned = Math.round(Number(stats?.daysLearnedPercent || 0));
      const longestStreak = Number(stats?.longestStreak || 0);
      const currentStreak = Number(stats?.currentStreak || 0);

      const statItems = [
        {
          label: "Daily average:",
          value: `${dailyAvg} ${dailyAvg === 1 ? "card" : "cards"}`,
          testId: "daily-average",
        },
        {
          label: "Days learned:",
          value: `${daysLearned}%`,
          testId: "days-learned",
        },
        {
          label: "Longest streak:",
          value: `${longestStreak} ${longestStreak === 1 ? "day" : "days"}`,
          testId: "longest-streak",
        },
        {
          label: "Current streak:",
          value: `${currentStreak} ${currentStreak === 1 ? "day" : "days"}`,
          testId: "current-streak",
        },
      ];

      for (const item of statItems) {
        const span = document.createElement("span");
        span.className = "rh-stat-item";
        span.dataset.stat = item.testId;

        const lbl = document.createElement("span");
        lbl.textContent = item.label;

        const val = document.createElement("span");
        val.className = "rh-stat-val";
        val.style.color = themeColors.accent;
        val.textContent = loading && !stats ? "…" : item.value;

        span.append(lbl, val);
        statsRow.appendChild(span);
      }

      card.appendChild(statsRow);
      root.appendChild(card);
      container.appendChild(root);

      return () => {
        hideTooltip();
      };
    }

    function mountInSlot(slotId) {
      if (activeUnmount) {
        activeUnmount();
        activeUnmount = null;
      }
      currentSlotId = slotId;
      activeUnmount = sdk.ui.mount(slotId, renderHeatmap);
    }

    // Watch theme class changes on <html> so Dark/Light toggle re-renders immediately
    let themeObserver = null;
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      let prevDark = isDarkTheme();
      themeObserver = new MutationObserver(() => {
        const nextDark = isDarkTheme();
        if (nextDark !== prevDark) {
          prevDark = nextDark;
          if (currentSlotId) sdk.ui.refresh(currentSlotId);
        }
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    sdk.config.onChange((nextCfg) => {
      saveSettings({ ...settings, ...nextCfg });
    });

    sdk.events.on("card:answered", () => {
      void refreshStats();
    });
    sdk.events.on("decks:updated", () => {
      void refreshStats();
    });
    sdk.events.on("sync:completed", () => {
      void refreshStats();
    });

    mountInSlot(targetSlotForPosition(settings.position));
    void refreshStats();

    activePluginCleanup = () => {
      hideTooltip();
      if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
      }
      closeSettingsModal();
      if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
      }
    };
  },

  onUnload() {
    if (typeof activePluginCleanup === "function") {
      activePluginCleanup();
      activePluginCleanup = null;
    }
  },
};
