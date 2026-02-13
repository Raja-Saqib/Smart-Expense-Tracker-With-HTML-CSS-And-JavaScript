import { undo } from "./historyState.js";

undoBtn.addEventListener("click", () => {
  const prev = undo();
  if (!prev) return;

  // Capture current slices BEFORE restoring
  const previousSlices = structuredClone(slices);

  transactions = prev.data.transactions;
  setCloudMeta(prev.data.cloudMeta);
  chartMode = prev.chart.chartMode;

  saveLocalTransactions(transactions);
  init(); // re-renders + recalculates slices

  const changed = getChangedCategories(
    previousSlices,
    slices
  );

  // Highlight all slices to show rollback
  if (changed.length) {
    highlightChangedSlices({
      ctx,
      cx: canvas.width / 2,
      cy: canvas.height / 2,
      radius: 120,
      innerRadius: chartMode === "donut" ? 70 : 0,
      slices,
      changedCategories: changed
    });
  }

  chartStatus.textContent =
    prev.label || "Last action undone";
});
