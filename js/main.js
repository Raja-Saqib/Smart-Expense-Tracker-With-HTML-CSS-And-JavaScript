import { transactions, setTransactions, saveData, activeCategory, addTransaction, editTransaction, deleteTransaction, setActiveCategory, } from "./state.js";
import { getFiltered } from "./filters.js";
import { formatMoney, showError } from "./utils.js";
import { addTransactionToDOM, renderList, updateSummary, renderCategories, updateUndoUI, applyConflictResolutions } from "./ui.js";
import { drawChart } from "./chart.js";
import { attachChartHover } from "./chartHover.js";
import { attachChartClick } from "./chartClick.js";
import { animateThemeTransition, highlightChangedSlices } from "./chartAnimations.js";
import { chartMode, patternMode, viewMode, slices, prefersReducedMotion, setChartMode, setPatternMode, setViewMode, toggleChartMode, chartTotal } from "./chartState.js";
import { initEvents } from "./events.js";
import { pullFromCloud } from "../cloud/cloudSync.js";
import { animateChartTransition } from "./chartAnimations.js";
import { detectConflicts } from "../cloud/cloudSync.js";
import { showConflictModal } from "./ui.js";
import { pushUndoState, createUndoState, hasHistory, replaceCurrentUndoState, replaceCurrentUndoStateAndClearRedo, jumpToState, getCurrentIndex, commitJumpToState, getHistoryState } from "./historyState.js";
import { listenToBroadcast, isBroadcastAvailable, broadcastState } from "./crossTabSync.js";
import { getChangedCategories } from "./chartDiff.js";
import { getCloudMeta, setCloudMeta } from "../cloud/cloudState.js";
import { deviceId } from "./deviceIdentity.js";
import { initDebugPanel } from "./debugPanel.js";
import { renderHistoryInspector } from "./historyInspector.js";
import { exportToCSV } from "./csvExport.js";
import {
  getNextUndoLabel,
  canRedo
} from "./historyState.js";
import { subscribe } from "./eventBus.js";
import {
  performUndo,
  performRedo
} from "./undoSync.js";

// DOM
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const listEl = document.getElementById("list");
const tableBody = document.getElementById("categoryTable");
const form = document.getElementById("form");
const textEl = document.getElementById("text");
const categoryEl = document.getElementById("category");
const amountEl = document.getElementById("amount");
const monthEl = document.getElementById("month");
const themeBtn = document.getElementById("themeBtn");
const canvas = document.getElementById("expenseChart");
const ctx = canvas.getContext("2d");
const patternToggle = document.getElementById("patternToggle");
const donutToggle = document.getElementById("donutToggle");
const chartStatus = document.getElementById("chartStatus");
const chartView = document.getElementById("chartView");
const tableView = document.getElementById("tableView");
const viewChartRadio = document.getElementById("viewChart");
const viewTableRadio = document.getElementById("viewTable");
const errorEl = document.getElementById("error");
const legendEl = document.getElementById("chartLegend");
const exportBtn = document.getElementById("exportCSV");
const clearFilterBtn = document.getElementById("clearFilter");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

const restoreHistoryState = async target => {
  if (!target?.state) {
    return {
      success: false,
      error: "Invalid history state"
    };
  }

  const {
    transactions: tx,
    chartMode: mode
  } = target.state;

  const previousTransactions =
    structuredClone(transactions);

  const previousChartMode = chartMode;

  const currentCloudMeta =
    structuredClone(getCloudMeta());

  setTransactions(structuredClone(tx));
  setChartMode(mode);

  try {
    const result = await saveData({
      transactions,
      cloudMeta: currentCloudMeta,
      chartMode,
      meta: {
        type: "history-jump"
      }
    });

    if (!result.success) {
      throw new Error(
        result.error ?? "Transaction was not saved"
      );
    }

    init();

    return result;
  } catch (error) {
    setTransactions(previousTransactions);
    setChartMode(previousChartMode);

    return {
      success: false,
      rolledBack: true,
      error: "History state could not be restored",
      cause: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      }
    };
  }
};

const jumpToHistoryState = async index => {
  const currentIndex = getCurrentIndex();

  if (index === currentIndex) {
    return false;
  }

  const target = getHistoryState(index);

  if (!target) {
    return false;
  }

  const result = await restoreHistoryState(target);

  if (!result.success) {
    chartStatus.textContent =
      result.error ??
      "History state could not be restored";

    return false;
  }

  commitJumpToState(index);

  replaceCurrentUndoState(
    createUndoState({
      transactions,
      cloudMeta: getCloudMeta(),
      chartMode,
      label: target.label
    })
  );

  broadcastState({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode
  });

  chartStatus.textContent = result.offline
    ? `Restored locally: ${target.label} (cloud offline)`
    : `Restored: ${target.label}`;

  return true;
};

const getCurrentFiltered = () =>
  getFiltered(
    transactions,
    monthEl,
    activeCategory
);

const getFocusedLegendCategory = () => {
  const activeElement = document.activeElement;

  if (
    !activeElement ||
    !activeElement.classList.contains("legend-item")
  ) {
    return null;
  }

  return activeElement.dataset.category ?? null;
};

const restoreLegendFocus = category => {
  if (!category) return;

  const target = legendEl.querySelector(
    `.legend-item[data-category="${CSS.escape(category)}"]`
  );

  target?.focus({
    preventScroll: true
  });
};

const toggleTheme = () => {
  const focusedLegendCategory =
    getFocusedLegendCategory();

  document.body.classList.toggle("dark");

  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark")
      ? "dark"
      : "light"
  );

  const redraw = () => {
    drawChart({
      canvas,
      ctx,
      data: getCurrentFiltered(),
      legendEl,
      getFiltered: getCurrentFiltered,
      formatMoney
    });

    restoreLegendFocus(
      focusedLegendCategory
    );
  };

  if (!prefersReducedMotion) {
    animateThemeTransition({
      ctx,
      canvas,
      redraw
    });
  } else {
    redraw();
  }
};

const clearFilter = () => {
  monthEl.value = "";
  setActiveCategory(null); 
  init();

  chartStatus.textContent = "Filters cleared";
};

const handleExportCSV = () => {
  exportToCSV(
    getCurrentFiltered(),
    message => showError(errorEl, message)
  );
};

const init = () => {
  const data = getFiltered(transactions, monthEl, activeCategory);
  renderList(listEl, data, addTransactionToDOM);
  updateSummary(balanceEl, incomeEl, expenseEl, data);
  renderCategories(tableBody, data);
  drawChart({
    canvas,
    ctx,
    data,
    legendEl,
    getFiltered: getCurrentFiltered,
    formatMoney
  });
  donutToggle.checked = chartMode === "donut";
  patternToggle.checked = patternMode;

  viewChartRadio.checked = viewMode === "chart";
  viewTableRadio.checked = viewMode === "table";

  chartView.hidden = viewMode !== "chart";
  tableView.hidden = viewMode !== "table";

  renderHistoryInspector(historyList, jumpToHistoryState);
};

const handleAddTransaction = async e => {
  e.preventDefault();

  const result = await addTransaction({
    text: textEl.value,
    category: categoryEl.value,
    amount: amountEl.value,
    chartMode
  });

  if (!result.success) {
    showError(
      errorEl,
      result.error ??
        "Transaction could not be saved"
    );

    chartStatus.textContent =
      "Transaction save failed";

    return;
  }

  if (result.noChanges) {
    form.querySelector("button").textContent =
      "Add Transaction";

    form.reset();

    chartStatus.textContent =
      "No changes detected";

    init();
    return;
  }

  chartStatus.textContent = result.offline
    ? "Saved locally (cloud offline)"
    : "Data synced to cloud";

  form.reset();

  form.querySelector("button").textContent =
    "Add Transaction";

  init();
};

const handleEditTransaction = id => {
  const transaction = editTransaction(id);

  if (!transaction) return;

  textEl.value = transaction.text;
  amountEl.value = transaction.amount;
  categoryEl.value = transaction.category;

  form.querySelector("button").textContent =
    "Update Transaction";
};

const handleDeleteTransaction = async id => {
  const result = await deleteTransaction(id, {
    chartMode
  });

  if (!result.success) {
    showError(
      errorEl,
      result.error ??
        "Transaction could not be saved"
    );

    chartStatus.textContent =
      "Transaction save failed";

    return;
  }

  chartStatus.textContent = result.offline
    ? "Saved locally (cloud offline)"
    : "Data synced to cloud";

  init();
};

const handleUndo = async () => {
  await performUndo({
    init,
    ctx,
    canvas,
    chartStatus
  });
};

const handleRedo = async () => {
  await performRedo({
    init,
    ctx,
    canvas,
    chartStatus
  });
};

const handleKeydown = (e, { undoBtn, redoBtn }) => {
  const ctrlOrCmd = e.ctrlKey || e.metaKey;

  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    return;
  }

  if (ctrlOrCmd && !e.shiftKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undoBtn.click();
    return;
  }

  if (
    (ctrlOrCmd && e.key.toLowerCase() === "y") ||
    (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === "z")
  ) {
    e.preventDefault();
    redoBtn.click();
  }
};

// INITIAL HISTORY STATE
if (!hasHistory()) {
  pushUndoState(
    createUndoState({
      transactions: structuredClone(transactions),
      cloudMeta: structuredClone(getCloudMeta()),
      chartMode,
      label: "Initial state"
    })
  );
}

const refreshUndoUI = () => {
  updateUndoUI(
    undoBtn,
    redoBtn,
    {
      undoLabel: getNextUndoLabel(),
      canRedo: canRedo()
    }
  );
};

subscribe("history:changed", refreshUndoUI);

refreshUndoUI();

initEvents({
  form,
  monthEl,
  clearFilterBtn,
  exportBtn,
  listEl,
  themeBtn,
  undoBtn,
  redoBtn,
  handlers: {
    addTransaction: handleAddTransaction,
    init,
    clearFilter,
    exportCSV: handleExportCSV,
    editTransaction: handleEditTransaction,
    deleteTransaction: handleDeleteTransaction,
    toggleTheme,
    undo: handleUndo,
    redo: handleRedo,
    keydown: handleKeydown
  }
});

// toggleBtn.addEventListener("click", () => {
//   toggleChartMode();
//   init(); 
// });

donutToggle.addEventListener("change", async () => {
  const mode = donutToggle.checked ? "donut" : "pie";

  setChartMode(mode);
  localStorage.setItem("chartMode", mode);

  const result = await saveData({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode,
    meta: {
      type: "chart-mode"
    }
  });

  pushUndoState(
    createUndoState({
      transactions,
      cloudMeta: getCloudMeta(),
      chartMode,
      label: "Undo chart mode"
    })
  );

  broadcastState({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode
  });

  chartStatus.textContent =
    result.offline
      ? mode === "donut"
        ? "Donut chart enabled (cloud offline)"
        : "Pie chart enabled (cloud offline)"
      : mode === "donut"
        ? "Donut chart enabled"
        : "Pie chart enabled";

  init(); // redraw chart
});

patternToggle.addEventListener("change", () => {
  const mode = patternToggle.checked;

  setPatternMode(mode);
  localStorage.setItem("patternMode", mode);

  chartStatus.textContent = mode
    ? "Color-blind patterns enabled"
    : "Color-blind patterns disabled";
    
  init(); // redraw chart + legend
});

const updateViewMode = mode => {
  setViewMode(mode);
  localStorage.setItem("viewMode", mode);

  chartView.hidden = mode !== "chart";
  tableView.hidden = mode !== "table";

  chartStatus.textContent =
    mode === "chart"
      ? "Chart view selected"
      : "Table view selected";
};

const applySnapshot = snapshot => {
  if (!snapshot?.state) {
    throw new Error("Invalid snapshot");
  }

  const {
    transactions: tx,
    cloudMeta,
    chartMode: mode
  } = snapshot.state;

  if (!Array.isArray(tx)) {
    throw new Error("Invalid transactions in snapshot");
  }

  if (!cloudMeta) {
    throw new Error("Invalid cloud metadata in snapshot");
  }

  if (mode !== "pie" && mode !== "donut") {
    throw new Error("Invalid chart mode in snapshot");
  }

  setTransactions(structuredClone(tx));
  setCloudMeta(structuredClone(cloudMeta));
  setChartMode(mode);

  localStorage.setItem(
    "transactions",
    JSON.stringify(transactions)
  );

  localStorage.setItem(
    "chartMode",
    chartMode
  );

  localStorage.setItem(
    "expenseTrackerSyncState",
    JSON.stringify({
      transactions: structuredClone(transactions),
      cloudMeta: structuredClone(getCloudMeta()),
      chartMode
    })
  );

  init();
  refreshUndoUI();
};

viewChartRadio.addEventListener("change", () => {
  if (viewChartRadio.checked) updateViewMode("chart");
});

viewTableRadio.addEventListener("change", () => {
  if (viewTableRadio.checked) updateViewMode("table");
});
/*
resolveConflictsBtn.addEventListener("click", async () => {
  
  const previousSlices = structuredClone(slices);

  // 1. MUTATE
  applyConflictResolutions(conflicts); // updates transactions
  
  // 2. PERSIST
  const result = await saveData({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode,
    meta: {
      type: "merge"
    }
  });

  // 3. SNAPSHOT AFTER PERSISTENCE
  pushUndoState(
    createUndoState({
      transactions,
      cloudMeta: getCloudMeta(),
      chartMode,
      label: "Undo conflict merge"
    })
  );

  // 4. BROADCAST
  broadcastState({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode
  });

  // 5. RENDER ONCE
  init();

  // 6. COMPARE OLD vs NEW CHART STATE
  const changed = getChangedCategories(
    previousSlices,
    slices
  );

  // 7. HIGHLIGHT CHANGED CATEGORIES
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

    chartStatus.textContent =
      result.success
        ? `Conflicts resolved. Updated categories: ${changed.join(", ")}`
        : `Conflicts resolved locally. Cloud offline. Updated categories: ${changed.join(", ")}`;
  } else {
    chartStatus.textContent =
      result.success
        ? "Conflicts resolved with no chart changes"
        : "Conflicts resolved locally (cloud offline)";
  }
});
*/
attachChartHover(canvas, {
  getSlices: () => slices,
  getChartTotal: () => chartTotal,
  getChartMode: () => chartMode
});
attachChartClick(
  canvas,
  () => slices,
  init
);

(async () => {
  let cloudData = null;

  // --------------------------------------------------
  // LOAD PERSISTED CLOUD METADATA
  // --------------------------------------------------
  const cloudMeta = getCloudMeta();

  /*
   * The blobId persisted during the previous successful
   * cloud save identifies the cloud snapshot to restore.
   *
   * First run:
   *   blobId = null
   *
   * Later runs:
   *   blobId = previously created cloud blob
   */
  const currentBlobId =
    cloudMeta?.blobId ?? null;

  // --------------------------------------------------
  // PULL CLOUD SNAPSHOT
  // --------------------------------------------------
  try {
    /*
     * Only attempt a cloud restore when a persisted
     * blobId exists.
     *
     * The blobId is passed directly to pullFromCloud(),
     * which performs:
     *
     *   GET /{blobId}
     */
    if (currentBlobId) {
      cloudData = await pullFromCloud(
        currentBlobId
      );
    }
  } catch (error) {
    console.warn(
      "Cloud startup restore failed:",
      error
    );
  }

  // --------------------------------------------------
  // CLOUD UNAVAILABLE OR NO BLOB
  // --------------------------------------------------
  /*
   * If there is no persisted blobId, this is the first
   * cloud startup and there is nothing to restore.
   *
   * If the cloud request failed or returned no valid
   * snapshot, continue with the existing local state.
   */
  if (!cloudData) {
    init();

    initDebugPanel({
      deviceId,
      getCloudMeta,
      getChartMode: () => chartMode,
      jumpToHistoryState
    });

    return;
  }

  // --------------------------------------------------
  // COMPARE CLOUD VERSION WITH LOCAL VERSION
  // --------------------------------------------------
  const remoteVersion =
    cloudData.version;

  const localCloudMeta =
    structuredClone(getCloudMeta());

  const localVersion =
    Number.isFinite(localCloudMeta?.version)
      ? localCloudMeta.version
      : 0;

  /*
   * The local state is already equal to or newer than
   * the cloud snapshot.
   *
   * Do not replace local state in this case.
   */
  if (remoteVersion <= localVersion) {
    init();

    initDebugPanel({
      deviceId,
      getCloudMeta,
      getChartMode: () => chartMode,
      jumpToHistoryState
    });

    return;
  }

  // --------------------------------------------------
  // SAVE LOCAL STATE BEFORE CLOUD RESTORE
  // --------------------------------------------------
  /*
   * Cloud is newer.
   *
   * Save the current local state BEFORE replacing it.
   * This gives the user an undo point for the cloud
   * restore.
   */
  pushUndoState(
    createUndoState({
      transactions:
        structuredClone(transactions),

      cloudMeta:
        localCloudMeta,

      chartMode,

      label:
        "Before cloud restore"
    })
  );

  const previousTransactions =
    structuredClone(transactions);

  const previousChartMode =
    chartMode;

  // --------------------------------------------------
  // APPLY CLOUD SNAPSHOT
  // --------------------------------------------------
  try {
    /*
     * Build the canonical incoming local snapshot.
     *
     * The cloud payload uses `updatedBy`.
     * Local cloud metadata uses `deviceId`.
     *
     * The current blobId is retained because it identifies
     * the cloud blob being restored.
     */
    const cloudSnapshot = {
      state: {
        transactions:
          structuredClone(
            cloudData.transactions
          ),

        cloudMeta: {
          version:
            remoteVersion,

          updatedAt:
            Number.isFinite(
              cloudData.updatedAt
            )
              ? cloudData.updatedAt
              : 0,

          deviceId:
            cloudData.updatedBy ?? null,

          /*
           * Keep the persisted blobId.
           *
           * blobId identifies the cloud resource and is
           * not part of the cloud payload itself.
           */
          blobId:
            currentBlobId
        },

        chartMode:
          cloudData.chartMode
      }
    };

    /*
     * Apply and persist the incoming cloud snapshot.
     */
    applySnapshot(
      cloudSnapshot
    );

    // --------------------------------------------------
    // RECORD SUCCESSFUL CLOUD RESTORE
    // --------------------------------------------------
    /*
     * The cloud snapshot has now been successfully
     * applied locally.
     */
    pushUndoState(
      createUndoState({
        transactions,
        cloudMeta:
          getCloudMeta(),
        chartMode,
        label:
          "Cloud restore"
      })
    );

    // --------------------------------------------------
    // BROADCAST RESTORED STATE
    // --------------------------------------------------
    /*
     * Notify other tabs only AFTER the cloud snapshot
     * has been successfully applied locally.
     */
    broadcastState({
      transactions,
      cloudMeta:
        getCloudMeta(),
      chartMode
    });

    chartStatus.textContent =
      "Data restored from cloud";

  } catch (error) {

    // --------------------------------------------------
    // ROLLBACK FAILED CLOUD RESTORE
    // --------------------------------------------------
    /*
     * Restore the application state that existed before
     * attempting the cloud restore.
     */
    setTransactions(
      previousTransactions
    );

    setChartMode(
      previousChartMode
    );

    /*
     * Re-persist the previous local state so the failed
     * cloud restore does not leave LocalStorage
     * inconsistent.
     *
     * IMPORTANT:
     * Do not modify cloudMeta here.
     *
     * The existing cloudMeta still contains the persisted
     * blobId that identifies the user's cloud resource.
     */
    localStorage.setItem(
      "transactions",
      JSON.stringify(
        transactions
      )
    );

    localStorage.setItem(
      "chartMode",
      chartMode
    );

    localStorage.setItem(
      "expenseTrackerSyncState",
      JSON.stringify({
        transactions:
          structuredClone(
            transactions
          ),

        cloudMeta:
          structuredClone(
            getCloudMeta()
          ),

        chartMode
      })
    );

    chartStatus.textContent =
      "Cloud restore failed; local data preserved";

    console.error(
      "Cloud startup restore failed:",
      error
    );
  }

  // --------------------------------------------------
  // INITIALIZE DEBUG PANEL
  // --------------------------------------------------
  initDebugPanel({
    deviceId,
    getCloudMeta,
    getChartMode: () => chartMode,
    jumpToHistoryState
  });
})();

listenToBroadcast(payload => {
  if (!payload) return;

  const previousSlices = slices.map(slice => ({
    category: slice.category,
    value: slice.value
  }));

  setTransactions(structuredClone(payload.transactions));
  setCloudMeta(structuredClone(payload.cloudMeta));
  setChartMode(payload.chartMode);

  localStorage.setItem(
    "chartMode",
    chartMode
  );

  localStorage.setItem(
    "expenseTrackerSyncState",
    JSON.stringify({
      transactions: structuredClone(transactions),
      cloudMeta: structuredClone(getCloudMeta()),
      chartMode
    })
  );

  replaceCurrentUndoStateAndClearRedo(
    createUndoState({
      transactions,
      cloudMeta: structuredClone(getCloudMeta()),
      chartMode,
      label: "Cross-tab update"
    })
  );

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

  chartStatus.textContent = "Updated from another tab";
});

window.addEventListener("storage", e => {
  if (isBroadcastAvailable()) return;

  if (e.key !== "expenseTrackerSyncState") return;

  if (!e.newValue) return;

  let persistedState;

  try {
    persistedState = JSON.parse(e.newValue);
  } catch {
    return;
  }

  if (
    !persistedState ||
    !Array.isArray(persistedState.transactions)
  ) {
    return;
  }

  if (
    persistedState.chartMode !== "pie" &&
    persistedState.chartMode !== "donut"
  ) {
    return;
  }

  if (!persistedState.cloudMeta) {
    return;
  }

  const previousSlices = slices.map(slice => ({
    category: slice.category,
    value: slice.value
  }));

  setTransactions(
    structuredClone(persistedState.transactions)
  );

  setCloudMeta(
    structuredClone(persistedState.cloudMeta)
  );

  setChartMode(persistedState.chartMode);

  replaceCurrentUndoStateAndClearRedo(
    createUndoState({
      transactions,
      cloudMeta: structuredClone(getCloudMeta()),
      chartMode,
      label: "Cross-tab update"
    })
  );

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
    "Updated from another tab";
});

