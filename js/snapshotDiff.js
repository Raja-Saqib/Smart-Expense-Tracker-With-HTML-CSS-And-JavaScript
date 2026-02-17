export const diffSnapshots = (prev, next) => {
  const changes = [];

  if (!prev || !next) return changes;

  if (
    JSON.stringify(prev.state.transactions) !==
    JSON.stringify(next.state.transactions)
  ) {
    changes.push("transactions changed");
  }

  if (
    JSON.stringify(prev.state.cloudMeta) !==
    JSON.stringify(next.state.cloudMeta)
  ) {
    changes.push("cloudMeta changed");
  }

  if (
    prev.state.chartMode !== next.state.chartMode
  ) {
    changes.push("chartMode changed");
  }

  return changes;
};
