export let slices = [];
export let previousSlices = [];
export let chartTotal = 0;
export let chartMode =
  localStorage.getItem("chartMode") || "donut";
export let patternMode =
  localStorage.getItem("patternMode") !== "false";
export let viewMode =
  localStorage.getItem("viewMode") || "chart";
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
