import {
  chartMode
} from "./chartState.js";

import {
  toggleCategoryFilter
} from "./state.js";

import {
  getChartHit
} from "./chartHitTest.js";

export const attachChartClick = (
  canvas,
  getSlices,
  init
) => {
  canvas.addEventListener("click", e => {
    const slices = getSlices();

    const hit = getChartHit({
      canvas,
      event: e,
      slices,
      chartMode
    });

    if (!hit) return;

    toggleCategoryFilter(
      hit.slice.category
    );

    init();
  });
};
