// js/localState.js

const GUEST_STORAGE_KEY =
  "expenseTracker:guest:state";

const USER_STORAGE_PREFIX =
  "expenseTracker:user:";


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

  const storedState =
    localStorage.getItem(storageKey);

  if (!storedState) {
    return createDefaultState();
  }

  let parsedState;

  try {
    parsedState =
      JSON.parse(storedState);
  } catch (error) {
    console.warn(
      `Invalid JSON in LocalStorage key "${storageKey}". Using default state.`,
      error
    );

    return createDefaultState();
  }

  if (!validateState(parsedState)) {
    console.warn(
      `Invalid state structure in LocalStorage key "${storageKey}". Using default state.`
    );

    return createDefaultState();
  }

  return {
    transactions:
      parsedState.transactions,

    chartMode:
      parsedState.chartMode,

    cloudMeta: {
      version:
        Number(parsedState.cloudMeta.version),

      updatedAt:
        Number(parsedState.cloudMeta.updatedAt),

      deviceId:
        parsedState.cloudMeta.deviceId ?? null
    },

    meta:
      parsedState.meta ?? {}
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
