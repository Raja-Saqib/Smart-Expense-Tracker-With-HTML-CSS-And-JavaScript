import {
  CHART_OUTER_RADIUS
} from "./chartGeometry.js";

let highlightCanvas = null;
let highlightCtx = null;

let chartHoverSlice = null;
let legendHoverSlice = null;
let keyboardFocusSlice = null;

let legendHoverTimer = null;
let legendHoveredIndex = null;

const LEGEND_HOVER_DELAY = 250;

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

const clearHighlightCanvas = () => {
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

const getActiveSlice = () => {
  if (chartHoverSlice) {
    return chartHoverSlice;
  }

  if (legendHoverSlice) {
    return legendHoverSlice;
  }

  if (keyboardFocusSlice) {
    return keyboardFocusSlice;
  }

  return null;
};

const renderActiveHighlight = () => {
  const slice =
    getActiveSlice();

  if (!slice) {
    clearHighlightCanvas();
    return;
  }

  const {
    canvas,
    ctx
  } = getHighlightCanvas();

  if (!canvas || !ctx) {
    return;
  }

  clearHighlightCanvas();

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

export const setChartHoverHighlight = slice => {
  chartHoverSlice = slice || null;

  renderActiveHighlight();
};

export const clearChartHoverHighlight = () => {
  chartHoverSlice = null;

  renderActiveHighlight();
};

export const setKeyboardFocusHighlight = slice => {
  keyboardFocusSlice =
    slice || null;

  renderActiveHighlight();
};

export const clearKeyboardFocusHighlight = () => {
  keyboardFocusSlice = null;

  renderActiveHighlight();
};

export const scheduleLegendHighlight = (
  index,
  slice
) => {
  if (!slice) {
    return;
  }

  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );
  }

  legendHoveredIndex = index;

  legendHoverTimer =
    setTimeout(() => {
      legendHoverSlice = slice;

      legendHoverTimer = null;

      renderActiveHighlight();
    }, LEGEND_HOVER_DELAY);
};

export const clearLegendHighlight = index => {
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  if (
    legendHoveredIndex === index
  ) {
    legendHoveredIndex = null;
    legendHoverSlice = null;

    renderActiveHighlight();
  }
};

export const clearAllHighlights = () => {
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  legendHoveredIndex = null;

  chartHoverSlice = null;
  legendHoverSlice = null;
  keyboardFocusSlice = null;

  clearHighlightCanvas();
};

