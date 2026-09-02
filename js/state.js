import { pushToCloud } from "../cloud/cloudSync.js";
import { broadcastState } from "./crossTabSync.js";
import { createUndoState, pushUndoState } from "./historyState.js";
import { getCloudMeta, setCloudMeta } from "../cloud/cloudState.js";
import { chartMode } from "./chartState.js";
import { deviceId } from "./deviceIdentity.js";

export let transactions =
  JSON.parse(localStorage.getItem("transactions")) || [];

export let editId = null;
export let activeCategory = null;

export const saveData = async ({
  transactions,
  cloudMeta,
  chartMode,
  meta = {}
}) => {
  localStorage.setItem(
    "transactions",
    JSON.stringify(transactions)
  );

  try {
    const cloudState = await pushToCloud({
      transactions,
      cloudMeta,
      chartMode,
      deviceId,
      meta
    });

    setCloudMeta({
      version: cloudState.version,
      updatedAt: cloudState.updatedAt,
      deviceId: cloudState.updatedBy
    });

    const synchronizedState = {
      transactions: structuredClone(transactions),
      cloudMeta: structuredClone(getCloudMeta()),
      chartMode
    };

    localStorage.setItem(
      "expenseTrackerSyncState",
      JSON.stringify(synchronizedState)
    );

    return {
      success: true,
      cloudMeta: structuredClone(getCloudMeta())
    };
  } catch (e) {
    console.warn("Cloud sync failed, saved locally");

    const synchronizedState = {
      transactions: structuredClone(transactions),
      cloudMeta: structuredClone(getCloudMeta()),
      chartMode
    };

    localStorage.setItem(
      "expenseTrackerSyncState",
      JSON.stringify(synchronizedState)
    );

    return { success: false };
  }
};

export const setEditId = id => (editId = id);
export const setTransactions = data => (transactions = data);
export const toggleCategoryFilter = category => {
  activeCategory = activeCategory === category ? null : category;
};

export const addTransaction = async ({
  text,
  category,
  amount,
  chartMode,
}) => {
  if (!text || !category || !amount) {
    return {
      success: false,
      error: "All fields are required"
    };
  }

  if (+amount === 0) {
    return {
      success: false,
      error: "Amount cannot be zero"
    };
  }

  const numericAmount = +amount;

  const existing = transactions.find(t => t.id === editId);

  // Editing: detect no-op before creating a new object
  if (editId && existing) {
    const isUnchanged =
      existing.text === text &&
      existing.category === category &&
      existing.amount === numericAmount;

    if (isUnchanged) {
      editId = null;

      return {
        success: true,
        noChanges: true
      };
    }
  }

  const currentEditId = editId;

  const data = {
    id: currentEditId ?? Date.now(),
    text,
    category,
    amount: numericAmount,
    date: existing?.date ?? new Date().toISOString(),
    updatedAt: Date.now(),
    updatedBy: deviceId
  };

  // MUTATE
  setTransactions(
    currentEditId
      ? transactions.map(t =>
          t.id === currentEditId ? data : t
        )
      : [...transactions, data]
  );

  // PERSIST
  const result = await saveData({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode,
    meta: currentEditId
      ? {
          type: "edit",
          category: data.category,
          previousCategory: existing?.category
        }
      : {
          type: "add",
          category: data.category
        }
  });

  // SNAPSHOT AFTER PERSISTENCE
  pushUndoState(
    createUndoState({
      transactions,
      cloudMeta: getCloudMeta(),
      chartMode,
      label: currentEditId
        ? "Undo edit"
        : "Undo add"
    })
  );

  broadcastState({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode
  });

  editId = null;

  if (!result.success) {
    return {
      success: false,
      offline: true,
      transaction: data
    };
  }

  return {
    success: true,
    transaction: data
  };
};

export const deleteTransaction = async (
  id,
  { chartMode }
) => {
  const t = transactions.find(t => t.id === id);

  if (!t) {
    return {
      success: false,
      error: "Transaction not found"
    };
  }

  // MUTATE
  setTransactions(
    transactions.filter(tx => tx.id !== id)
  );

  // PERSIST
  const result = await saveData({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode,
    meta: {
      type: "delete",
      category: t.category
    }
  });

  // SNAPSHOT AFTER PERSISTENCE
  pushUndoState(
    createUndoState({
      transactions,
      cloudMeta: getCloudMeta(),
      chartMode,
      label: "Undo delete"
    })
  );

  broadcastState({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode
  });

  return {
    success: result.success,
    offline: !result.success,
    transaction: t
  };
};

export const editTransaction = id => {
  const t = transactions.find(t => t.id === id);

  if (!t) return null;

  editId = id;

  return structuredClone(t);
};

