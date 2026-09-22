import { transactions, setTransactions, saveData, activeCategory, addTransaction, editTransaction, deleteTransaction, setActiveCategory, switchStateIdentity, } from "./state.js";
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
import { pushUndoState, createUndoState, hasHistory, replaceCurrentUndoState, replaceCurrentUndoStateAndClearRedo, jumpToState, getCurrentIndex, commitJumpToState, getHistoryState, getNextRedoLabel, captureHistoryState, restoreHistoryState } from "./historyState.js";
import { listenToBroadcast, isBroadcastAvailable, broadcastState } from "./crossTabSync.js";
import { getChangedCategories } from "./chartDiff.js";
import { getCloudMeta, setCloudMeta } from "../cloud/cloudState.js";
import { deviceId } from "./deviceIdentity.js";
import { initDebugPanel } from "./debugPanel.js";
import { renderHistoryInspector } from "./historyInspector.js";
import { exportToCSV } from "./csvExport.js";
import { importFromCSV } from "./csvImport.js";
import {
  getNextUndoLabel,
  canRedo
} from "./historyState.js";
import { subscribe } from "./eventBus.js";
import {
  performUndo,
  performRedo
} from "./undoSync.js";
import {
  initializeAuth,
  getCachedAuthenticatedUser,
  signIn,
  signUp,
  signOut,
  onAuthStateChange
} from "./auth.js";
import { getActiveStorageKey, loadState, saveState } from "./localState.js";
import {
  initializeState,
  getLocalRevision,
  setLocalRevision
} from "./state.js";

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
const importBtn = document.getElementById("importCSV");
const importFileInput = document.getElementById("importCSVFile");
const clearFilterBtn = document.getElementById("clearFilter");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const logoutBtn = document.getElementById("logoutBtn");
const authLoggedOut = document.getElementById("authLoggedOut");
const authLoggedIn = document.getElementById("authLoggedIn");
const authUserEmail = document.getElementById("authUserEmail");
const authStatus = document.getElementById("authStatus");

const restoreHistoryJumpState = async target => {
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

  try {
    const result =
      await saveData({
        transactions:
          structuredClone(
            transactions
          ),

        cloudMeta:
          currentCloudMeta,

        chartMode,

        meta: {
          type: "history-jump"
        },

        operation: {
          type: "replaceState",

          state: {
            transactions:
              structuredClone(tx),

            chartMode:
              mode,

            meta: {
              type: "history-jump"
            }
          }
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

  const result = await restoreHistoryJumpState(target);

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

  broadcastState(
    result.state
  );

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

const MOON_PATH = "M303.3 112.7C196.2 121.2 112 210.8 112 320C112 434.9 205.1 528 320 528C353.3 528 384.7 520.2 412.6 506.3C309.2 482.9 232 390.5 232 280C232 214.2 259.4 154.9 303.3 112.7zM64 320C64 178.6 178.6 64 320 64C339.4 64 358.4 66.2 376.7 70.3C386.6 72.5 394 80.8 395.2 90.8C396.4 100.8 391.2 110.6 382.1 115.2C321.5 145.4 280 207.9 280 280C280 381.6 362.4 464 464 464C469 464 473.9 463.8 478.8 463.4C488.9 462.6 498.4 468.2 502.6 477.5C506.8 486.8 504.6 497.6 497.3 504.6C451.3 548.8 388.8 576 320 576C178.6 576 64 461.4 64 320z";

const SUN_PATH = "M320 32C328 32 335.4 36 339.9 42.6L398.7 130L502.1 109.8C509.9 108.3 518 110.7 523.7 116.4C529.4 122.1 531.8 130.2 530.3 138L510 241.3L597.4 300.1C604 304.5 608 312 608 320C608 328 604 335.4 597.4 339.9L510 398.7L530.2 502C531.7 509.8 529.3 517.9 523.6 523.6C517.9 529.3 509.8 531.7 502 530.2L398.7 510L339.9 597.4C335.4 604 328 608 320 608C312 608 304.6 604 300.1 597.4L241.3 510L137.9 530.2C130.1 531.7 122 529.3 116.3 523.6C110.6 517.9 108.2 509.8 109.7 502L130 398.7L42.6 339.9C36 335.4 32 328 32 320C32 312 36 304.6 42.6 300.1L130 241.3L109.8 137.9C108.3 130.1 110.7 122 116.4 116.3C122.1 110.6 130.2 108.2 138 109.7L241.3 129.9L300.1 42.5L301.9 40.2C306.4 35 313 32 320 32zM272.2 170C266.8 178 257.2 182 247.7 180.2L163.7 163.8L180.1 247.8C181.9 257.3 177.9 266.9 169.9 272.3L99 320L170 367.8C178 373.2 182 382.8 180.2 392.3L163.8 476.3L247.8 459.9L251.3 459.5C259.6 459.1 267.6 463.1 272.3 470.1L320.1 541.1L367.9 470.1L370.1 467.3C375.7 461.2 384.1 458.3 392.4 460L476.4 476.4L460 392.4C458.2 382.9 462.2 373.3 470.2 367.9L541.2 320.1L470.2 272.3C462.2 266.9 458.2 257.3 460 247.8L476.4 163.8L392.4 180.2C382.9 182 373.3 178 367.9 170L320.1 99L272.3 170zM320 440C253.7 440 200 386.3 200 320C200 253.7 253.7 200 320 200C386.3 200 440 253.7 440 320C440 386.3 386.3 440 320 440zM320 248C280.2 248 248 280.2 248 320C248 359.8 280.2 392 320 392C359.8 392 392 359.8 392 320C392 280.2 359.8 248 320 248z";

const updateThemeIcon = () => {
  const svg = document.getElementById("themeIcon");

  if (!svg) {
    console.warn("Theme icon SVG was not found.");
    return;
  }

  const path = svg.querySelector("path");

  if (!path) {
    console.warn("Theme icon path was not found.");
    return;
  }

  const isDark =
    document.body.classList.contains("dark");

  path.setAttribute(
    "d",
    isDark ? SUN_PATH : MOON_PATH
  );

  svg.setAttribute(
    "aria-label",
    isDark
      ? "Switch to light mode"
      : "Switch to dark mode"
  );
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
  
  updateThemeIcon();

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

const handleImportCSV = async e => {
  const file =
    e.target.files?.[0];

  if (!file) {
    return;
  }

  const previousTransactions =
    structuredClone(transactions);

  try {
    chartStatus.textContent =
      "Importing CSV...";

    /*
    * Ask the user which import mode to use.
    *
    * Merge is selected by default.
    */
    const mode =
      await showImportModeModal();

    /*
    * User cancelled the import.
    *
    * Nothing has been changed yet.
    */
    if (!mode) {
      importFileInput.value = "";

      chartStatus.textContent =
        "CSV import cancelled";

      return;
    }

    /*
    * For Replace All, duplicate checking against
    * existing transactions is unnecessary because
    * those transactions will be removed.
    *
    * For Merge, existing transactions are supplied
    * so duplicate rows can be skipped.
    */
    const result =
      await importFromCSV(
        file,
        mode === "merge"
          ? previousTransactions
          : [],
        {
          mode
        }
      );

    /*
     * Nothing valid was imported.
     */
    if (!result.transactions.length) {
      if (result.errors.length) {
        chartStatus.textContent =
          `Import failed: ${result.errors.length} invalid row(s)`;
      } else if (
        result.duplicateCount > 0
      ) {
        chartStatus.textContent =
          `No new transactions imported. ${result.duplicateCount} duplicate(s) skipped.`;
      } else {
        chartStatus.textContent =
          "No transactions found in CSV";
      }

      importFileInput.value = "";

      return;
    }

    /*
     * Prepare the persistence operation.
     *
     * Merge is rebaseable because the imported transactions
     * can be applied again to the latest cloud state.
     *
     * Replace is NOT rebaseable because it intentionally
     * replaces the complete transaction collection.
     */
    const importMeta = {
      type: "csv-import",
      mode,

      importedCount:
        result.transactions.length,

      replacedCount:
        mode === "replace"
          ? previousTransactions.length
          : 0,

      duplicateCount:
        result.duplicateCount,

      invalidCount:
        result.errors.length
    };

    const operation =
      mode === "replace"
        ? {
            type: "replaceState",

            state: {
              transactions:
                structuredClone(
                  result.transactions
                ),

              chartMode,

              meta:
                structuredClone(
                  importMeta
                )
            }
          }
        : {
            type: "mergeTransactions",

            transactions:
              structuredClone(
                result.transactions
              )
          };

    /*
     * Persist the operation.
     *
     * Do NOT update the live transaction state before
     * persistence. saveData() will apply the authoritative
     * resulting state after the operation succeeds.
     */
    const saveResult =
      await saveData({
        transactions:
          structuredClone(
            transactions
          ),

        cloudMeta:
          getCloudMeta(),

        chartMode,

        meta:
          structuredClone(
            importMeta
          ),

        operation
      });

    /*
     * If saving fails, restore the state that existed
     * before the import.
     */
    if (!saveResult.success) {
      setTransactions(
        previousTransactions
      );

      chartStatus.textContent =
        saveResult.error ??
        "CSV import could not be saved";

      importFileInput.value = "";

      return;
    }

    /*
     * Import is ONE undoable operation.
     */
    pushUndoState(
      createUndoState({
        transactions:
          structuredClone(transactions),

        cloudMeta:
          structuredClone(
            getCloudMeta()
          ),

        chartMode,

        label:
          mode === "replace"
            ? `Replace all with ${result.transactions.length} transaction${
                result.transactions.length === 1
                  ? ""
                  : "s"
              }`
            : `Import ${result.transactions.length} transaction${
                result.transactions.length === 1
                  ? ""
                  : "s"
              }`
      })
    );

    /*
     * Synchronize other browser tabs.
     */
    broadcastState(
      saveResult.state
    );

    /*
     * Re-render the complete application.
     */
    init();

    const parts = [];

    if (mode === "replace") {
      parts.push(
        `${result.transactions.length} imported`
      );

      parts.push(
        `${previousTransactions.length} existing transaction${
          previousTransactions.length === 1
            ? ""
            : "s"
        } replaced`
      );
    } else {
      parts.push(
        `${result.transactions.length} imported`
      );

      if (result.duplicateCount) {
        parts.push(
          `${result.duplicateCount} duplicate${
            result.duplicateCount === 1
              ? ""
              : "s"
          } skipped`
        );
      }
    }

    if (result.errors.length) {
      parts.push(
        `${result.errors.length} invalid row${
          result.errors.length === 1
            ? ""
            : "s"
        } skipped`
      );
    }

    const saveMessage =
      saveResult.offline
        ? "saved locally"
        : "data synced to cloud";

    chartStatus.textContent =
      `${parts.join(", ")} — ${saveMessage}`;

    /*
     * Allow the same CSV file to be selected again.
     */
    importFileInput.value = "";

  } catch (error) {
    /*
     * Always restore the previous state if anything
     * unexpected happens after state modification.
     */
    setTransactions(
      previousTransactions
    );

    chartStatus.textContent =
      error?.message ??
      "CSV import failed";

    importFileInput.value = "";
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

const handleLogin = async e => {
  e.preventDefault();

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  authStatus.textContent =
    "Logging in...";

  try {
    await signIn(email, password);

    loginForm.reset();

    authStatus.textContent =
      "Login successful";
  } catch (error) {
    console.error(
      "Login failed:",
      error
    );

    authStatus.textContent =
      error?.message ??
      "Login failed";
  }
};

const handleSignup = async e => {
  e.preventDefault();

  const email =
    document.getElementById("signupEmail").value.trim();

  const password =
    document.getElementById("signupPassword").value;

  authStatus.textContent =
    "Creating account...";

  try {
    const data =
      await signUp(email, password);

    signupForm.reset();

    if (data.session) {
      authStatus.textContent =
        "Account created and logged in";
    } else {
      authStatus.textContent =
        "Account created. Check your email if confirmation is required.";
    }
  } catch (error) {
    console.error(
      "Sign up failed:",
      error
    );

    authStatus.textContent =
      error?.message ??
      "Sign up failed";
  }
};

const handleLogout = async () => {
  authStatus.textContent =
    "Logging out...";

  try {
    await signOut();

    authStatus.textContent =
      "Logged out";
  } catch (error) {
    console.error(
      "Logout failed:",
      error
    );

    authStatus.textContent =
      error?.message ??
      "Logout failed";
  }
};

const updateAuthUI = user => {
  const isLoggedIn = Boolean(user);

  authLoggedOut.hidden = isLoggedIn;
  authLoggedIn.hidden = !isLoggedIn;

  if (user) {
    authUserEmail.textContent =
      user.email || "Authenticated user";
  } else {
    authUserEmail.textContent = "";
  }
};

const hydrateAuthenticatedState = async user => {
  if (!user?.id) {
    init();
    return;
  }

  // First load this account's own LocalStorage state.
  switchStateIdentity(user);

  let cloudData = null;

  try {
    cloudData = await pullFromCloud({
      userId: user.id
    });
  } catch (error) {
    console.warn(
      "Cloud account hydration failed:",
      error
    );
  }

  // No cloud state yet or cloud temporarily unavailable.
  if (!cloudData) {
    init();
    return;
  }

  const remoteVersion =
    Number.isSafeInteger(
      Number(cloudData.version)
    )
      ? Number(cloudData.version)
      : 0;

  const localCloudMeta =
    structuredClone(getCloudMeta());

  const localVersion =
    Number.isSafeInteger(
      Number(localCloudMeta?.version)
    )
      ? Number(localCloudMeta.version)
      : 0;

  // Cloud is not newer than this account's local state.
  if (remoteVersion <= localVersion) {
    init();
    return;
  }

  // Save the account's current local state
  // before replacing it with the newer cloud snapshot.
  pushUndoState(
    createUndoState({
      transactions:
        structuredClone(transactions),

      cloudMeta:
        structuredClone(localCloudMeta),

      chartMode,

      label:
        "Before cloud restore"
    })
  );

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
            Number(cloudData.updatedAt)
          )
            ? Number(cloudData.updatedAt)
            : 0,

        deviceId:
          cloudData.updatedBy ??
          cloudData.deviceId ??
          null
      },

      chartMode:
        cloudData.chartMode,

      meta:
        structuredClone(
          cloudData.meta ?? {}
        )
    }
  };

  applySnapshot(cloudSnapshot);

  // Persist the hydrated account state
  // under this authenticated user's LocalStorage key.
  saveState(
    {
      transactions:
        structuredClone(
          cloudData.transactions
        ),

      chartMode:
        cloudData.chartMode,

      cloudMeta:
        structuredClone(
          cloudSnapshot.state.cloudMeta
        ),

      localRevision:
        getLocalRevision(),

      meta:
        structuredClone(
          cloudData.meta ?? {}
        )
    },
    user
  );

  init();

  chartStatus.textContent =
    "Data restored from cloud";
};

const switchApplicationIdentity =
  async (event, session) => {
    const nextUser =
      session?.user ?? null;

    // -----------------------------
    // LOGOUT → GUEST STATE
    // -----------------------------
    if (!nextUser) {
      switchStateIdentity(null);

      updateAuthUI(null);

      init();

      chartStatus.textContent =
        "Logged out";

      return;
    }

    // -----------------------------
    // LOGIN → ACCOUNT STATE
    // -----------------------------
    updateAuthUI(nextUser);

    await hydrateAuthenticatedState(
      nextUser
    );

    chartStatus.textContent =
      `Signed in as ${
        nextUser.email ?? "user"
      }`;
  };

let authTransitionPromise =
  Promise.resolve();

const handleAuthTransition =
  (event, session) => {

    if (event === "INITIAL_SESSION") {
      return;
    }

    authTransitionPromise =
      authTransitionPromise
        .then(() =>
          switchApplicationIdentity(
            event,
            session
          )
        )
        .catch(error => {
          console.error(
            "Authentication state transition failed:",
            error
          );

          chartStatus.textContent =
            "Account state could not be switched safely";
        });
  };

onAuthStateChange(
  handleAuthTransition
);

const initializeAuthUI = async () => {
  try {
    const user =
      getCachedAuthenticatedUser();

    updateAuthUI(user);
  } catch (error) {
    console.error(
      "Authentication UI initialization failed:",
      error
    );

    updateAuthUI(null);
  }
};

await initializeAuthUI();

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
      redoLabel: getNextRedoLabel(),
      canRedo: canRedo()
    }
  );
};

subscribe("history:changed", refreshUndoUI);

refreshUndoUI();

updateThemeIcon();

initEvents({
  form,
  monthEl,
  clearFilterBtn,
  exportBtn,
  importBtn,
  importFileInput,
  listEl,
  themeBtn,
  undoBtn,
  redoBtn,
  loginForm,
  signupForm,
  logoutBtn,
  handlers: {
    addTransaction: handleAddTransaction,
    init,
    clearFilter,
    exportCSV: handleExportCSV,
    importCSV: handleImportCSV,
    editTransaction: handleEditTransaction,
    deleteTransaction: handleDeleteTransaction,
    toggleTheme,
    undo: handleUndo,
    redo: handleRedo,
    keydown: handleKeydown,
    login: handleLogin,
    signup: handleSignup,
    logout: handleLogout,
  }
});

// toggleBtn.addEventListener("click", () => {
//   toggleChartMode();
//   init(); 
// });

donutToggle.addEventListener("change", async () => {
  const mode =
    donutToggle.checked
      ? "donut"
      : "pie";

  const previousChartMode =
    chartMode;

  try {

    const result = await saveData({
      transactions:
        structuredClone(
          transactions
        ),

      cloudMeta:
        getCloudMeta(),

      chartMode,

      meta: {
        type: "chart-mode"
      },

      operation: {
        type: "setChartMode",
        chartMode: mode
      }
    });

    if (!result.success) {
      throw new Error(
        result.error ??
        "Chart mode was not saved"
      );
    }

    setChartMode(
      result.state.chartMode
    );

    pushUndoState(
      createUndoState({
        transactions,
        cloudMeta: getCloudMeta(),
        chartMode: mode,
        label: "Undo chart mode"
      })
    );

    broadcastState(
      result.state
    );

    chartStatus.textContent =
      result.offline
        ? mode === "donut"
          ? "Donut chart enabled (cloud offline)"
          : "Pie chart enabled (cloud offline)"
        : mode === "donut"
          ? "Donut chart enabled"
          : "Pie chart enabled";

    init();

  } catch (error) {
    setChartMode(
      previousChartMode
    );

    donutToggle.checked =
      previousChartMode === "donut";

    chartStatus.textContent =
      "Chart mode change failed";

    console.error(
      "Chart mode persistence failed:",
      error
    );

    init();
  }
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
    throw new Error(
      "Invalid transactions in snapshot"
    );
  }

  if (!cloudMeta) {
    throw new Error(
      "Invalid cloud metadata in snapshot"
    );
  }

  if (
    mode !== "pie" &&
    mode !== "donut"
  ) {
    throw new Error(
      "Invalid chart mode in snapshot"
    );
  }

  const currentUser =
    getCachedAuthenticatedUser();

  const currentState =
    loadState(currentUser);

  const currentLocalRevision =
    Number.isSafeInteger(
      Number(currentState?.localRevision)
    ) &&
    Number(currentState.localRevision) >= 0
      ? Number(currentState.localRevision)
      : 0;

  const nextLocalRevision =
    currentLocalRevision + 1;

  setLocalRevision(
    nextLocalRevision
  );

  setTransactions(
    structuredClone(tx)
  );

  setCloudMeta(
    structuredClone(cloudMeta)
  );

  setChartMode(mode);

  saveState(
    {
      transactions:
        structuredClone(tx),

      chartMode: mode,

      cloudMeta:
        structuredClone(cloudMeta),

      localRevision:
        nextLocalRevision,

      meta: {}
    },
    currentUser
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

  await initializeAuth();

  const authenticatedUser =
    getCachedAuthenticatedUser();

  initializeState(authenticatedUser);

  // --------------------------------------------------
  // LOAD PERSISTED CLOUD METADATA
  // --------------------------------------------------
  const cloudMeta = getCloudMeta();

  // --------------------------------------------------
  // PULL CLOUD SNAPSHOT
  // --------------------------------------------------
  try {
    /*
    * Supabase identifies the cloud state through
    * the authenticated user's user_id.
    *
    * 
    */
    if (authenticatedUser) {
      cloudData = await pullFromCloud({
        userId: authenticatedUser.id
      });
    }

  } catch (error) {
    console.warn(
      "Cloud startup restore failed:",
      error
    );
  }

  // --------------------------------------------------
  // CLOUD UNAVAILABLE OR NO CLOUD STATE
  // --------------------------------------------------
  /*
   * If the user is not authenticated, the application
   * remains completely local.
   *
   * If the user is authenticated but no cloud state
   * exists yet, continue with the existing local state.
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
  const previousHistory =
    captureHistoryState();
  
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

  const previousCloudMeta =
    structuredClone(getCloudMeta());

  const previousState =
    loadState(
      getCachedAuthenticatedUser()
    );

  // --------------------------------------------------
  // APPLY CLOUD SNAPSHOT
  // --------------------------------------------------
  try {
    /*
     * The cloud payload uses `updatedBy`.
     * Local cloud metadata uses `deviceId`.
     *
     * Legacy blobId metadata is intentionally retained
     * for compatibility and will be cleaned up separately.
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
            cloudData.updatedBy ?? null
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
    const restoredState =
      loadState(
        getCachedAuthenticatedUser()
      );

    broadcastState(
      restoredState
    );

    chartStatus.textContent =
      "Data restored from cloud";

  } catch (error) {

    // --------------------------------------------------
    // ROLLBACK FAILED CLOUD RESTORE
    // --------------------------------------------------
    /*
     * Restore the complete application state that existed
     * before attempting the cloud restore.
     *
     * This includes transactions, chart mode, and cloud
     * metadata so the local snapshot remains internally
     * consistent if persistence fails midway.
     */
    const currentUser =
      getCachedAuthenticatedUser();
      
    setTransactions(
      previousTransactions
    );

    setChartMode(
      previousChartMode
    );

    setCloudMeta(
      previousCloudMeta
    );

    const previousLocalRevision =
      Number.isSafeInteger(
        Number(previousState?.localRevision)
      ) &&
      Number(previousState.localRevision) >= 0
        ? Number(previousState.localRevision)
        : 0;
    
    setLocalRevision(
      previousLocalRevision
    );

    restoreHistoryState(
      previousHistory
    );


    /*
     * Restore the exact previous cloud metadata.
     *
     * Do not increment or otherwise modify the cloud
     * version during rollback.
     *
     * The Supabase user's identity is managed separately
     * through the authenticated user's user.id.
     */
    
    saveState(
      {
        transactions:
          structuredClone(
            previousState.transactions
          ),

        cloudMeta:
          structuredClone(
            previousState.cloudMeta
          ),

        chartMode:
          previousState.chartMode,

        localRevision:
          previousLocalRevision,

        meta:
          structuredClone(
            previousState.meta ?? {}
          )
      },
      currentUser
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

// const isValidBroadcastPayload = payload => {
//   if (
//     !payload ||
//     typeof payload !== "object"
//   ) {
//     return false;
//   }

//   if (!Array.isArray(payload.transactions)) {
//     return false;
//   }

//   if (
//     !payload.cloudMeta ||
//     typeof payload.cloudMeta !== "object"
//   ) {
//     return false;
//   }

//   if (
//     payload.chartMode !== "pie" &&
//     payload.chartMode !== "donut"
//   ) {
//     return false;
//   }

//   return true;
// };

// listenToBroadcast(payload => {
//   if (!isValidBroadcastPayload(payload)) {
//     console.warn(
//       "Ignored invalid cross-tab state payload"
//     );

//     return;
//   }

//   const previousSlices =
//     slices.map(slice => ({
//       category: slice.category,
//       value: slice.value
//     }));

//   setTransactions(
//     structuredClone(payload.transactions)
//   );

//   setCloudMeta(
//     structuredClone(payload.cloudMeta)
//   );

//   const accepted =
//     setChartMode(payload.chartMode);

//   if (!accepted) {
//     console.warn(
//       "Ignored cross-tab state with invalid chartMode"
//     );

//     return;
//   }

//   replaceCurrentUndoStateAndClearRedo(
//     createUndoState({
//       transactions,
//       cloudMeta: structuredClone(getCloudMeta()),
//       chartMode,
//       label: "Cross-tab update"
//     })
//   );

//   init();

//   const changed = getChangedCategories(
//     previousSlices,
//     slices
//   );

//   if (changed.length) {
//     highlightChangedSlices({
//       ctx,
//       cx: canvas.width / 2,
//       cy: canvas.height / 2,
//       radius: 120,
//       innerRadius: chartMode === "donut" ? 70 : 0,
//       slices,
//       changedCategories: changed
//     });
//   }

//   chartStatus.textContent = "Updated from another tab";
// });

// window.addEventListener("storage", e => {
//   if (isBroadcastAvailable()) return;

//   if (e.key !== "expenseTrackerSyncState") return;

//   if (!e.newValue) return;

//   let persistedState;

//   try {
//     persistedState = JSON.parse(e.newValue);
//   } catch {
//     return;
//   }

//   if (
//     !persistedState ||
//     !Array.isArray(persistedState.transactions)
//   ) {
//     return;
//   }

//   if (
//     persistedState.chartMode !== "pie" &&
//     persistedState.chartMode !== "donut"
//   ) {
//     return;
//   }

//   if (!persistedState.cloudMeta) {
//     return;
//   }

//   const previousSlices = slices.map(slice => ({
//     category: slice.category,
//     value: slice.value
//   }));

//   setTransactions(
//     structuredClone(persistedState.transactions)
//   );

//   setCloudMeta(
//     structuredClone(persistedState.cloudMeta)
//   );

//   setChartMode(persistedState.chartMode);

//   replaceCurrentUndoStateAndClearRedo(
//     createUndoState({
//       transactions,
//       cloudMeta: structuredClone(getCloudMeta()),
//       chartMode,
//       label: "Cross-tab update"
//     })
//   );

//   init();

//   const changed = getChangedCategories(
//     previousSlices,
//     slices
//   );

//   if (changed.length) {
//     highlightChangedSlices({
//       ctx,
//       cx: canvas.width / 2,
//       cy: canvas.height / 2,
//       radius: 120,
//       innerRadius: chartMode === "donut" ? 70 : 0,
//       slices,
//       changedCategories: changed
//     });
//   }

//   chartStatus.textContent =
//     "Updated from another tab";
// });

const isValidExternalStateEvent = event => {
  if (!event || typeof event !== "object") {
    return false;
  }

  if (typeof event.storageKey !== "string") {
    return false;
  }

  if (
    event.userId !== null &&
    typeof event.userId !== "string"
  ) {
    return false;
  }

  if (
    !Number.isSafeInteger(event.version) ||
    event.version < 0
  ) {
    return false;
  }

  if (
    !Number.isSafeInteger(
      event.localRevision
    ) ||
    event.localRevision < 0
  ) {
    return false;
  }

  if (
    !event.state ||
    typeof event.state !== "object"
  ) {
    return false;
  }

  if (!Array.isArray(event.state.transactions)) {
    return false;
  }

  if (
    event.state.chartMode !== "pie" &&
    event.state.chartMode !== "donut"
  ) {
    return false;
  }

  if (
    !event.state.cloudMeta ||
    typeof event.state.cloudMeta !== "object"
  ) {
    return false;
  }

  if (
    !Number.isSafeInteger(
      event.state.localRevision
    ) ||
    event.state.localRevision < 0
  ) {
    return false;
  }

  if (
    event.state.localRevision !==
    event.localRevision
  ) {
    return false;
  }

  if (
    event.state.cloudMeta.version !==
    event.version
  ) {
    return false;
  }

  return true;
};

const isCurrentIdentityEvent = event => {
  const currentUser =
    getCachedAuthenticatedUser();

  const activeStorageKey =
    getActiveStorageKey(currentUser);

  if (event.storageKey !== activeStorageKey) {
    return false;
  }

  const activeUserId =
    currentUser?.id ?? null;

  if (event.userId !== activeUserId) {
    return false;
  }

  return true;
};

const isStaleExternalStateEvent = event => {
  const localRevision =
    getLocalRevision();

  return (
    event.localRevision <=
    localRevision
  );
};

// const handleExternalStateUpdate = persistedState => {
//   if (
//     !persistedState ||
//     typeof persistedState !== "object"
//   ) {
//     return;
//   }

//   if (!Array.isArray(persistedState.transactions)) {
//     console.warn(
//       "Ignored external state with invalid transactions"
//     );

//     return;
//   }

//   if (
//     persistedState.chartMode !== "pie" &&
//     persistedState.chartMode !== "donut"
//   ) {
//     console.warn(
//       "Ignored external state with invalid chartMode"
//     );

//     return;
//   }

//   if (
//     !persistedState.cloudMeta ||
//     typeof persistedState.cloudMeta !== "object"
//   ) {
//     console.warn(
//       "Ignored external state with invalid cloudMeta"
//     );

//     return;
//   }

//   const previousSlices =
//     slices.map(slice => ({
//       category: slice.category,
//       value: slice.value
//     }));

//   setTransactions(
//     structuredClone(
//       persistedState.transactions
//     )
//   );

//   setCloudMeta(
//     structuredClone(
//       persistedState.cloudMeta
//     )
//   );

//   setChartMode(
//     persistedState.chartMode
//   );

//   replaceCurrentUndoStateAndClearRedo(
//     createUndoState({
//       transactions,
//       cloudMeta:
//         structuredClone(
//           getCloudMeta()
//         ),
//       chartMode,
//       label: "Cross-tab update"
//     })
//   );

//   init();

//   const changed =
//     getChangedCategories(
//       previousSlices,
//       slices
//     );

//   if (changed.length) {
//     highlightChangedSlices({
//       ctx,
//       cx: canvas.width / 2,
//       cy: canvas.height / 2,
//       radius: 120,
//       innerRadius:
//         chartMode === "donut"
//           ? 70
//           : 0,
//       slices,
//       changedCategories: changed
//     });
//   }

//   chartStatus.textContent =
//     "Updated from another tab";
// };

const handleExternalStateUpdate = event => {
  if (!isValidExternalStateEvent(event)) {
    console.warn(
      "Ignored malformed external state event"
    );

    return;
  }

  if (!isCurrentIdentityEvent(event)) {
    console.warn(
      "Ignored external state event for another identity"
    );

    return;
  }

  if (isStaleExternalStateEvent(event)) {
    console.info(
      "Ignored stale external state event",
      {
        incomingVersion: event.version,
        localVersion:
          getCloudMeta()?.version ?? 0
      }
    );

    return;
  }

  const {
    state
  } = event;

  const previousSlices =
    slices.map(slice => ({
      category: slice.category,
      value: slice.value
    }));

  setTransactions(
    structuredClone(
      state.transactions
    )
  );

  setCloudMeta(
    structuredClone(
      state.cloudMeta
    )
  );

  setChartMode(
    state.chartMode
  );

  setLocalRevision(
    state.localRevision
  );

  const currentUser =
    getCachedAuthenticatedUser();

  saveState(
    {
      transactions:
        structuredClone(
          state.transactions
        ),

      chartMode:
        state.chartMode,

      cloudMeta:
        structuredClone(
          state.cloudMeta
        ),

      localRevision:
        state.localRevision,

      meta:
        structuredClone(
          state.meta ?? {}
        )
    },
    currentUser
  );

  replaceCurrentUndoStateAndClearRedo(
    createUndoState({
      transactions,
      cloudMeta:
        structuredClone(
          getCloudMeta()
        ),
      chartMode,
      label: "Cross-tab update"
    })
  );

  init();

  const changed =
    getChangedCategories(
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
        chartMode === "donut"
          ? 70
          : 0,
      slices,
      changedCategories: changed
    });
  }

  chartStatus.textContent =
    "Updated from another tab";
};

listenToBroadcast(
  handleExternalStateUpdate
);

window.addEventListener(
  "storage",
  event => {
    // Storage events are only the fallback
    // when BroadcastChannel is unavailable.
    if (isBroadcastAvailable()) {
      return;
    }

    const currentUser =
      getCachedAuthenticatedUser();

    const activeKey =
      getActiveStorageKey(currentUser);

    // Ignore changes belonging to another
    // account or another storage identity.
    if (event.key !== activeKey) {
      return;
    }

    if (event.newValue === null) {
      // Active state was cleared.
      return;
    }

    try {
      const state =
        JSON.parse(event.newValue);

      const externalEvent = {
        storageKey: activeKey,

        userId:
          currentUser?.id ?? null,

        version:
          Number.isSafeInteger(
            state.cloudMeta?.version
          )
            ? state.cloudMeta.version
            : 0,

        localRevision:
          Number.isSafeInteger(
            state.localRevision
          )
            ? state.localRevision
            : 0,

        state
      };
        
      // Apply the state update.
      handleExternalStateUpdate(
        externalEvent
      );
    } catch (error) {
      console.warn(
        "Failed to parse external state:",
        error
      );
    }
  }
);

