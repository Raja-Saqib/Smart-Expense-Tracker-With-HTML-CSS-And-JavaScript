export let slices = [];
export let chartTotal = 0;
export let chartMode = "pie";
export let patternMode = true;

export const setSlices = data => (slices = data);
export const setChartTotal = val => (chartTotal = val);
export const toggleChartMode = () =>
  (chartMode = chartMode === "pie" ? "donut" : "pie");
export const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
