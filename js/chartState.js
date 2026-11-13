export let slices = [];
export let previousSlices = [];
export let chartTotal = 0;

const VALID_CHART_MODES = new Set([
  "pie",
  "donut"
]);

const VALID_VIEW_MODES = new Set([
  "chart",
  "table"
]);

const storedChartMode =
  localStorage.getItem("chartMode");

export let chartMode =
  VALID_CHART_MODES.has(storedChartMode)
    ? storedChartMode
    : "donut";

const storedViewMode =
  localStorage.getItem("viewMode");

export let viewMode =
  VALID_VIEW_MODES.has(storedViewMode)
    ? storedViewMode
    : "chart";

export let patternMode =
  localStorage.getItem("patternMode") !== "false";

export let focusedSliceIndex = 0;

export const setSlices = data => (slices = data);
export const setPreviousSlices = slices => {
  previousSlices = slices.map(s => ({ ...s }));
};
export const setChartTotal = val => (chartTotal = val);
export const toggleChartMode = () =>
  (chartMode = chartMode === "pie" ? "donut" : "pie");
export const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

export const setChartMode = mode => {
  if (!VALID_CHART_MODES.has(mode)) {
    return false;
  }

  chartMode = mode;
  return true;
};

export const setPatternMode = mode => {
  patternMode = mode;
};

export const setViewMode = mode => {
  if (!VALID_VIEW_MODES.has(mode)) {
    return false;
  }

  viewMode = mode;
  return true;
};

export const setFocusedSliceIndex = index => {
  focusedSliceIndex = index;
};
