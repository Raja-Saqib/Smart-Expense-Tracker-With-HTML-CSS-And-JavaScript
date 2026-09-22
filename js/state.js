import {
  getCachedAuthenticatedUser
} from "./auth.js";
import { pushToCloud, pullFromCloud } from "../cloud/cloudSync.js";
import {
  saveWithRetry,
  applyOperation,
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

let localRevision = 0;

export const getLocalRevision = () =>
  localRevision;

export const setLocalRevision = revision => {
  const normalizedRevision =
    Number(revision);

  if (
    !Number.isSafeInteger(
      normalizedRevision
    ) ||
    normalizedRevision < 0
  ) {
    throw new Error(
      "localRevision must be a non-negative integer."
    );
  }

  localRevision =
    normalizedRevision;
};

const normalizeTransactionId = id => {
  if (Number.isSafeInteger(id)) {
    return id;
  }

  if (
    typeof id === "string" &&
    id.trim() !== ""
  ) {
    const numericId =
      Number(id);

    if (
      Number.isSafeInteger(
        numericId
      )
    ) {
      return numericId;
    }
  }

  return null;
};

const normalizeTransactions = list => {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .map(transaction => {
      const normalizedId =
        normalizeTransactionId(
          transaction?.id
        );

      if (
        normalizedId === null
      ) {
        return null;
      }

      return {
        ...transaction,
        id: normalizedId
      };
    })
    .filter(Boolean);
};

export const initializeState = user => {
  const state =
    loadState(user);

  const normalizedTransactions =
    normalizeTransactions(
      state.transactions
    );

  transactions =
    structuredClone(
      normalizedTransactions
    );

  localRevision =
    Number.isSafeInteger(
      Number(state.localRevision)
    ) &&
    Number(state.localRevision) >= 0
      ? Number(state.localRevision)
      : 0;

  setCloudMeta(
    state.cloudMeta
  );

  setChartMode(
    state.chartMode
  );

  return {
    ...state,
    transactions:
      normalizedTransactions
  };
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

const isCloudVersionConflict = error => {
  return (
    error?.code ===
      "CLOUD_VERSION_CONFLICT" ||
    error?.name ===
      "CloudVersionConflictError"
  );
};

const isOperationConflict = error => {
  return (
    error?.code ===
      "OPERATION_REBASE_CONFLICT" ||
    error?.name ===
      "OperationConflictError"
  );
};

const isCloudUnavailable = error => {
  if (!error) {
    return false;
  }

  if (
    isCloudVersionConflict(error) ||
    isOperationConflict(error)
  ) {
    return false;
  }

  /*
   * Explicit timeout / abort failures.
   */
  if (
    error.name === "TimeoutError" ||
    error.name === "AbortError"
  ) {
    return true;
  }

  /*
   * Browser/network failures commonly surface
   * as TypeError from fetch().
   */
  if (
    error.name === "TypeError" &&
    /fetch|network|load/i.test(
      error.message ?? ""
    )
  ) {
    return true;
  }

  /*
   * No HTTP status usually indicates that a
   * request never received a server response.
   */
  if (
    error.status == null &&
    error.code == null &&
    /network|fetch|offline|timeout|unavailable/i.test(
      error.message ?? ""
    )
  ) {
    return true;
  }

  return false;
};

export const saveData = async ({
  transactions,
  cloudMeta,
  chartMode,
  meta = {},
  operation = null
}) => {
  const authenticatedUser =
    getCachedAuthenticatedUser();

  const currentLocalRevision =
    Number.isSafeInteger(
      localRevision
    ) &&
    localRevision >= 0
      ? localRevision
      : 0;

  const nextLocalRevision =
    currentLocalRevision + 1;

  /*
   * This is the BASE state.
   *
   * Important:
   * It must represent the state BEFORE the
   * supplied operation is applied.
   */
  const baseState = {
    transactions:
      structuredClone(transactions),

    chartMode,

    cloudMeta:
      structuredClone(cloudMeta),

    localRevision:
      nextLocalRevision,

    meta:
      structuredClone(meta)
  };

  let authoritativeState =
    structuredClone(baseState);

  let cloudResult = null;
  let cloudError = null;

  // --------------------------------------------------
  // AUTHENTICATED CLOUD SYNCHRONIZATION
  // --------------------------------------------------

  if (authenticatedUser) {
    try {
      cloudResult =
        await saveWithRetry({
          userId:
            authenticatedUser.id,

          state:
            structuredClone(baseState),

          operation,

          deviceId,

          pushToCloud,

          pullFromCloud,

          maxRetries: 3
        });

      if (
        !cloudResult?.state ||
        typeof cloudResult.state !== "object"
      ) {
        throw new Error(
          "Cloud save succeeded but no authoritative state was returned"
        );
      }

      /*
       * Cloud state is authoritative.
       *
       * This is especially important after
       * a successful rebase.
       */
      authoritativeState =
        structuredClone(
          cloudResult.state
        );

      authoritativeState.localRevision =
        nextLocalRevision;

    } catch (error) {
      /*
       * ------------------------------------------------
       * CLASSIFY CLOUD SAVE FAILURE
       * ------------------------------------------------
       */

      /*
       * These are real save failures.
       *
       * They must NOT silently fall back to local
       * persistence because doing so could hide:
       *
       * - optimistic concurrency conflicts
       * - invalid operations
       * - invalid state
       * - application bugs
       */
      if (
        isCloudVersionConflict(error) ||
        isOperationConflict(error)
      ) {
        console.error(
          "Cloud save failed due to a state/operation conflict:",
          error
        );

        return {
          success: false,
          offline: false,
          state: null,
          cloudMeta:
            structuredClone(
              cloudMeta
            ),
          cloudError:
            getErrorDetails(error),
          syncStateError:
            getErrorDetails(error),
          attempts: 0,
          rebased: false
        };
      }

      /*
       * ------------------------------------------------
       * CLOUD UNAVAILABLE
       * ------------------------------------------------
       *
       * Only genuine connectivity/timeout failures
       * are allowed to use local fallback.
       */
      if (isCloudUnavailable(error)) {
        cloudError = error;

        console.warn(
          "Cloud unavailable; applying operation locally:",
          error
        );

      } else {
        /*
         * Unknown cloud failures are NOT treated as
         * offline.
         */
        console.error(
          "Cloud save failed:",
          error
        );

        return {
          success: false,
          offline: false,
          state: null,
          cloudMeta:
            structuredClone(
              cloudMeta
            ),
          cloudError:
            getErrorDetails(error),
          syncStateError:
            getErrorDetails(error),
          attempts: 0,
          rebased: false
        };
      }
    }
  }

  // --------------------------------------------------
  // LOCAL / OFFLINE OPERATION
  // --------------------------------------------------

  /*
   * If there was no successful cloud write,
   * apply the operation locally.
   *
   * This covers:
   *
   * 1. Guest users
   * 2. Authenticated users while cloud is offline
   *
   * The operation is therefore applied exactly
   * once regardless of cloud availability.
   */
  if (!cloudResult) {
    if (operation) {
      authoritativeState =
        applyOperation(
          structuredClone(baseState),
          operation
        );
    } else {
      authoritativeState =
        structuredClone(baseState);
    }
  }

  // --------------------------------------------------
  // APPLY AUTHORITATIVE IN-MEMORY STATE
  // --------------------------------------------------

  setTransactions(
    structuredClone(
      authoritativeState.transactions
    )
  );

  setChartMode(
    authoritativeState.chartMode
  );

  setCloudMeta(
    structuredClone(
      authoritativeState.cloudMeta
    )
  );

  localRevision =
    Number.isSafeInteger(
      authoritativeState.localRevision
    ) &&
    authoritativeState.localRevision >= 0
      ? authoritativeState.localRevision
      : nextLocalRevision;

  // --------------------------------------------------
  // LOCAL PERSISTENCE
  // --------------------------------------------------

  saveState(
    {
      ...structuredClone(
        authoritativeState
      ),
      localRevision
    },
    authenticatedUser
  );

  // --------------------------------------------------
  // RESULT
  // --------------------------------------------------

  return {
    success: true,

    offline:
      Boolean(
        cloudError &&
        isCloudUnavailable(cloudError)
      ),

    state: {
      ...structuredClone(
        authoritativeState
      ),
      localRevision
    },

    cloudMeta:
      structuredClone(
        authoritativeState.cloudMeta
      ),

    cloudError:
      getErrorDetails(
        cloudError
      ),

    syncStateError:
      null,

    attempts:
      cloudResult?.attempts ?? 0,

    rebased:
      cloudResult?.rebased ?? false
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

  const currentEditId =
    normalizeTransactionId(
      editId
    );

  if (
    currentEditId !== null &&
    currentEditId !== undefined
  ) {
    editId = currentEditId;
  }
  
  const previousTransactions =
    structuredClone(transactions);

  const createTransactionId = () => {
    let id = Date.now();

    while (
      transactions.some(
        transaction =>
          transaction.id === id
      )
    ) {
      id++;
    }

    return id;
  };

  const data = {
    id:
      currentEditId ??
      createTransactionId(),

    text: normalizedText,
    category,
    amount: numericAmount,
    date:
      existing?.date ??
      new Date().toISOString(),
    updatedAt: Date.now(),
    updatedBy: deviceId
  };

  // PERSIST
  try {
    const result = await saveData({
      transactions:
        structuredClone(
          previousTransactions
        ),
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

    broadcastState(
      result.state
    );

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
  const normalizedId =
    normalizeTransactionId(id);

  const t =
    transactions.find(
      transaction =>
        transaction.id ===
        normalizedId
    );

  if (!t) {
    return {
      success: false,
      error: "Transaction not found"
    };
  }

  const previousTransactions =
    structuredClone(transactions);

  try {
    const result = await saveData({
      transactions:
        structuredClone(
          previousTransactions
        ),
      cloudMeta: getCloudMeta(),
      chartMode,
      meta: {
        type: "delete",
        category: t.category
      },
      operation: {
        type: "delete",
        transactionId: normalizedId
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

    broadcastState(
      result.state
    );

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
  const normalizedId =
    normalizeTransactionId(id);

  const t =
    transactions.find(
      transaction =>
        transaction.id ===
        normalizedId
    );

  if (!t) {
    return null;
  }

  editId =
    normalizedId;

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