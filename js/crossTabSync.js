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
const createStateEvent = ({
  transactions,
  cloudMeta,
  chartMode,
  meta = {}
}) => {
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
      cloudMeta?.version
    ) &&
    cloudMeta.version >= 0
      ? cloudMeta.version
      : 0;

  return {
    storageKey,

    userId,

    version,

    state: {
      transactions:
        structuredClone(
          transactions
        ),

      chartMode,

      cloudMeta:
        structuredClone(
          cloudMeta
        ),

      meta:
        structuredClone(
          meta
        )
    }
  };
};

/**
 * Broadcast an identity-aware state update
 * to other tabs.
 */
export const broadcastState = ({
  transactions,
  cloudMeta,
  chartMode,
  meta = {}
}) => {
  if (!channel) {
    return;
  }

  const event =
    createStateEvent({
      transactions,
      cloudMeta,
      chartMode,
      meta
    });

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
