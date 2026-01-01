const CLOUD_KEY = "expense-tracker-backup";

// Example endpoint (replace later)
const CLOUD_URL = "https://jsonblob.com/api/jsonBlob";

export const pushToCloud = async (transactions, chartChange) => {
  const payload = {
    updatedAt: Date.now(),
    transactions,
    chartChange
  };

  await fetch(CLOUD_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};

export const pullFromCloud = async () => {
  const res = await fetch(CLOUD_URL);
  if (!res.ok) return null;
  return await res.json();
};

export const detectConflicts = (local, remote) => {
  const conflicts = [];

  remote.forEach(r => {
    const l = local.find(t => t.id === r.id);
    if (!l) return;

    if (
      l.updatedAt !== r.updatedAt &&
      l.updatedBy !== r.updatedBy
    ) {
      conflicts.push({
        id: r.id,
        local: l,
        remote: r
      });
    }
  });

  return conflicts;
};

export const autoResolveConflicts = conflicts => {
  const resolved = [];
  const unresolved = [];

  conflicts.forEach(c => {
    const { local, remote } = c;

    // Rule 2: delete wins
    if (!local && remote) {
      resolved.push(remote);
      return;
    }
    if (!remote && local) {
      resolved.push(local);
      return;
    }

    // Rule 1: same category → newer wins
    if (local.category === remote.category) {
      resolved.push(
        local.updatedAt > remote.updatedAt
          ? local
          : remote
      );
      return;
    }

    // Otherwise → unresolved
    unresolved.push(c);
  });

  return { resolved, unresolved };
};
