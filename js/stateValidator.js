export const validateSnapshot = snapshot => {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Invalid snapshot object");
  }

  if (!snapshot.state || typeof snapshot.state !== "object") {
    throw new Error("Invalid snapshot.state");
  }

  const { transactions, cloudMeta, chartMode } = snapshot.state;

  if (!Array.isArray(transactions)) {
    throw new Error("Invalid transactions array");
  }

  if (!cloudMeta || typeof cloudMeta !== "object") {
    throw new Error("Invalid cloudMeta object");
  }

  if (typeof chartMode !== "string") {
    throw new Error("Invalid chartMode");
  }

  return true;
};
