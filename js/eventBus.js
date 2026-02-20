const listeners = Object.create(null);

export const subscribe = (event, callback) => {
  if (!listeners[event]) {
    listeners[event] = new Set();
  }

  listeners[event].add(callback);

  return () => {
    listeners[event].delete(callback);

    // Clean up empty sets
    if (listeners[event].size === 0) {
      delete listeners[event];
    }
  };
};

export const publish = (event, payload) => {
  const eventListeners = listeners[event];
  if (!eventListeners) return;

  // Clone to avoid mutation issues during iteration
  [...eventListeners].forEach(cb => {
    try {
      cb(payload);
    } catch (error) {
      console.error(`Error in "${event}" listener`, error);
    }
  });
};
