import { popUndoState } from "../state/historyState.js";

undoBtn.addEventListener("click", () => {
  const prev = popUndoState();
  if (!prev) return;

  transactions = prev.transactions;
  setCloudMeta(prev.cloudMeta);

  saveLocalTransactions(transactions);
  init();

  // Highlight all slices to show rollback
  highlightChangedSlices({
    ctx,
    cx: canvas.width / 2,
    cy: canvas.height / 2,
    radius: 120,
    innerRadius: chartMode === "donut" ? 70 : 0,
    slices,
    changedCategories: slices.map(s => s.category)
  });

  chartStatus.textContent =
    "Last sync undone";
});
