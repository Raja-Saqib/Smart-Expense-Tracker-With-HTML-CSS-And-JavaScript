export const deepFreeze = obj => {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);

    Object.keys(obj).forEach(key => {
      deepFreeze(obj[key]);
    });
  }

  return obj;
};

export const isDev =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";
