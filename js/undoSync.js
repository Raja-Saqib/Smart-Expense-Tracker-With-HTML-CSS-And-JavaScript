import { getCloudMeta, setCloudMeta } from "../cloud/cloudState.js";
import { highlightChangedSlices } from "./chartAnimations.js";
import { getChangedCategories } from "./chartDiff.js";
import { chartMode, setChartMode, slices } from "./chartState.js";
import { broadcastState } from "./crossTabSync.js";
import { undo, canUndo, canRedo, redo } from "./historyState.js";
import { saveData, transactions, setTransactions } from "./state.js";

undoBtn.addEventListener("click", async () => {
  if (!canUndo()) return;

  const previousSlices = structuredClone(slices);

  const prev = undo();
  if (!prev) return;

  setTransactions(prev.state.transactions);
  setCloudMeta(prev.state.cloudMeta);
  setChartMode(prev.state.chartMode);

  const result = await saveData({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode,
    meta: {
      type: "undo"
    }
  });

  broadcastState({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode
  });

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
    result.success
      ? prev.label || "Last action undone"
      : "Undo applied (cloud offline)";
});

redoBtn.addEventListener("click", async () => {
  if (!canRedo()) return;

  const previousSlices = structuredClone(slices);

  const next = redo();
  if (!next) return;

  setTransactions(next.state.transactions);
  setCloudMeta(next.state.cloudMeta);
  setChartMode(next.state.chartMode);

  const result = await saveData({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode,
    meta: {
      type: "redo"
    }
  });

  broadcastState({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode
  });

  init();

  const changed = getChangedCategories(
    previousSlices,
    slices
  );

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
    result.success
      ? next.label || "Action redone"
      : "Redo applied (cloud offline)";    
});
