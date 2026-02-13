import { undo, canUndo } from "./historyState.js";

undoBtn.addEventListener("click", () => {
  if (!canUndo()) return;

  const previousSlices = structuredClone(slices);

  const prev = undo();
  if (!prev) return;

  transactions = prev.state.transactions;
  setCloudMeta(prev.state.cloudMeta);
  chartMode = prev.state.chartMode;

  saveLocalTransactions(transactions);
  init(); // recalculates slices

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
