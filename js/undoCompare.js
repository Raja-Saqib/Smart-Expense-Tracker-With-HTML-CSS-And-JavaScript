const shallowEqual = (a = {}, b = {}) => {
  if (a === b) return true;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(k => {
    const valA = a[k];
    const valB = b[k];

    if (
      typeof valA === "object" &&
      typeof valB === "object"
    ) {
      return JSON.stringify(valA) === JSON.stringify(valB);
    }

    return valA === valB;
  });
};

const compareTransactions = (a = [], b = []) => {
  if (a.length !== b.length) return false;

  const mapA = Object.fromEntries(
    a.map(t => [t.id, t.updatedAt])
  );

  for (const t of b) {
    if (mapA[t.id] !== t.updatedAt) {
      return false;
    }
  }

  return true;
};

export const isUndoStateEqual = (prev, next) => {
  if (!prev?.state || !next?.state) return false;

  return (
    compareTransactions(
      prev.state.transactions,
      next.state.transactions
    ) &&
    shallowEqual(
      prev.state.cloudMeta,
      next.state.cloudMeta
    ) &&
    prev.state.chartMode === next.state.chartMode
  );
};

export { compareTransactions };
export { shallowEqual as compareCloudMeta };
