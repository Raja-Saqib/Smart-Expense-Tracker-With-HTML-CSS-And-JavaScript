import {
  CHART_OUTER_RADIUS
} from "./chartGeometry.js";

let highlightCanvas = null;
let highlightCtx = null;

let activeHighlight = null;

const LEGEND_HOVER_DELAY = 250;

let legendHoverTimer = null;
let legendHoveredIndex = null;

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

const drawHighlight = slice => {
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

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

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

const renderActiveHighlight = () => {
  if (!activeHighlight) {
    const {
      canvas,
      ctx
    } = getHighlightCanvas();

    if (canvas && ctx) {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    return;
  }

  drawHighlight(
    activeHighlight.slice
  );
};

/**
 * Set the interaction that currently owns
 * the chart highlight.
 *
 * source:
 * - "chart-hover"
 * - "legend-hover"
 * - "keyboard-focus"
 */
export const setHighlight = (
  source,
  slice
) => {
  if (!slice) {
    return;
  }

  activeHighlight = {
    source,
    slice
  };

  renderActiveHighlight();
};

/**
 * Clear the highlight only when the caller
 * still owns the active highlight.
 */
export const clearHighlight = source => {
  if (
    !activeHighlight ||
    activeHighlight.source !== source
  ) {
    return;
  }

  activeHighlight = null;

  renderActiveHighlight();
};

/**
 * Clear the highlight regardless of owner.
 * Useful when the chart is redrawn/reset.
 */
export const clearAllHighlights = () => {
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  legendHoveredIndex = null;
  activeHighlight = null;

  renderActiveHighlight();
};

/**
 * Start delayed legend hover.
 */
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
      setHighlight(
        "legend-hover",
        slice
      );

      legendHoverTimer = null;
    }, LEGEND_HOVER_DELAY);
};

/**
 * Cancel delayed legend hover and remove
 * the legend's highlight if it owns it.
 */
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

    clearHighlight(
      "legend-hover"
    );
  }
};

/**
 * Returns the currently active highlight.
 * Mostly useful for debugging or future interaction logic.
 */
export const getActiveHighlight = () =>
  activeHighlight;


