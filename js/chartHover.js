import { formatMoney } from "./utils.js";

import {
  getChartHit
} from "./chartHitTest.js";

import {
  setHighlight,
  clearHighlight
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
  let hoveredSlice = null;

  const clearHover = () => {
    clearHighlight(
      "chart-hover"
    );

    hoveredSlice = null;
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

      /*
       * Mouse is not over a slice.
       */
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

      /*
       * Still hovering the same slice.
       *
       * Do nothing.
       *
       * This is important because mousemove fires
       * many times while the pointer is moving.
       */
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

      /*
       * Moving from one slice to another.
       */
      clearHover();

      hoveredSliceId =
        sliceId;

      hoveredSlice =
        slice;

      setHighlight(
        "chart-hover",
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

