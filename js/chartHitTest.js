// js/chartHitTest.js

export const getChartHit = ({
  canvas,
  event,
  slices,
  chartMode,
  outerRadius = 120,
  donutInnerRadius = 70
}) => {
  if (!slices.length) return null;

  const rect = canvas.getBoundingClientRect();

  const x =
    event.clientX -
    rect.left -
    canvas.width / 2;

  const y =
    event.clientY -
    rect.top -
    canvas.height / 2;

  const distance = Math.sqrt(
    x * x + y * y
  );

  const innerRadius =
    chartMode === "donut"
      ? donutInnerRadius
      : 0;

  // Outside the chart
  if (distance > outerRadius) {
    return null;
  }

  // Inside the donut hole
  if (distance < innerRadius) {
    return null;
  }

  const angle = Math.atan2(y, x);

  const adjustedAngle =
    angle < 0
      ? angle + Math.PI * 2
      : angle;

  const slice = slices.find(
    s =>
      adjustedAngle >= s.startAngle &&
      adjustedAngle <= s.endAngle
  );

  if (!slice) return null;

  return {
    slice,
    index: slices.indexOf(slice),
    distance,
    angle: adjustedAngle
  };
};
