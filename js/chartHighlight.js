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

let legendHoverGeneration = 0;

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

const startLegendFade = (
  slice,
  generation
) => {
  cancelLegendFade();

  legendHighlightOpacity = 0;

  const startTime =
    performance.now();

  const animate = currentTime => {
    /*
     * This animation is stale if a newer
     * legend interaction has started.
     */
    if (
      generation !== legendHoverGeneration
    ) {
      legendFadeFrame = null;
      return;
    }

    /*
     * The pointer may have left the
     * legend item while the animation
     * was running.
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
   * Every new legend hover creates a new
   * generation. Any older timer or animation
   * is now automatically stale.
   */
  legendHoverGeneration += 1;

  const generation =
    legendHoverGeneration;

  /*
   * Cancel previous delay.
   */
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  /*
   * Cancel previous fade.
   */
  cancelLegendFade();

  /*
   * Record the newest hovered item.
   */
  legendHoveredIndex = index;

  /*
   * Remove the previous legend hover
   * while waiting for the new delay.
   */
  legendHoverSlice = null;
  legendHighlightOpacity = 0;

  renderActiveHighlight();

  /*
   * Start the 250 ms delay.
   */
  legendHoverTimer =
    setTimeout(() => {
      /*
       * This timer is stale if another
       * legend item was hovered meanwhile.
       */
      if (
        generation !== legendHoverGeneration
      ) {
        return;
      }

      /*
       * Make sure this is still the
       * currently hovered legend item.
       */
      if (
        legendHoveredIndex !== index
      ) {
        return;
      }

      legendHoverTimer = null;

      legendHoverSlice = slice;

      startLegendFade(
        slice,
        generation
      );
    }, LEGEND_HOVER_DELAY);
};

export const clearLegendHighlight = index => {
  /*
   * Invalidate every currently pending
   * legend operation.
   */
  legendHoverGeneration += 1;

  /*
   * Cancel pending 250 ms delay.
   */
  if (legendHoverTimer !== null) {
    clearTimeout(
      legendHoverTimer
    );

    legendHoverTimer = null;
  }

  /*
   * Cancel active fade.
   */
  cancelLegendFade();

  /*
   * Ignore a leave event belonging to
   * an older legend item.
   */
  if (
    legendHoveredIndex !== index
  ) {
    return;
  }

  legendHoveredIndex = null;

  legendHoverSlice = null;

  legendHighlightOpacity = 0;

  renderActiveHighlight();
};

/*
 * --------------------------------------------------
 * Full reset
 * --------------------------------------------------
 */

export const clearAllHighlights = () => {
  /*
   * Invalidate every pending legend timer
   * and animation.
   */
  legendHoverGeneration += 1;

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

