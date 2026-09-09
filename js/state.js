import { pushToCloud } from "../cloud/cloudSync.js";
import { broadcastState } from "./crossTabSync.js";
import { createUndoState, pushUndoState } from "./historyState.js";
import { getCloudMeta, setCloudMeta, STORAGE_SYNC_KEY } from "../cloud/cloudState.js";
import { chartMode } from "./chartState.js";
import { deviceId } from "./deviceIdentity.js";

export let transactions =
  JSON.parse(localStorage.getItem("transactions")) || [];

export let editId = null;
export let activeCategory = null;

const getErrorDetails = error => {
  if (!error) return null;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      status:
        Number.isFinite(error.status)
          ? error.status
          : null
    };
  }

  return {
    name: "Error",
    message: String(error),
    stack: null,
    status: null
  };
};

const rollbackTransactionPersistence = (
  previousTransactions,
  error = null
) => {
  setTransactions(previousTransactions);
  editId = null;

  return {
    success: false,
    rolledBack: true,
    error: "Transaction was not saved",
    cause: getErrorDetails(error)
  };
};

export const saveData = async ({
  transactions,
  cloudMeta,
  chartMode,
  meta = {}
}) => {
  // --------------------------------------------------
  // PRIMARY LOCAL PERSISTENCE
  //
  // If this throws, let it escape.
  // The transaction operation will roll back.
  // --------------------------------------------------
  localStorage.setItem(
    "transactions",
    JSON.stringify(transactions)
  );

  let cloudState = null;
  let cloudError = null;
  
  // --------------------------------------------------
  // REMOTE SYNCHRONIZATION
  // --------------------------------------------------
  try {
    const currentBlobId =
      cloudMeta?.blobId ?? 
      getCloudMeta()?.blobId ?? 
      null;

    cloudState = await pushToCloud({
      transactions,
      cloudMeta,
      chartMode,
      deviceId,
      meta,
      blobId: currentBlobId,
    });
  } catch (error) {
    cloudError = error;

    console.warn(
      "Cloud sync failed, saved locally",
      error
    );
  }

  // --------------------------------------------------
  // CLOUD METADATA
  // --------------------------------------------------
  if (cloudState) {
    try {
      setCloudMeta({
        version: cloudState.version,
        updatedAt: cloudState.updatedAt,
        deviceId: cloudState.updatedBy,
        blobId: cloudState.blobId,
      });
    } catch (error) {
      console.warn(
        "Cloud metadata could not be persisted:",
        error
      );
    }
  }

  // --------------------------------------------------
  // CROSS-TAB/STORAGE-FALLBACK MIRROR
  // --------------------------------------------------
  let syncStateError = null;

  try {
    const synchronizedState = {
      transactions:
        structuredClone(transactions),

      cloudMeta:
        structuredClone(getCloudMeta()),

      chartMode
    };

    localStorage.setItem(
      STORAGE_SYNC_KEY,
      JSON.stringify(synchronizedState)
    );
  } catch (error) {
    syncStateError = error;

    console.warn(
      "Sync-state mirror could not be persisted:",
      error
    );
  }

  // The transaction itself WAS saved locally.
  return {
    success: true,

    offline: Boolean(cloudError),

    cloudMeta:
      structuredClone(getCloudMeta()),

    cloudError:
      getErrorDetails(cloudError),

    syncStateError:
      getErrorDetails(syncStateError)
  };
};

export const setEditId = id => (editId = id);
export const setTransactions = data => (transactions = data);
export const toggleCategoryFilter = category => {
  activeCategory = activeCategory === category ? null : category;
};

export const setActiveCategory = category => {
  activeCategory = category;
};

export const addTransaction = async ({
  text,
  category,
  amount,
  chartMode,
}) => {
  const normalizedText = String(text ?? "").trim();

  // VALIDATION
  const numericAmount = Number(amount);

  if (!category || !amount) {
    return {
      success: false,
      error: "Category and amount are required"
    };
  }

  if (!Number.isFinite(numericAmount)) {
    return {
      success: false,
      error: "Amount must be a valid number"
    };
  }

  if (numericAmount === 0) {
    return {
      success: false,
      error: "Amount cannot be zero"
    };
  }

  const existing = transactions.find(
    t => t.id === editId
  );

  // NO-OP EDIT CHECK
  if (editId && existing) {
    const isUnchanged =
      existing.text === normalizedText &&
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

  const previousTransactions =
    structuredClone(transactions);

  const data = {
    id: currentEditId ?? Date.now(),
    text: normalizedText,
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
          t.id === currentEditId
            ? data
            : t
        )
      : [...transactions, data]
  );

  // PERSIST
  try {
    const result = await saveData({
      transactions,
      cloudMeta: getCloudMeta(),
      chartMode,
      meta: currentEditId
        ? {
            type: "edit",
            category: data.category,
            previousCategory:
              existing?.category
          }
        : {
            type: "add",
            category: data.category
          }
    });

    // LOCAL PERSISTENCE SUCCEEDED.
    // Cloud availability does not change that.

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

    return {
      success: true,
      offline: result.offline,
      cloudError: result.cloudError,
      syncStateError: result.syncStateError,
      transaction: data
    };

  } catch (error) {
    console.error(
      "Transaction persistence failed:",
      error
    );

    return rollbackTransactionPersistence(
      previousTransactions,
      error
    );
  }
};

export const deleteTransaction = async (
  id,
  { chartMode }
) => {
  const t = transactions.find(
    transaction => transaction.id === id
  );

  if (!t) {
    return {
      success: false,
      error: "Transaction not found"
    };
  }

  const previousTransactions =
    structuredClone(transactions);

  // MUTATE
  setTransactions(
    transactions.filter(
      transaction => transaction.id !== id
    )
  );

  try {
    const result = await saveData({
      transactions,
      cloudMeta: getCloudMeta(),
      chartMode,
      meta: {
        type: "delete",
        category: t.category
      }
    });

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
      success: true,
      offline: result.offline,
      cloudError: result.cloudError,
      syncStateError: result.syncStateError,
      transaction: t
    };

  } catch (error) {
    console.error(
      "Transaction deletion persistence failed:",
      error
    );

    return rollbackTransactionPersistence(
      previousTransactions,
      error
    );
  }
};

export const editTransaction = id => {
  const t = transactions.find(t => t.id === id);

  if (!t) return null;

  editId = id;

  return structuredClone(t);
};

/*
 * 
 * FOR FUTURE
 *
 * category validation
 * transaction ID generation
 * whether rollback should clear editId
 * richer sync-state validation
 * retry/outbox behavior for cloud failures
 * more event-driven synchronization
 * 
 */ 