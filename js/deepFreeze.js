export const deepFreeze = obj => {
  if (
    obj &&
    typeof obj === "object" &&
    !Object.isFrozen(obj)
  ) {
    Object.freeze(obj);

    Object.keys(obj).forEach(key => {
      const value = obj[key];

      // Prevent freezing DOM nodes accidentally
      if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) {
        return;
      }

      deepFreeze(value);
    });
  }

  return obj;
};

export const isDev =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" ||
    location.hostname === "127.0.0.1");
