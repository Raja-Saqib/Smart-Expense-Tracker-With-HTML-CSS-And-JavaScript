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

const mapSlicesById = slices =>
  Object.fromEntries(slices.map(s => [s.id, s]));

export const animateChartTransition = ({
  ctx,
  cx,
  cy,
  radius,
  innerRadius,
  from,
  to,
  duration = 500
}) => {
  if (prefersReducedMotion) return;

  const fromMap = mapSlicesById(from);
  const toMap = mapSlicesById(to);

  const allIds = new Set([
    ...Object.keys(fromMap),
    ...Object.keys(toMap)
  ]);

  const start = performance.now();

  const frame = now => {
    const progress = Math.min((now - start) / duration, 1);
    ctx.clearRect(0, 0, cx * 2, cy * 2);

    allIds.forEach(id => {
      const a = fromMap[id];
      const b = toMap[id];

      if (!b) return; // slice removed → fade-out optional

      const startAngle =
        a
          ? a.startAngle +
            (b.startAngle - a.startAngle) * progress
          : b.startAngle;

      const endAngle =
        a
          ? a.endAngle +
            (b.endAngle - a.endAngle) * progress
          : b.startAngle +
            (b.endAngle - b.startAngle) * progress;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.arc(
        cx,
        cy,
        innerRadius,
        endAngle,
        startAngle,
        true
      );
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.fill();
    });

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
};
