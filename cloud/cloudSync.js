const CLOUD_KEY = "expense-tracker-backup";

// Example endpoint (replace later)
const CLOUD_URL = "https://jsonblob.com/api/jsonBlob";

export const pushToCloud = async ({
  transactions,
  cloudMeta,
  chartMode,
  deviceId,
  meta = {}
}) => {
  const payload = {
    version: (cloudMeta?.version ?? 0) + 1,
    updatedAt: Date.now(),
    updatedBy: deviceId,
    transactions,
    chartMode,
    meta
  };

  const res = await fetch(CLOUD_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = new Error(
      `Cloud push failed: HTTP ${res.status}`
    );

    error.status = res.status;

    throw error;
  }

  return payload;
};

export const pullFromCloud = async () => {
  try {
    const res = await fetch(CLOUD_URL);

    if (!res.ok) {
      console.warn(
        `Cloud pull failed: HTTP ${res.status}`
      );

      return null;
    }

    const data = await res.json();

    if (
      !data?.transactions ||
      !Array.isArray(data.transactions)
    ) {
      console.warn(
        "Invalid cloud data shape"
      );

      return null;
    }

    return data;

  } catch (error) {
    console.warn(
      "Cloud pull unavailable:",
      error
    );

    return null;
  }
};

export const detectConflicts = (
  local,
  remote
) => {
  const conflicts = [];

  const localMap = new Map(local.map(t => [t.id, t]));

  for (const r of remote) {
    const l = localMap.get(r.id);

    if (!l) continue;

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
  }

  return conflicts;
};

export const autoResolveConflicts = conflicts => {
  const resolved = [];
  const unresolved = [];

  for (const c of conflicts) {
    const { local, remote } = c;

    if (local.category === remote.category) {
      resolved.push(
        local.updatedAt > remote.updatedAt
          ? local
          : remote
      );
    } else {
      unresolved.push(c);
    }
  }

  return { resolved, unresolved };
};
