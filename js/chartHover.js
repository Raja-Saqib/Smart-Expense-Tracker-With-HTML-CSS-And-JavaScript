import { formatMoney } from "./utils.js";

export const attachChartHover = (
  canvas,
  {
    getSlices,
    getChartTotal,
    getChartMode
  }
) => {
  canvas.addEventListener("mousemove", e => {
    const slices = getSlices();
    const chartTotal = getChartTotal();
    const chartMode = getChartMode();

    const rect =
      canvas.getBoundingClientRect();

    const x =
      e.clientX -
      rect.left -
      canvas.width / 2;

    const y =
      e.clientY -
      rect.top -
      canvas.height / 2;

    const angle = Math.atan2(y, x);

    const adjustedAngle =
      angle < 0
        ? angle + Math.PI * 2
        : angle;

    const distance =
      Math.sqrt(x * x + y * y);

    canvas.title = "";

    const outer = 120;

    const inner =
      chartMode === "donut"
        ? 70
        : 0;

    if (
      distance > outer ||
      distance < inner
    ) {
      return;
    }

    const slice = slices.find(
      s =>
        adjustedAngle >= s.startAngle &&
        adjustedAngle <= s.endAngle
    );

    if (!slice || chartTotal <= 0) {
      return;
    }

    const percent =
      ((slice.value / chartTotal) * 100).toFixed(1);

    canvas.title =
      `${slice.category}: ${formatMoney(
        slice.value
      )} (${percent}%)`;
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.title = "";
  });
};
