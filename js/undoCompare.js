const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(k => a[k] === b[k]);
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

const compareSlices = (a = [], b = []) => {
  if (a.length !== b.length) return false;

  const mapA = Object.fromEntries(
    a.map(s => [s.id ?? s.category, s.value])
  );

  for (const s of b) {
    const key = s.id ?? s.category;
    if (mapA[key] !== s.value) {
      return false;
    }
  }

  return true;
};

export const isUndoStateEqual = (prev, next) => {
  if (!prev || !next) return false;

  return (
    compareTransactions(
      prev.data.transactions,
      next.data.transactions
    ) &&
    shallowEqual(
      prev.data.cloudMeta,
      next.data.cloudMeta
    ) &&
    prev.chart.chartMode === next.chart.chartMode &&
    compareSlices(
      prev.chart.slices,
      next.chart.slices
    )
  );
};
