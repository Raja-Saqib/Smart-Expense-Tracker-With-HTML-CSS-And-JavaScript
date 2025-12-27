import { slices, setSlices, chartTotal, setChartTotal } from "./chartState.js";

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

export const drawChart = ({
  canvas,
  ctx,
  data,
  legendEl,
  getFiltered,
  formatMoney
}) => {
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

  let startAngle = 0;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 120;

  entries.forEach(([category, value], i) => {
    const sliceAngle = (value / totalAmount) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const color = colors[i % colors.length];

    const innerRadius = chartMode === "donut" ? 70 : 0;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    slices.push({
      category,
      value,
      startAngle,
      endAngle,
      color
    });

    const percent = ((value / totalAmount) * 100).toFixed(1);
    const item = document.createElement("div");
    item.className = "legend-item";
    item.setAttribute("role", "listitem");
    item.setAttribute(
      "aria-label",
      `${category}, ${formatMoney(value)}, ${percent} percent`
    );

    item.innerHTML = `
      <span class="legend-color" style="background:${color}" aria-hidden="true"></span>
      <span><strong>${category}</strong>: ${formatMoney(value)} (${percent}%)</span>
    `;

    legendEl.appendChild(item);
    startAngle = endAngle;
  });

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
