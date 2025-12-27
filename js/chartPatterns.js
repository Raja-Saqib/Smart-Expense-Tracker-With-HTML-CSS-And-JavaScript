export const createPatterns = (ctx) => {
  const patterns = [];

  const makePattern = drawFn => {
    const pCanvas = document.createElement("canvas");
    pCanvas.width = 12;
    pCanvas.height = 12;
    const pCtx = pCanvas.getContext("2d");

    drawFn(pCtx);
    return ctx.createPattern(pCanvas, "repeat");
  };

  // Diagonal stripes
  patterns.push(makePattern(p => {
    p.strokeStyle = "rgba(255,255,255,0.35)";
    p.lineWidth = 2;
    p.beginPath();
    p.moveTo(0, 12);
    p.lineTo(12, 0);
    p.stroke();
  }));

  // Dots
  patterns.push(makePattern(p => {
    p.fillStyle = "rgba(255,255,255,0.35)";
    p.beginPath();
    p.arc(6, 6, 2, 0, Math.PI * 2);
    p.fill();
  }));

  // Vertical lines
  patterns.push(makePattern(p => {
    p.strokeStyle = "rgba(255,255,255,0.35)";
    p.lineWidth = 2;
    p.beginPath();
    p.moveTo(6, 0);
    p.lineTo(6, 12);
    p.stroke();
  }));

  // Cross hatch
  patterns.push(makePattern(p => {
    p.strokeStyle = "rgba(255,255,255,0.35)";
    p.lineWidth = 1;
    p.beginPath();
    p.moveTo(0, 6);
    p.lineTo(12, 6);
    p.moveTo(6, 0);
    p.lineTo(6, 12);
    p.stroke();
  }));

  return patterns;
};
