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

export const switchStateIdentity = user => {
  const state =
    initializeState(user);

  transactions =
    structuredClone(
      state.transactions
    );

  editId = null;
  activeCategory = null;

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

  const localState = {
    transactions: structuredClone(transactions),
    chartMode,
    cloudMeta: structuredClone(cloudMeta),
    meta: structuredClone(meta)
  };

  let authoritativeState =
    structuredClone(localState);

  let cloudError = null;

  const MAX_SAVE_RETRIES = 3;

  if (authenticatedUser) {
    try {
      const cloudResult =
        await saveWithRetry({
          userId: authenticatedUser.id,
          state: structuredClone(localState),
          operation,
          deviceId,
          pushToCloud,
          pullFromCloud,
          maxRetries: MAX_SAVE_RETRIES
        });

      /*
       * IMPORTANT:
       * saveWithRetry() may have rebased the operation
       * on a newer cloud state.
       *
       * Therefore its returned state is authoritative.
       */
      authoritativeState =
        structuredClone(
          cloudResult.state
        );

    } catch (error) {
      cloudError = error;

      console.warn(
        "Cloud sync failed, saving locally:",
        error
      );
    }
  }

  /*
   * If cloud save succeeded, use the authoritative
   * cloud metadata returned by saveWithRetry().
   */
  if (!cloudError && authenticatedUser) {
    try {
      setCloudMeta(
        structuredClone(
          authoritativeState.cloudMeta
        )
      );
    } catch (error) {
      console.warn(
        "Cloud metadata could not be persisted:",
        error
      );
    }
  }

  /*
   * Persist the authoritative state locally.
   *
   * When cloud save succeeded:
   *   authoritativeState = rebased cloud state
   *
   * When offline/cloud save failed:
   *   authoritativeState = original local state
   */
  saveState(
    authoritativeState,
    authenticatedUser
  );

  const syncStateError = null;

  return {
    success: true,

    offline:
      Boolean(cloudError),

    cloudMeta:
      structuredClone(
        authoritativeState.cloudMeta
      ),

    cloudError:
      getErrorDetails(cloudError),

    syncStateError:
      getErrorDetails(syncStateError),

    state:
      structuredClone(
        authoritativeState
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
    id:
      currentEditId !== null &&
      currentEditId !== undefined
        ? String(currentEditId)
        : String(Date.now()),
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