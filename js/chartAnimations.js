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
