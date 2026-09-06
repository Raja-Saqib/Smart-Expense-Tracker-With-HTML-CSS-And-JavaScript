import {
  chartMode
} from "./chartState.js";

import {
  toggleCategoryFilter
} from "./state.js";

export const attachChartClick = (
  canvas,
  getSlices,
  init
) => {
  canvas.addEventListener("click", e => {
    const slices = getSlices();

    if (!slices.length) return;

    const rect = canvas.getBoundingClientRect();

    const x =
      e.clientX -
      rect.left -
      canvas.width / 2;

    const y =
      e.clientY -
      rect.top -
      canvas.height / 2;

    const angle = Math.atan2(y, x);

    const adjusted =
      angle < 0
        ? angle + Math.PI * 2
        : angle;

    const distance =
      Math.sqrt(x * x + y * y);

    const outer = 120;

    const inner =
      chartMode === "donut"
        ? 70
        : 0;

    // Outside the chart
    if (distance > outer) return;

    // Inside the donut hole
    if (distance < inner) return;

    const slice = slices.find(
      s =>
        adjusted >= s.startAngle &&
        adjusted <= s.endAngle
    );

    if (!slice) return;

    toggleCategoryFilter(slice.category);

    init();
  });
};
