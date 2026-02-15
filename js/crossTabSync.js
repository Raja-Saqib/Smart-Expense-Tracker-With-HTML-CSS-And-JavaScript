const CHANNEL_NAME = "expense-tracker-app-sync";

const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

let listener = null;

/**
 * Broadcast state change to other tabs
 */
export const broadcastState = payload => {
  if (!channel) return;

  channel.postMessage({
    type: "STATE_UPDATE",
    payload
  });
};

/**
 * Listen for cross-tab updates
 */
export const listenToBroadcast = callback => {
  if (!channel) return;

  listener = event => {
    if (event.data?.type === "STATE_UPDATE") {
      callback(event.data.payload);
    }
  };

  channel.addEventListener("message", listener);
};

/**
 * Cleanup
 */
export const stopListening = () => {
  if (!channel || !listener) return;
  channel.removeEventListener("message", listener);
};
