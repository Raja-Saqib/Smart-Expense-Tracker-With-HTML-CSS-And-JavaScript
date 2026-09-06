import { slices, setSlices, setChartTotal, patternMode, chartMode, setPreviousSlices, setFocusedSliceIndex } from "./chartState.js";
import { prefersReducedMotion } from "./chartState.js";
import { createPatterns } from "./chartPatterns.js";
import { activeCategory, toggleCategoryFilter } from "./state.js";
import {
  CHART_OUTER_RADIUS,
  CHART_DONUT_INNER_RADIUS
} from "./chartGeometry.js";

export const getChartColors = () => {
  const styles = getComputedStyle(document.body);
  return [
    styles.getPropertyValue("--chart-1").trim(),
    styles.getPropertyValue("--chart-2").trim(),
    styles.getPropertyValue("--chart-3").trim(),
    styles.getPropertyValue("--chart-4").trim(),
    styles.getPropertyValue("--chart-5").trim()
  ];
};

export const highlightSlice = (
  ctx,
  canvas,
  index
) => {
  const slice = slices[index];

  if (!slice) return;

  ctx.save();

  ctx.beginPath();
  ctx.arc(
    canvas.width / 2,
    canvas.height / 2,
    CHART_OUTER_RADIUS + 5,
    slice.startAngle,
    slice.endAngle
  );

  ctx.strokeStyle = slice.color;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
};

const drawSlices = ({
  ctx,
  cx,
  cy,
  radius,
  innerRadius,
  slices,
  patternMode
}) => {
  slices.forEach(s => {
    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      radius,
      s.startAngle,
      s.endAngle
    );

    ctx.arc(
      cx,
      cy,
      innerRadius,
      s.endAngle,
      s.startAngle,
      true
    );

    ctx.closePath();

    ctx.fillStyle = s.color;
    ctx.fill();

    if (patternMode) {
      ctx.fillStyle = s.pattern;
      ctx.fill();
    }
  });
};

const animateSlices = ({
  ctx,
  cx,
  cy,
  radius,
  innerRadius,
  slices,
  duration = 600,
  onComplete
}) => {
  const start = performance.now();

  const frame = now => {
    const progress = Math.min((now - start) / duration, 1);
    ctx.clearRect(0, 0, cx * 2, cy * 2);

    slices.forEach(s => {
      const animatedEnd =
        s.startAngle + (s.endAngle - s.startAngle) * progress;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, s.startAngle, animatedEnd);
      ctx.arc(cx, cy, innerRadius, animatedEnd, s.startAngle, true);
      ctx.closePath();
      
      // Base color
      ctx.fillStyle = s.color;
      ctx.fill();

      // Pattern overlay
      if (patternMode) {
        ctx.fillStyle = s.pattern;
        ctx.fill();
      }

    });

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else if (onComplete) {
      onComplete();
    }
  };

  requestAnimationFrame(frame);
};

const redrawCanvas = ({
  ctx,
  canvas,
  patternMode,
  chartMode,
  slices,
  formatMoney
}) => {
  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (!slices.length) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = CHART_OUTER_RADIUS;

  const innerRadius =
    chartMode === "donut"
      ? CHART_DONUT_INNER_RADIUS
      : 0;

  drawSlices({
    ctx,
    cx,
    cy,
    radius,
    innerRadius,
    slices,
    patternMode
  });

  const totalAmount = slices.reduce(
    (total, slice) => total + slice.value,
    0
  );

  ctx.fillStyle = getComputedStyle(document.body)
    .getPropertyValue("--chart-text")
    .trim();

  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("Total", cx, cy - 10);
  ctx.fillText(formatMoney(totalAmount), cx, cy + 10);
};

export const drawChart = ({
  canvas,
  ctx,
  data,
  legendEl,
  getFiltered,
  formatMoney,
}) => {
  // Preserve old slices for transitions
  // const previous = structuredClone(slices);
  const previous = slices.map(s => ({
    id: s.id,
    category: s.category,
    value: s.value,
    startAngle: s.startAngle,
    endAngle: s.endAngle,
    color: s.color
  }));
  setPreviousSlices(previous);
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legendEl.innerHTML = "";
  setSlices([]);
  legendEl.setAttribute("role", "list");

  const totals = {};
  data.filter(t => t.amount < 0).forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });

  const entries = Object.entries(totals);
  if (!entries.length) return;

  const totalAmount = entries.reduce((a, [, v]) => a + v, 0);
  setChartTotal(totalAmount);

  const colors = getChartColors();
  const patterns = createPatterns(ctx);

  let startAngle = 0;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = CHART_OUTER_RADIUS;
    
  const drawTotal = () => {
    ctx.fillStyle = getComputedStyle(document.body)
      .getPropertyValue("--chart-text")
      .trim();

    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText("Total", cx, cy - 10);
    ctx.fillText(formatMoney(totalAmount), cx, cy + 10);
  };

  entries.forEach(([category, value], i) => {
    const sliceAngle =
      (value / totalAmount) * Math.PI * 2;

    const endAngle =
      startAngle + sliceAngle;

    const color =
      colors[i % colors.length];

    slices.push({
      id: category,
      category,
      value,
      startAngle,
      endAngle,
      color,
      pattern:
        patterns[i % patterns.length],
    });

    const percent =
      ((value / totalAmount) * 100).toFixed(1);

    const item =
      document.createElement("button");

    item.type = "button";
    item.className = "legend-item";
    item.dataset.category = category;

    item.setAttribute(
      "aria-label",
      `${category}, ${formatMoney(value)}, ${percent} percent`
    );

    item.setAttribute(
      "aria-pressed",
      activeCategory === category
        ? "true"
        : "false"
    );

    item.innerHTML = `
      <span
        class="legend-color"
        aria-hidden="true"
      ></span>

      <span>
        <strong>${category}</strong>:
        ${formatMoney(value)}
        (${percent}%)
      </span>
    `;

    legendEl.appendChild(item);

    const swatch =
      item.querySelector(".legend-color");

    swatch.style.backgroundColor = color;

    if (patternMode) {
      swatch.style.backgroundImage =
        "repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 2px, transparent 2px 6px)";
    }

    startAngle = endAngle;
  });

  const innerRadius =
    chartMode === "donut"
      ? CHART_DONUT_INNER_RADIUS
      : 0;

  // Animate unless reduced motion is preferred
  if (!prefersReducedMotion) {
    animateSlices({
      ctx,
      cx,
      cy,
      radius,
      innerRadius,
      slices,
      onComplete: drawTotal,
    });
  } else {
      drawSlices({
        ctx,
        cx,
        cy,
        radius,
        innerRadius,
        slices,
        patternMode
      });

      drawTotal();
  }

  legendEl.querySelectorAll(".legend-item").forEach(
    (item, index) => {
      item.addEventListener("focus", () => {
        highlightSlice(
          ctx,
          canvas,
          index
        );
      });

      item.addEventListener("blur", () => {
        redrawCanvas({
          ctx,
          canvas,
          patternMode,
          chartMode,
          slices,
          formatMoney
        });
      });

      item.addEventListener("click", () => {
        toggleCategoryFilter(
          slices[index].category
        );

        drawChart({
          canvas,
          ctx,
          data: getFiltered(),
          legendEl,
          getFiltered,
          formatMoney
        });
      });

      item.addEventListener("keydown", e => {
        const items = [
          ...legendEl.querySelectorAll(".legend-item")
        ];

        if (!items.length) return;

        if (
          e.key === "ArrowRight" ||
          e.key === "ArrowDown"
        ) {
          e.preventDefault();

          const nextIndex =
            (index + 1) % items.length;

          setFocusedSliceIndex(nextIndex);
          items[nextIndex].focus();

          return;
        }

        if (
          e.key === "ArrowLeft" ||
          e.key === "ArrowUp"
        ) {
          e.preventDefault();

          const previousIndex =
            (index - 1 + items.length) %
            items.length;

          setFocusedSliceIndex(previousIndex);
          items[previousIndex].focus();
        }
      });
    }
  );

  
};
