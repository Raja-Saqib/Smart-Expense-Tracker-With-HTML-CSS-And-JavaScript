import { formatMoney } from "./utils.js";

import {
  getChartHit
} from "./chartHitTest.js";

export const attachChartHover = (
  canvas,
  {
    getSlices,
    getChartTotal,
    getChartMode,
    getChartCurrency
  }
) => {
  canvas.addEventListener("mousemove", e => {
    const slices = getSlices();
    const chartTotal = getChartTotal();
    const chartMode = getChartMode();

    canvas.title = "";

    const hit = getChartHit({
      canvas,
      event: e,
      slices,
      chartMode
    });

    if (!hit || chartTotal <= 0) {
      return;
    }

    const { slice } = hit;

    const percent =
      ((slice.value / chartTotal) * 100).toFixed(1);

    const currency =
      getChartCurrency();

    canvas.title =
      `${slice.category}: ${formatMoney(
        slice.value,
        currency
      )} (${percent}%)`;
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.title = "";
  });
};
