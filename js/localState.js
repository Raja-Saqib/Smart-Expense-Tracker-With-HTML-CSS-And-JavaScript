// js/localState.js

const GUEST_STORAGE_KEY =
  "expenseTracker:guest:state";

const USER_STORAGE_PREFIX =
  "expenseTracker:user:";


/**
 * Returns the LocalStorage key belonging to
 * the currently active identity.
 *
 * Guest:
 *   expenseTracker:guest:state
 *
 * Authenticated user:
 *   expenseTracker:user:<userId>:state
 */
export const getActiveStorageKey = user => {
  if (!user?.id) {
    return GUEST_STORAGE_KEY;
  }

  return `${USER_STORAGE_PREFIX}${user.id}:state`;
};


/**
 * Loads the state belonging to the supplied user.
 *
 * If no user is supplied, Guest state is loaded.
 *
 * Returns:
 *   parsed state object, or null if no state exists.
 */
export const loadState = user => {
  const storageKey =
    getActiveStorageKey(user);

  const storedState =
    localStorage.getItem(storageKey);

  if (!storedState) {
    return null;
  }

  try {
    return JSON.parse(storedState);
  } catch (error) {
    console.warn(
      `Failed to parse LocalStorage state for "${storageKey}":`,
      error
    );

    return null;
  }
};


/**
 * Saves state belonging to the supplied user.
 *
 * If no user is supplied, the state is saved
 * to the Guest namespace.
 */
export const saveState = (
  state,
  user
) => {
  const storageKey =
    getActiveStorageKey(user);

  localStorage.setItem(
    storageKey,
    JSON.stringify(state)
  );
};


/**
 * Clears only the state belonging to the
 * supplied user.
 *
 * No user:
 *   clears Guest state only.
 *
 * User A:
 *   clears Account A state only.
 *
 * User B:
 *   clears Account B state only.
 */
export const clearState = user => {
  const storageKey =
    getActiveStorageKey(user);

  localStorage.removeItem(storageKey);
};
