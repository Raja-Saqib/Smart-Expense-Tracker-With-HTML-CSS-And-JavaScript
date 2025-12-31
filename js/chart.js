import { slices, setSlices, chartTotal, setChartTotal, patternMode } from "./chartState.js";
import { prefersReducedMotion } from "./chartState.js";
import { createPatterns } from "./chartPatterns.js";

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
  getFiltered,
  drawChart,
  index
) => {
  drawChart(getFiltered());

  const slice = slices[index];
  if (!slice) return;

  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, canvas.height / 2);
  ctx.arc(
    canvas.width / 2,
    canvas.height / 2,
    125,
    slice.startAngle,
    slice.endAngle
  );
  ctx.strokeStyle = slice.color;
  ctx.lineWidth = 4;
  ctx.stroke();
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

export const drawChart = ({
  canvas,
  ctx,
  data,
  legendEl,
  getFiltered,
  formatMoney
}) => {
  // Preserve old slices for transitions
  setPreviousSlices(slices);
  
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
  const radius = 120;

  entries.forEach(([category, value], i) => {
    const sliceAngle = (value / totalAmount) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const color = colors[i % colors.length];

    slices.push({
      category,
      value,
      startAngle,
      endAngle,
      color,
      pattern: patterns[i % patterns.length],
    });

    const percent = ((value / totalAmount) * 100).toFixed(1);
    const item = document.createElement("div");
    item.className = "legend-item";
    item.setAttribute("role", "listitem");
    item.setAttribute(
      "aria-label",
      `${category}, ${formatMoney(value)}, ${percent} percent`
    );
    item.setAttribute(
      "aria-selected",
      activeCategory === category ? "true" : "false"
    );
    item.setAttribute(
      "aria-pressed", 
      activeCategory === category ? "true" : "false"
    );

    item.innerHTML = `
      <span class="legend-color" aria-hidden="true"></span>
      <span><strong>${category}</strong>: ${formatMoney(value)} (${percent}%)</span>
    `;

    legendEl.appendChild(item);

    const swatch = item.querySelector(".legend-color");

    swatch.style.backgroundColor = color;

    if (patternMode) {
      swatch.style.backgroundImage =
        "repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 2px, transparent 2px 6px)";
    }

    startAngle = endAngle;
  });

  const innerRadius = chartMode === "donut" ? 70 : 0;

  // Animate unless reduced motion is preferred
  if (!prefersReducedMotion) {
    animateSlices({
      ctx,
      cx,
      cy,
      radius,
      innerRadius,
      slices,
      onComplete: () => {
        ctx.fillStyle = getComputedStyle(document.body)
          .getPropertyValue("--chart-text")
          .trim();
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Total", cx, cy - 10);
        ctx.fillText(formatMoney(totalAmount), cx, cy + 10);
      }
    });
  } else {
      slices.forEach(s => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, s.startAngle, s.endAngle);
        ctx.arc(cx, cy, innerRadius, s.endAngle, s.startAngle, true);
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

    ctx.fillStyle = getComputedStyle(document.body)
      .getPropertyValue("--chart-text")
      .trim();
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Total", cx, cy - 10);
    ctx.fillText(formatMoney(totalAmount), cx, cy + 10);
  }

  legendEl.querySelectorAll(".legend-item").forEach((item, index) => {
    item.tabIndex = 0;

    item.addEventListener("focus", () =>
      highlightSlice(ctx, canvas, getFiltered, () =>
        drawChart({
          canvas,
          ctx,
          data: getFiltered(),
          legendEl,
          getFiltered,
          formatMoney
        }),
        index
      )
    );

    item.addEventListener("blur", () =>
      drawChart({
        canvas,
        ctx,
        data: getFiltered(),
        legendEl,
        getFiltered,
        formatMoney
      })
    );

    item.addEventListener("keydown", e => {
      const items = [...legendEl.querySelectorAll(".legend-item")];

      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusedSliceIndex = (index + 1) % items.length;
        items[focusedSliceIndex].focus();
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusedSliceIndex =
          (index - 1 + items.length) % items.length;
        items[focusedSliceIndex].focus();
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCategoryFilter(slices[index].category);
        chartStatus.textContent =
          `Filtered by ${slices[index].category}`;
        drawChart({
          canvas,
          ctx,
          data: getFiltered(),
          legendEl,
          getFiltered,
          formatMoney
        });
      }
    });

  });

  ctx.fillStyle = getComputedStyle(document.body)
    .getPropertyValue("--chart-text")
    .trim();
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Total", cx, cy - 10);
  ctx.fillText(formatMoney(totalAmount), cx, cy + 10);
};
