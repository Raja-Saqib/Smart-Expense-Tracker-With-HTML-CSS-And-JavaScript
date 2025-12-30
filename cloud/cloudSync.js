const CLOUD_KEY = "expense-tracker-backup";

// Example endpoint (replace later)
const CLOUD_URL = "https://jsonblob.com/api/jsonBlob";

export const pushToCloud = async transactions => {
  const payload = {
    updatedAt: Date.now(),
    transactions
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
