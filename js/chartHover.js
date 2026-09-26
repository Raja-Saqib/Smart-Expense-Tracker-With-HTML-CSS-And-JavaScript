import { formatMoney } from "./utils.js";

import {
  getChartHit
} from "./chartHitTest.js";

import {
  setChartHoverHighlight,
  clearChartHoverHighlight
} from "./chartHighlight.js";

export const attachChartHover = (
  canvas,
  {
    getSlices,
    getChartTotal,
    getChartMode,
    getBaseCurrency
  }
) => {
  let hoveredSliceId = null;

  const clearHover = () => {
    clearChartHoverHighlight();

    hoveredSliceId = null;
  };

  canvas.addEventListener(
    "mousemove",
    event => {
      const slices =
        getSlices();

      const chartTotal =
        getChartTotal();

      const chartMode =
        getChartMode();

      const baseCurrency =
        getBaseCurrency();

      const hit =
        getChartHit({
          canvas,
          event,
          slices,
          chartMode
        });

      if (
        !hit ||
        chartTotal <= 0
      ) {
        canvas.title = "";

        clearHover();

        return;
      }

      const { slice } = hit;

      const sliceId =
        slice.id;

      if (
        hoveredSliceId === sliceId
      ) {
        const percent =
          (
            (slice.value /
              chartTotal) *
            100
          ).toFixed(1);

        canvas.title =
          `${slice.category}: ${formatMoney(
            slice.value,
            baseCurrency
          )} (${percent}%)`;

        return;
      }

      hoveredSliceId =
        sliceId;

      setChartHoverHighlight(
        slice
      );

      const percent =
        (
          (slice.value /
            chartTotal) *
          100
        ).toFixed(1);

      canvas.title =
        `${slice.category}: ${formatMoney(
          slice.value,
          baseCurrency
        )} (${percent}%)`;
    }
  );

  canvas.addEventListener(
    "mouseleave",
    () => {
      canvas.title = "";

      clearHover();
    }
  );
};

