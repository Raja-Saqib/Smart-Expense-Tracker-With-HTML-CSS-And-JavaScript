// js/localState.js

import { sanitizeTransactions } from "./stateValidator";

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

  try {
    const parsed =
      JSON.parse(stored);

    const snapshot = {
      state: parsed
    };

    validateSnapshot(snapshot);

    // return parsed;
  } catch (error) {
    backupInvalidState(
      storageKey,
      stored,
      error?.message ??
        "Invalid state"
    );

    console.warn(
      "Invalid LocalStorage state; using default state:",
      error
    );

    return createDefaultState();
  }

  if (!validateState(parsed)) {
    console.warn(
      `Invalid state structure in LocalStorage key "${storageKey}". Using default state.`
    );

    return createDefaultState();
  }

  const transactionResult =
    sanitizeTransactions(
        parsed.transactions
    );

  if (!transactionResult.valid) {
    console.warn(
        "Invalid transactions found in LocalStorage:",
        transactionResult.invalidTransactions
    );
  }

  return {
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

    meta:
      parsed.meta ?? {}
  };
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
