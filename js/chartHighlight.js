import { CHART_OUTER_RADIUS } from "./chartGeometry.js";

let highlightCanvas = null;
let highlightCtx = null;

const getHighlightCanvas = () => {
  if (
    highlightCanvas &&
    highlightCtx
  ) {
    return {
      canvas: highlightCanvas,
      ctx: highlightCtx
    };
  }

  highlightCanvas =
    document.getElementById(
      "expenseChartHighlight"
    );

  if (!highlightCanvas) {
    return {
      canvas: null,
      ctx: null
    };
  }

  highlightCtx =
    highlightCanvas.getContext("2d");

  return {
    canvas: highlightCanvas,
    ctx: highlightCtx
  };
};

export const clearSliceHighlight = () => {
  const {
    canvas,
    ctx
  } = getHighlightCanvas();

  if (!canvas || !ctx) {
    return;
  }

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
};

export const highlightSlice = (
  _ctx,
  _canvas,
  slice
) => {
  if (!slice) {
    return;
  }

  const {
    canvas,
    ctx
  } = getHighlightCanvas();

  if (!canvas || !ctx) {
    return;
  }

  clearSliceHighlight();

  const cx =
    canvas.width / 2;

  const cy =
    canvas.height / 2;

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    CHART_OUTER_RADIUS + 5,
    slice.startAngle,
    slice.endAngle
  );

  ctx.strokeStyle =
    slice.color;

  ctx.lineWidth = 4;

  ctx.stroke();

  ctx.restore();
};

