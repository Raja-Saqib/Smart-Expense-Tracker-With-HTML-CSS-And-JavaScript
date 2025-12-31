import { prefersReducedMotion } from "./chartState";

export const animateThemeTransition = ({
  ctx,
  canvas,
  redraw
}) => {
  let alpha = 0;
  const step = () => {
    alpha += 0.08;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = alpha;
    redraw();

    if (alpha < 1) {
      requestAnimationFrame(step);
    } else {
      ctx.globalAlpha = 1;
    }
  };

  requestAnimationFrame(step);
};

export const animateChartTransition = ({ from, to }) => {
  if (prefersReducedMotion) return;

  const duration = 600;
  const start = performance.now();

  const frame = now => {
    const t = Math.min((now - start) / duration, 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    to.forEach(targetSlice => {
      const prev = from.find(
        s => s.category === targetSlice.category
      );

      const startAngle =
        prev?.startAngle ??
        targetSlice.startAngle;

      const endAngle =
        startAngle +
        (targetSlice.endAngle - startAngle) * t;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = targetSlice.color;
      ctx.fill();
    });

    if (t < 1) requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
};
