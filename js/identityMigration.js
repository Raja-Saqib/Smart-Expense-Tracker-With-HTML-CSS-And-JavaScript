import {
  getActiveStorageKey,
  loadState,
  saveState,
  clearState
} from "./localState.js";

export const hasGuestState = () => {
  const guestState =
    loadState(null);

  return (
    guestState.transactions.length > 0
  );
};

export const getStoredState = user => {
  const key =
    getActiveStorageKey(user);

  const raw =
    localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  return loadState(user);
};

export const migrateGuestStateToAccount = async ({
  userId,
  guestState,
  accountState,
  pushAccountState
}) => {
  if (!userId) {
    throw new Error(
      "A userId is required for migration"
    );
  }

  if (!guestState) {
    return {
      migrated: false,
      reason: "no-guest-state"
    };
  }

  /*
   * Do not silently overwrite an existing account.
   */
  if (
    accountState &&
    accountState.transactions.length > 0
  ) {
    return {
      migrated: false,
      reason: "account-already-has-data"
    };
  }

  const candidateState = {
    transactions:
      structuredClone(
        guestState.transactions
      ),

    chartMode:
      guestState.chartMode,

    cloudMeta: {
      version: 0,
      updatedAt: 0,
      deviceId: null
    },

    meta: {
      migration: "guest-to-account"
    }
  };

  /*
   * Account state/cloud must succeed BEFORE
   * guest state is deleted.
   */
  const result =
    await pushAccountState(
      candidateState
    );

  if (!result?.state) {
    throw new Error(
      "Guest migration did not receive authoritative account state"
    );
  }

  /*
   * Save the account-local state only after the
   * cloud operation succeeded.
   */
  saveState(
    result.state,
    { id: userId }
  );

  /*
   * LAST STEP:
   * remove guest state.
   */
  clearState(null);

  return {
    migrated: true,
    state:
      result.state
  };
};
