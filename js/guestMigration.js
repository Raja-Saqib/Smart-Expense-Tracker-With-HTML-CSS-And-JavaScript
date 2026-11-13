// js/guestMigration.js

import {
  loadState,
  saveState,
  clearState,
  getActiveStorageKey
} from "./localState.js";

import {
  pushToCloud
} from "../cloud/cloudSync.js";

import {
  getCachedAuthenticatedUser
} from "./auth.js";

import {
  deviceId
} from "./deviceIdentity.js";


const hasGuestData = state => {
  if (!state) {
    return false;
  }

  return (
    Array.isArray(state.transactions) &&
    state.transactions.length > 0
  );
};


export const migrateGuestStateToAccount = async user => {
  if (!user?.id) {
    throw new Error(
      "Guest migration requires an authenticated account."
    );
  }

  const guestState =
    loadState(null);

  if (!hasGuestData(guestState)) {
    return {
      migrated: false,
      reason: "NO_GUEST_DATA"
    };
  }

  const guestSnapshot =
    structuredClone(guestState);

  const accountState =
    structuredClone(guestSnapshot);

  const cloudMeta =
    accountState.cloudMeta ?? {
      version: 0,
      updatedAt: 0,
      deviceId: null
    };

  let cloudState;

  /*
   * Phase 1:
   * Save the guest snapshot to the authenticated
   * account's Supabase row.
   *
   * Guest state is untouched here.
   */
  try {
    cloudState =
      await pushToCloud({
        userId: user.id,
        transactions:
          accountState.transactions,
        cloudMeta,
        chartMode:
          accountState.chartMode,
        deviceId,
        meta:
          accountState.meta ?? {}
      });
  } catch (error) {
    console.warn(
      "Guest migration cloud save failed:",
      error
    );

    return {
      migrated: false,
      rolledBack: true,
      reason: "CLOUD_SAVE_FAILED",
      error
    };
  }

  /*
   * Phase 2:
   * Save the same migrated state under the
   * authenticated account's local namespace.
   */
  const migratedAccountState = {
    ...accountState,
    cloudMeta: {
      version:
        cloudState.version,
      updatedAt:
        cloudState.updatedAt,
      deviceId:
        cloudState.updatedBy
    }
  };

  try {
    saveState(
      migratedAccountState,
      user
    );
  } catch (error) {
    console.error(
      "Account LocalStorage save failed after cloud save:",
      error
    );

    /*
     * The cloud row now contains the migrated data.
     * Do not clear Guest state.
     *
     * Guest data remains available for recovery.
     */
    return {
      migrated: false,
      rolledBack: false,
      reason: "ACCOUNT_LOCAL_SAVE_FAILED",
      cloudSaved: true,
      error
    };
  }

  /*
   * Phase 3:
   * Clear Guest state only after both saves succeed.
   */
  try {
    clearState(null);
  } catch (error) {
    console.error(
      "Guest state cleanup failed:",
      error
    );

    /*
     * Account and cloud data are already safe.
     * Keeping Guest state is safer than deleting it.
     */
    return {
      migrated: true,
      rolledBack: false,
      reason: "GUEST_CLEANUP_FAILED",
      guestStillPresent: true,
      error
    };
  }

  return {
    migrated: true,
    rolledBack: false,
    reason: "SUCCESS",
    cloudSaved: true,
    accountSaved: true,
    guestCleared: true
  };
};
