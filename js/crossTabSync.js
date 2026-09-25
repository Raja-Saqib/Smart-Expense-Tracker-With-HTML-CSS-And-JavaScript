import { CLOUD_CONFIG } from "../config.js";

import {
  getCachedAuthenticatedUser
} from "./auth.js";

import {
  getActiveStorageKey
} from "./localState.js";

const CHANNEL_NAME =
  CLOUD_CONFIG.CHANNEL_NAME;

const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(
        CHANNEL_NAME
      )
    : null;

let listener = null;

/**
 * Whether BroadcastChannel is available.
 */
export const isBroadcastAvailable =
  () => channel !== null;

/**
 * Create the identity-aware state event
 * used by BroadcastChannel.
 */
const createStateEvent = state => {
  const currentUser =
    getCachedAuthenticatedUser();

  const storageKey =
    getActiveStorageKey(
      currentUser
    );

  const userId =
    currentUser?.id ?? null;

  const version =
    Number.isSafeInteger(
      state?.cloudMeta?.version
    ) &&
    state.cloudMeta.version >= 0
      ? state.cloudMeta.version
      : 0;

  const localRevision =
    Number.isSafeInteger(
      state?.localRevision
    ) &&
    state.localRevision >= 0
      ? state.localRevision
      : 0;

  return {
    storageKey,
    userId,
    version,
    localRevision,

    state: {
      transactions:
        structuredClone(
          state.transactions
        ),

      chartMode:
        state.chartMode,

      cloudMeta:
        structuredClone(
          state.cloudMeta
        ),

      localRevision,

      meta:
        structuredClone(
          state.meta ?? {}
        )
    }
  };
};

/**
 * Broadcast an identity-aware state update
 * to other tabs.
 */
export const broadcastState = state => {
  if (!channel) {
    return;
  }

  const event =
    createStateEvent(state);

  channel.postMessage({
    type: "STATE_UPDATE",
    payload: event
  });
};

/**
 * Listen for cross-tab updates.
 */
export const listenToBroadcast =
  callback => {
    if (!channel) {
      return;
    }

    listener = event => {
      if (
        event.data?.type !==
        "STATE_UPDATE"
      ) {
        return;
      }

      callback(
        event.data.payload
      );
    };

    channel.addEventListener(
      "message",
      listener
    );
  };

/**
 * Cleanup.
 */
export const stopListening = () => {
  if (
    !channel ||
    !listener
  ) {
    return;
  }

  channel.removeEventListener(
    "message",
    listener
  );

  listener = null;
};
