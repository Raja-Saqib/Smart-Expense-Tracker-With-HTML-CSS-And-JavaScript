// js/chartHitTest.js

import {
  CHART_OUTER_RADIUS,
  CHART_DONUT_INNER_RADIUS
} from "./chartGeometry.js";

export const getChartHit = ({
  canvas,
  event,
  slices,
  chartMode
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
      ? CHART_DONUT_INNER_RADIUS
      : 0;

  if (distance > CHART_OUTER_RADIUS) {
    return null;
  }

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
