import { transactions, setTransactions, saveData, activeCategory, addTransaction, editTransaction, deleteTransaction } from "./state.js";
import { getFiltered } from "./filters.js";
import { formatMoney } from "./utils.js";
import { addTransactionToDOM, renderList, updateSummary, renderCategories, updateUndoUI, applyConflictResolutions } from "./ui.js";
import { drawChart } from "./chart.js";
import { attachChartHover } from "./chartHover.js";
import { attachChartClick } from "./chartClick.js";
import { animateThemeTransition, highlightChangedSlices } from "./chartAnimations.js";
import { chartMode, patternMode, viewMode, slices, prefersReducedMotion, setChartMode, setPatternMode, setViewMode, toggleChartMode } from "./chartState.js";
import { initEvents } from "./events.js";
import { pullFromCloud } from "../cloud/cloudSync.js";
import { animateChartTransition } from "./chartAnimations.js";
import { detectConflicts } from "../cloud/cloudSync.js";
import { showConflictModal } from "./ui.js";
import { pushUndoState, createUndoState, hasHistory, replaceCurrentUndoState, replaceCurrentUndoStateAndClearRedo, jumpToState, getCurrentIndex } from "./historyState.js";
import { listenToBroadcast, isBroadcastAvailable } from "./crossTabSync.js";
import { getChangedCategories } from "./chartDiff.js";
import { getCloudMeta, setCloudMeta } from "../cloud/cloudState.js";
import { initDebugPanel } from "./debugPanel.js";
import { renderHistoryInspector } from "./historyInspector.js";

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
const legendEl = document.getElementById("chartLegend");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");

const restoreHistoryState = async target => {
  if (!target?.state) return false;

  const {
    transactions: tx,
    cloudMeta,
    chartMode: mode
  } = target.state;

  const currentCloudMeta = structuredClone(getCloudMeta());

  setTransactions(structuredClone(tx));
  setChartMode(mode);

  const result = await saveData({
    transactions,
    cloudMeta: currentCloudMeta,
    chartMode,
    meta: {
      type: "history-jump"
    }
  });

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

  init();

  return result.success;
};

const jumpToHistoryState = async index => {
  const currentIndex = getCurrentIndex();

  if (index === currentIndex) return false;

  const target = jumpToState(index);

  if (!target) return false;

  const success = await restoreHistoryState(target);

  chartStatus.textContent = success
    ? `Restored: ${target.label}`
    : `Restored locally: ${target.label} (cloud offline)`;

  return success;
};

const toggleTheme = () => {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );

  if (!prefersReducedMotion) {
    animateThemeTransition({
      ctx,
      canvas,
      redraw: () =>
        drawChart({
          canvas,
          ctx,
          data: getFiltered(
            transactions,
            monthEl,
            activeCategory
          ),
          legendEl,
          getFiltered,
          formatMoney
        })
    });
  } else {
    init();
  }
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
    getFiltered,
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
    text: textEl.value.trim(),
    category: categoryEl.value,
    amount: amountEl.value,
    deviceId,
    chartMode
  });

  if (!result.success && result.error) {
    chartStatus.textContent = result.error;
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

  if (!result.success && result.error) {
    chartStatus.textContent = result.error;
    return;
  }

  chartStatus.textContent = result.offline
    ? "Saved locally (cloud offline)"
    : "Data synced to cloud";

  init();
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

init();

initEvents({
  form,
  monthEl,
  listEl,
  themeBtn,
  handlers: {
    init,
    toggleTheme,
    addTransaction: handleAddTransaction,
    editTransaction: handleEditTransaction,
    deleteTransaction: handleDeleteTransaction
  }
});

toggleBtn.addEventListener("click", () => {
  toggleChartMode();
  init(); 
});

donutToggle.addEventListener("change", () => {
  const mode = donutToggle.checked ? "donut" : "pie";

  setChartMode(mode);
  localStorage.setItem("chartMode", mode);

  chartStatus.textContent =
    mode === "donut"
      ? "Donut chart enabled"
      : "Pie chart enabled";

  init(); // redraw chart
});

patternToggle.addEventListener("change", () => {
  setPatternMode(patternToggle.checked);
  localStorage.setItem("patternMode", patternMode);
  chartStatus.textContent = patternMode
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
  if (!snapshot?.state) return;

  const { transactions: tx, cloudMeta, chartMode: mode } = snapshot.state;

  // Apply state
  setTransactions(structuredClone(tx));
  setCloudMeta(structuredClone(cloudMeta));
  setChartMode(mode);

  // Persist locally (optional but recommended for consistency)
  localStorage.setItem("transactions", JSON.stringify(transactions));

  // Re-render UI
  init();

  // Update undo/redo buttons
  updateUndoUI();
};

viewChartRadio.addEventListener("change", () => {
  if (viewChartRadio.checked) updateViewMode("chart");
});

viewTableRadio.addEventListener("change", () => {
  if (viewTableRadio.checked) updateViewMode("table");
});

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

attachChartHover(canvas, {
  getSlices: () => slices,
  getChartTotal: () => chartTotal,
  getChartMode: () => chartMode
});
attachChartClick(
  canvas,
  () => slices,
  getFiltered,
  init
);

(async () => {
  const cloudData = await pullFromCloud(); 
  
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
  
  const remoteVersion = cloudData.version ?? 0; 
  const localVersion = getCloudMeta()?.version ?? 0; 
  
  if (remoteVersion > localVersion) { 
 
    // Capture local state before it is replaced 
    const localStateBeforeCloudRestore = createUndoState({ 
      transactions: structuredClone(transactions), 
      cloudMeta: structuredClone(getCloudMeta()), 
      chartMode, 
      label: "Before cloud restore" 
    }); 
 
    // Record the state being replaced 
    pushUndoState(localStateBeforeCloudRestore); 
 
    // Apply full remote snapshot 
    applySnapshot({ 
      state: { 
        transactions: cloudData.transactions, 
        cloudMeta: { 
          version: cloudData.version, 
          updatedAt: cloudData.updatedAt, 
          deviceId: cloudData.deviceId 
        }, 
        chartMode: cloudData.chartMode 
      } 
    }); 
 
    // Record the newly restored cloud state 
    pushUndoState( 
      createUndoState({ 
        transactions, 
        cloudMeta: getCloudMeta(), 
        chartMode, 
        label: "Cloud restore" 
      }) 
    ); 
 
    chartStatus.textContent = "Cloud state restored"; 
  } else { 
    // No cloud restore occurred, so perform the normal initial render. 
    init(); 
    updateUndoUI(); 
  } 
  
  initDebugPanel({ 
    deviceId, 
    getCloudMeta, 
    getChartMode: () => chartMode, 
    jumpToHistoryState 
  });
})();

listenToBroadcast(payload => {
  if (!payload) return;

  const previousSlices = structuredClone(slices);

  setTransactions(structuredClone(payload.transactions));
  setCloudMeta(structuredClone(payload.cloudMeta));
  setChartMode(payload.chartMode);

  localStorage.setItem(
    "transactions",
    JSON.stringify(transactions)
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

  const previousSlices = structuredClone(slices);

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

