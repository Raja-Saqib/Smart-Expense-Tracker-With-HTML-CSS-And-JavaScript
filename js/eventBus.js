const listeners = {};

export const subscribe = (event, callback) => {
  if (!listeners[event]) {
    listeners[event] = new Set();
  }

  listeners[event].add(callback);

  return () => {
    listeners[event].delete(callback);
  };
};

export const publish = (event, payload) => {
  if (!listeners[event]) return;

  for (const cb of listeners[event]) {
    cb(payload);
  }
};
