import { getCloudMeta } from "../cloud/cloudState.js";
import { highlightChangedSlices } from "./chartAnimations.js";
import { getChangedCategories } from "./chartDiff.js";
import {
  chartMode,
  setChartMode,
  slices
} from "./chartState.js";
import { broadcastState } from "./crossTabSync.js";
import {
  undo,
  canUndo,
  canRedo,
  redo,
  createUndoState,
  replaceCurrentUndoState,
  rollbackRedo,
  rollbackUndo
} from "./historyState.js";
import {
  saveData,
  transactions,
  setTransactions
} from "./state.js";

let historyOperationInProgress = false;

const getSerializableSlices = () =>
  slices.map(slice => ({
    category: slice.category,
    value: slice.value
  }));

export const performUndo = async ({
  init,
  ctx,
  canvas,
  chartStatus
}) => {
  if (historyOperationInProgress) return;
  if (!canUndo()) return;

  historyOperationInProgress = true;

  try {
    const previousSlices = getSerializableSlices();

    const previousTransactions =
      structuredClone(transactions);

    const previousChartMode = chartMode;

    const prev = undo();

    if (!prev) return;

    const currentCloudMeta =
      structuredClone(getCloudMeta());

    const targetTransactions =
      structuredClone(prev.state.transactions);

    setTransactions(targetTransactions);

    setChartMode(prev.state.chartMode);

    try {
      const result = await saveData({
        transactions,
        cloudMeta: currentCloudMeta,
        chartMode,
        meta: {
          type: "undo"
        }
      });

      if (!result.success) {
        throw new Error(
          result.error ?? "Transaction was not saved"
        );
      }
  
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
          innerRadius:
            chartMode === "donut" ? 70 : 0,
          slices,
          changedCategories: changed
        });
      }
  
      chartStatus.textContent = result.offline
        ? `${prev.label || "Last action undone"} (cloud offline)`
        : prev.label || "Last action undone";
    } catch (error) {
      setTransactions(previousTransactions);
      setChartMode(previousChartMode);

      const rolledBack = rollbackUndo(prev);

      if (!rolledBack) {
        console.error(
          "Undo persistence failed and history rollback could not be completed."
        );
      }

      chartStatus.textContent =
        "Undo failed: transaction was not saved";
    }
  } finally {
    historyOperationInProgress = false;
  }
};

export const performRedo = async ({
  init,
  ctx,
  canvas,
  chartStatus
}) => {
  if (historyOperationInProgress) return;
  if (!canRedo()) return;

  historyOperationInProgress = true;

  try {
    const previousSlices = getSerializableSlices();

    const previousTransactions =
      structuredClone(transactions);

    const previousChartMode = chartMode;

    const next = redo();

    if (!next) return;

    const currentCloudMeta =
      structuredClone(getCloudMeta());

    const targetTransactions =
      structuredClone(next.state.transactions);

    setTransactions(targetTransactions);

    setChartMode(next.state.chartMode);

    try {
      const result = await saveData({
        transactions,
        cloudMeta: currentCloudMeta,
        chartMode,
        meta: {
          type: "redo"
        }
      });

      if (!result.success) {
        throw new Error(
          result.error ?? "Transaction was not saved"
        );
      }
  
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
          innerRadius:
            chartMode === "donut" ? 70 : 0,
          slices,
          changedCategories: changed
        });
      }
  
      chartStatus.textContent = result.offline
        ? `${next.label || "Action redone"} (cloud offline)`
        : next.label || "Action redone";
    } catch (error) {
      setTransactions(previousTransactions);
      setChartMode(previousChartMode);

      const rolledBack = rollbackRedo(next);

      if (!rolledBack) {
        console.error(
          "Redo persistence failed and history rollback could not be completed."
        );
      }

      chartStatus.textContent =
        "Redo failed: transaction was not saved";
    }
  } finally {
    historyOperationInProgress = false;
  }
};
