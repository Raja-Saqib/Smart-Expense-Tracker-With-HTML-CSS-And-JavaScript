import { CHART_OUTER_RADIUS } from "./chartGeometry.js";

const drawHighlightArc = (
  ctx,
  canvas,
  slice
) => {
  if (!slice) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    CHART_OUTER_RADIUS + 5,
    slice.startAngle,
    slice.endAngle
  );

  ctx.lineWidth = 4;
};

export const highlightSlice = (
  ctx,
  canvas,
  slice
) => {
  if (!slice) return;

  ctx.save();

  drawHighlightArc(
    ctx,
    canvas,
    slice
  );

  ctx.strokeStyle = slice.color;
  ctx.stroke();

  ctx.restore();
};

export const clearSliceHighlight = (
  ctx,
  canvas,
  slice
) => {
  if (!slice) return;

  ctx.save();

  drawHighlightArc(
    ctx,
    canvas,
    slice
  );

  /*
   * Remove only the highlight stroke.
   * The actual chart is inside CHART_OUTER_RADIUS,
   * while the highlight is outside it.
   */
  ctx.globalCompositeOperation =
    "destination-out";

  ctx.stroke();

  ctx.restore();
};

