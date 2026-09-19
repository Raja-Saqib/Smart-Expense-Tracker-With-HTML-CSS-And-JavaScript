import {
  getCachedAuthenticatedUser
} from "./auth.js";
import { pushToCloud, pullFromCloud } from "../cloud/cloudSync.js";
import {
  saveWithRetry,
} from "../cloud/saveWithRetry.js";
import { broadcastState } from "./crossTabSync.js";
import { createUndoState, pushUndoState } from "./historyState.js";
import { getCloudMeta, setCloudMeta } from "../cloud/cloudState.js";
import { chartMode, setChartMode } from "./chartState.js";
import { deviceId } from "./deviceIdentity.js";
import {
  loadState,
  saveState
} from "./localState.js";

export let transactions = [];

export let editId = null;
export let activeCategory = null;

export const initializeState = user => {
  const state = loadState(user);

  transactions =
    structuredClone(state.transactions);

  setCloudMeta(state.cloudMeta);

  setChartMode(state.chartMode);

  return state;
};

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

const createStateSnapshot = ({
  transactions,
  cloudMeta,
  chartMode,
  meta = {}
}) => ({
  transactions:
    structuredClone(transactions),

  cloudMeta:
    structuredClone(cloudMeta),

  chartMode,

  meta:
    structuredClone(meta)
});

export const saveData = async ({
  transactions,
  cloudMeta,
  chartMode,
  meta = {},
  operation = null
}) => {
  const authenticatedUser =
    getCachedAuthenticatedUser();

  // --------------------------------------------------
  // PREPARE LOCAL STATE
  //
  // This is the state we will persist locally if the
  // user is a guest or if cloud synchronization fails.
  // --------------------------------------------------

  const localState = {
    transactions:
      structuredClone(transactions),

    chartMode,

    cloudMeta:
      structuredClone(cloudMeta),

    meta:
      structuredClone(meta)
  };

  let cloudState = null;
  let cloudError = null;

  // --------------------------------------------------
  // AUTHENTICATED CLOUD SYNCHRONIZATION
  //
  // Guests remain LocalStorage-only.
  //
  // saveWithRetry() is responsible for optimistic
  // concurrency:
  //
  //   expected version
  //        ↓
  //   conditional write
  //        ↓
  //   version conflict?
  //        ↓
  //   pull latest → reapply operation → retry
  //
  // We never retry a stale complete snapshot.
  // --------------------------------------------------

  const MAX_SAVE_RETRIES = 3;

  if (authenticatedUser) {
    try {
      cloudState = await saveWithRetry({
        userId: authenticatedUser.id,

        state: structuredClone(localState),

        operation,

        deviceId,

        pushToCloud,

        pullFromCloud,

        maxRetries: MAX_SAVE_RETRIES
      });

    } catch (error) {
      cloudError = error;

      console.warn(
        "Cloud sync failed, saving locally:",
        error
      );
    }
  }

  // --------------------------------------------------
  // CLOUD METADATA
  //
  // Only replace the local cloud metadata when the
  // cloud write actually succeeded.
  //
  // This prevents a failed/conflicted cloud operation
  // from falsely advancing the local cloud version.
  // --------------------------------------------------

  if (cloudState) {
    try {
      setCloudMeta({
        version:
          cloudState.version,

        updatedAt:
          cloudState.updatedAt,

        deviceId:
          cloudState.updatedBy,

        blobId:
          cloudState.blobId
      });

    } catch (error) {
      console.warn(
        "Cloud metadata could not be persisted:",
        error
      );
    }
  }

  // --------------------------------------------------
  // PRIMARY LOCAL PERSISTENCE
  //
  // IMPORTANT:
  //
  // If cloud synchronization succeeded, persist the
  // authoritative cloud metadata returned by the
  // successful cloud write.
  //
  // If cloud synchronization failed, persist the
  // original local state and keep the previous cloud
  // metadata.
  //
  // saveState() automatically chooses:
  //
  //   guest:
  //   expenseTracker:guest:state
  //
  //   authenticated:
  //   expenseTracker:user:<userId>:state
  // --------------------------------------------------

  const persistedState = {
    transactions:
      structuredClone(transactions),

    chartMode,

    cloudMeta:
      structuredClone(getCloudMeta()),

    meta:
      structuredClone(meta)
  };

  // Local persistence remains authoritative for the
  // browser when cloud synchronization is unavailable.
  //
  // If this throws, the caller's existing rollback
  // mechanism must handle the failed transaction.
  saveState(
    persistedState,
    authenticatedUser
  );

  // --------------------------------------------------
  // SYNC-STATE ERROR REPORTING
  //
  // The old STORAGE_SYNC_KEY mirror has been removed.
  //
  // saveState() is now the identity-aware local
  // persistence mechanism and the storage-event fallback
  // watches that identity-specific key directly.
  //
  // Keep syncStateError in the return contract so
  // existing callers do not regress.
  // --------------------------------------------------

  const syncStateError = null;

  // --------------------------------------------------
  // RESULT
  // --------------------------------------------------

  return {
    success: true,

    offline:
      Boolean(cloudError),

    cloudMeta:
      structuredClone(
        getCloudMeta()
      ),

    cloudError:
      getErrorDetails(
        cloudError
      ),

    syncStateError:
      getErrorDetails(
        syncStateError
      )
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
          },
      operation: currentEditId
        ? {
            type: "edit",
            transactionId: currentEditId,
            changes: {
              text: data.text,
              category: data.category,
              amount: data.amount,
              updatedAt: data.updatedAt,
              updatedBy: data.updatedBy
            }
          }
        : {
            type: "add",
            transaction: structuredClone(data)
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
      },
      operation: {
        type: "delete",
        transactionId: id
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