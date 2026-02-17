export const validateSnapshot = snapshot => {
  if (!snapshot || typeof snapshot !== "object")
    throw new Error("Invalid snapshot");

  if (!Array.isArray(snapshot.state.transactions))
    throw new Error("Invalid transactions array");

  if (typeof snapshot.state.cloudMeta !== "object")
    throw new Error("Invalid cloudMeta");

  if (typeof snapshot.state.chartMode !== "string")
    throw new Error("Invalid chartMode");

  return true;
};
