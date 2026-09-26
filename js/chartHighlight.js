import {
  CHART_OUTER_RADIUS
} from "./chartGeometry.js";

let highlightCanvas = null;
let highlightCtx = null;

let chartHoverSlice = null;
let legendHoverSlice = null;
let keyboardFocusSlice = null;

let legendHoverTimer = null;
let legendFadeFrame = null;
let legendHoveredIndex = null;

let legendHighlightOpacity = 0;

const LEGEND_HOVER_DELAY = 250;
const LEGEND_FADE_DURATION = 180;

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

const getActiveHighlight = () => {
  if (chartHoverSlice) {
    return {
      source: "chart-hover",
      slice: chartHoverSlice,
      opacity: 1
    };
  }

  if (legendHoverSlice) {
    return {
      source: "legend-hover",
      slice: legendHoverSlice,
      opacity:
        legendHighlightOpacity
    };
  }

  if (keyboardFocusSlice) {
    return {
      source: "keyboard-focus",
      slice: keyboardFocusSlice,
      opacity: 1
    };
  }

  return null;
};

const renderActiveHighlight = () => {
  const active =
    getActiveHighlight();

  if (!active) {
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

  ctx.globalAlpha =
    active.opacity;

  ctx.beginPath();

  ctx.arc(
    cx,
    cy,
    CHART_OUTER_RADIUS + 5,
    active.slice.startAngle,
    active.slice.endAngle
  );

  ctx.strokeStyle =
    active.slice.color;

  ctx.lineWidth = 4;

  ctx.stroke();

  ctx.restore();
};

const cancelLegendFade = () => {
  if (legendFadeFrame !== null) {
    cancelAnimationFrame(
      legendFadeFrame
    );

    legendFadeFrame = null;
  }
};

const startLegendFade = slice => {
  cancelLegendFade();

  legendHighlightOpacity = 0;

  const startTime =
    performance.now();

  const animate = currentTime => {
    /*
     * If the legend slice is no longer
     * active, stop this animation.
     */
    if (
      legendHoverSlice !== slice
    ) {
      legendFadeFrame = null;
      return;
    }

    const elapsed =
      currentTime - startTime;

    const progress =
      Math.min(
        elapsed /
          LEGEND_FADE_DURATION,
        1
      );

    legendHighlightOpacity =
      progress;

    renderActiveHighlight();

    if (progress < 1) {
      legendFadeFrame =
        requestAnimationFrame(
          animate
        );
    } else {
      legendFadeFrame = null;
    }
  };

  legendFadeFrame =
    requestAnimationFrame(
      animate
    );
};

/*
 * --------------------------------------------------
 * Chart mouse hover
 * --------------------------------------------------
 */

export const setChartHoverHighlight = slice => {
  chartHoverSlice =
    slice || null;

  renderActiveHighlight();
};

export const clearChartHoverHighlight = () => {
  chartHoverSlice = null;

  renderActiveHighlight();
};

/*
 * --------------------------------------------------
 * Keyboard focus
 * --------------------------------------------------
 */

export const setKeyboardFocusHighlight = slice => {
  keyboardFocusSlice =
    slice || null;

  renderActiveHighlight();
};

export const clearKeyboardFocusHighlight = () => {
  keyboardFocusSlice = null;

  renderActiveHighlight();
};

/*
 * --------------------------------------------------
 * Delayed legend mouse hover
 * --------------------------------------------------
 */

export const scheduleLegendHighlight = (
  index,
  slice
) => {
  if (!slice) {
    return;
  }

  /*
   * Cancel any previous legend timer.
   */
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  /*
   * Cancel an old fade.
   */
  cancelLegendFade();

  /*
   * Remember which legend item is
   * currently being hovered.
   */
  legendHoveredIndex = index;

  /*
   * Remove any previous legend highlight
   * while waiting for the new 250 ms delay.
   */
  legendHoverSlice = null;
  legendHighlightOpacity = 0;

  renderActiveHighlight();

  /*
   * Wait 250 ms before activating the
   * legend highlight.
   */
  legendHoverTimer =
    setTimeout(() => {
      legendHoverTimer = null;

      /*
       * Make sure this timer still belongs
       * to the currently hovered item.
       */
      if (
        legendHoveredIndex !== index
      ) {
        return;
      }

      legendHoverSlice = slice;

      /*
       * Start the fade only AFTER
       * the 250 ms delay.
       */
      startLegendFade(
        slice
      );
    }, LEGEND_HOVER_DELAY);
};

export const clearLegendHighlight = index => {
  /*
   * Cancel the pending 250 ms delay.
   */
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  /*
   * Stop an active fade.
   */
  cancelLegendFade();

  /*
   * Only clear the legend state if
   * this is the item that owns it.
   */
  if (
    legendHoveredIndex !== index
  ) {
    return;
  }

  legendHoveredIndex = null;

  legendHoverSlice = null;

  legendHighlightOpacity = 0;

  /*
   * Re-render the shared highlight state.
   *
   * If keyboard focus is still active,
   * its highlight comes back automatically.
   *
   * If chart hover is active, its highlight
   * remains visible.
   */
  renderActiveHighlight();
};

/*
 * --------------------------------------------------
 * Full reset
 * --------------------------------------------------
 */

export const clearAllHighlights = () => {
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  cancelLegendFade();

  legendHoveredIndex = null;

  chartHoverSlice = null;
  legendHoverSlice = null;
  keyboardFocusSlice = null;

  legendHighlightOpacity = 0;

  clearHighlightCanvas();
};

