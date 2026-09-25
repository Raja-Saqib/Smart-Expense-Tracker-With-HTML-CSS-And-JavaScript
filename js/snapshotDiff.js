import {
  compareTransactions,
  compareCloudMeta
} from "./undoCompare.js";

export const diffSnapshots = (prev, next) => {
  const changes = [];

  if (!prev?.state || !next?.state) return changes;

  const a = prev.state;
  const b = next.state;

  if (!compareTransactions(a.transactions, b.transactions)) {
    changes.push("transactions changed");
  }

  if (!compareCloudMeta(a.cloudMeta, b.cloudMeta)) {
    changes.push("cloudMeta changed");
  }

  if (a.chartMode !== b.chartMode) {
    changes.push("chartMode changed");
  }

  return changes;
};
