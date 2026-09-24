// js/localState.js

import { sanitizeTransactions, } from "./stateValidator.js";
import {
  normalizeAmountByCategory
} from "./transactionRules.js";

const GUEST_STORAGE_KEY =
  "expenseTracker:guest:state";

const USER_STORAGE_PREFIX =
  "expenseTracker:user:";


const getBackupStorageKey = storageKey =>
  `${storageKey}:backup`;

const backupInvalidState = (
  storageKey,
  raw,
  reason
) => {
  try {
    localStorage.setItem(
      getBackupStorageKey(storageKey),
      raw
    );

    console.warn(
      `Invalid LocalStorage state backed up before recovery (${reason}).`
    );

    return true;
  } catch (error) {
    console.warn(
      "Invalid LocalStorage state could not be backed up:",
      error
    );

    return false;
  }
};


/**
 * Creates a fresh default application state.
 */
export const createDefaultState = () => ({
  transactions: [],
  chartMode: "donut",

  cloudMeta: {
    version: 0,
    updatedAt: 0,
    deviceId: null
  },

  localRevision: 0,

  meta: {}
});


/**
 * Validates the structure of locally stored state.
 *
 * This validates the storage contract, not business rules
 * for individual transactions.
 */
const validateState = state => {
  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state)
  ) {
    return false;
  }

  if (!Array.isArray(state.transactions)) {
    return false;
  }

  if (
    state.chartMode !== "pie" &&
    state.chartMode !== "donut"
  ) {
    return false;
  }

  if (
    !state.cloudMeta ||
    typeof state.cloudMeta !== "object" ||
    Array.isArray(state.cloudMeta)
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      Number(state.cloudMeta.version)
    )
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      Number(state.cloudMeta.updatedAt)
    )
  ) {
    return false;
  }

  if (
    state.localRevision !== undefined &&
    (
      !Number.isSafeInteger(
        Number(state.localRevision)
      ) ||
      Number(state.localRevision) < 0
    )
  ) {
    return false;
  }

  if (
    state.meta !== undefined &&
    (
      state.meta === null ||
      typeof state.meta !== "object" ||
      Array.isArray(state.meta)
    )
  ) {
    return false;
  }

  return true;
};


/**
 * Returns the LocalStorage key belonging to
 * the currently active identity.
 */
export const getActiveStorageKey = user => {
  if (!user?.id) {
    return GUEST_STORAGE_KEY;
  }

  return `${USER_STORAGE_PREFIX}${user.id}:state`;
};

const normalizeStoredTransactions = transactions => {
  if (!Array.isArray(transactions)) {
    return {
      transactions: [],
      changed: false
    };
  }

  let changed = false;

  const normalizedTransactions =
    transactions.map(transaction => {
      if (
        !transaction ||
        typeof transaction !== "object"
      ) {
        return transaction;
      }

      const normalizedAmount =
        normalizeAmountByCategory(
          transaction.amount,
          transaction.category
        );

      if (
        normalizedAmount === null ||
        normalizedAmount === transaction.amount
      ) {
        return transaction;
      }

      changed = true;

      return {
        ...transaction,
        amount: normalizedAmount
      };
    });

  return {
    transactions: normalizedTransactions,
    changed
  };
};


/**
 * Loads state for the supplied identity.
 *
 * Invalid or missing state falls back to a fresh
 * default state without changing the storage key.
 */
export const loadState = user => {
  const storageKey =
    getActiveStorageKey(user);

  const stored =
    localStorage.getItem(storageKey);

  if (!stored) {
    return createDefaultState();
  }

  let parsed;

  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    backupInvalidState(
      storageKey,
      stored,
      error?.message ??
        "Invalid JSON"
    );

    console.warn(
      "Invalid LocalStorage JSON; using default state:",
      error
    );

    return createDefaultState();
  }

  const normalizationResult =
    normalizeStoredTransactions(
        parsed.transactions
    );

    const normalizedState = {
        ...parsed,
        transactions:
            normalizationResult.transactions
        };

    if (!validateState(normalizedState)) {
        backupInvalidState(
            storageKey,
            stored,
            "invalid state structure"
        );

        console.warn(
            "Invalid LocalStorage state recovered."
        );

        return createDefaultState();
    }

    const transactionResult =
        sanitizeTransactions(
            normalizationResult.transactions
        );

    if (!transactionResult.valid) {
        console.warn(
            "Invalid transactions found in LocalStorage:",
            transactionResult.invalidTransactions
        );
    }

    const resultState = {
        transactions:
            transactionResult.transactions,

        chartMode:
            parsed.chartMode,

        cloudMeta: {
            version:
            Number(parsed.cloudMeta.version),

            updatedAt:
            Number(parsed.cloudMeta.updatedAt),

            deviceId:
            parsed.cloudMeta.deviceId ?? null
        },

        localRevision:
            Number.isSafeInteger(
            Number(parsed.localRevision)
            ) &&
            Number(parsed.localRevision) >= 0
            ? Number(parsed.localRevision)
            : 0,

        meta:
            parsed.meta ?? {}
    };

    if (normalizationResult.changed) {
        try {
            localStorage.setItem(
            storageKey,
            JSON.stringify(resultState)
            );
        } catch (error) {
            console.warn(
            "Failed to persist normalized transaction amounts:",
            error
            );
        }
    }

    return resultState;
};


/**
 * Saves state for the supplied identity.
 */
export const saveState = (
  state,
  user
) => {
  const storageKey =
    getActiveStorageKey(user);

  if (!validateState(state)) {
    throw new Error(
      "Cannot save invalid expense tracker state."
    );
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify(state)
  );
};


/**
 * Clears only the state belonging to
 * the supplied identity.
 */
export const clearState = user => {
  const storageKey =
    getActiveStorageKey(user);

  localStorage.removeItem(storageKey);
};
