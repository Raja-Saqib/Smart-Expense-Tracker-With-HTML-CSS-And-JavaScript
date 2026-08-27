import { getCloudMeta, setCloudMeta } from "../cloud/cloudState.js";
import { highlightChangedSlices } from "./chartAnimations.js";
import { getChangedCategories } from "./chartDiff.js";
import { chartMode, setChartMode, slices } from "./chartState.js";
import { broadcastState } from "./crossTabSync.js";
import { undo, canUndo, canRedo, redo, createUndoState, replaceCurrentUndoState } from "./historyState.js";
import { saveData, transactions, setTransactions } from "./state.js";

let historyOperationInProgress = false;

undoBtn.addEventListener("click", async () => {
  if (historyOperationInProgress) return;
  if (!canUndo()) return;

  historyOperationInProgress = true;

  try {
    const previousSlices = structuredClone(slices);
  
    const prev = undo();
    if (!prev) return;
  
    const currentCloudMeta = structuredClone(getCloudMeta());

    setTransactions(structuredClone(prev.state.transactions));
    setChartMode(prev.state.chartMode);
  
    const result = await saveData({
      transactions,
      cloudMeta: currentCloudMeta,
      chartMode,
      meta: {
        type: "undo"
      }
    });

    replaceCurrentUndoState(
      createUndoState({
        transactions,
        cloudMeta: getCloudMeta(),
        chartMode,
        label: prev.label
      })
    );
  
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
  } finally {
    historyOperationInProgress = false;
  }
});

redoBtn.addEventListener("click", async () => {
  if (historyOperationInProgress) return;
  if (!canRedo()) return;

  historyOperationInProgress = true;

  try {
    const previousSlices = structuredClone(slices);
  
    const next = redo();
    if (!next) return;
  
    const currentCloudMeta = structuredClone(getCloudMeta());

    setTransactions(structuredClone(next.state.transactions));
    setChartMode(next.state.chartMode);
  
    const result = await saveData({
      transactions,
      cloudMeta: currentCloudMeta,
      chartMode,
      meta: {
        type: "redo"
      }
    });

    replaceCurrentUndoState(
      createUndoState({
        transactions,
        cloudMeta: getCloudMeta(),
        chartMode,
        label: next.label
      })
    );
  
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
  } finally {
    historyOperationInProgress = false;
  }
});
