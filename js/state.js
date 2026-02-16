import { pushToCloud } from "./cloud/cloudSync.js";
import { broadcastState } from "./crossTabSync.js";

export let transactions =
  JSON.parse(localStorage.getItem("transactions")) || [];

export let editId = null;
export let activeCategory = null;

export const saveData = async (
  transactions,
  meta = {}
) => {
  localStorage.setItem(
    "transactions",
    JSON.stringify(transactions)
  );

  try {
    await pushToCloud(transactions, meta);
    return { success: true };
  } catch (e) {
    console.warn("Cloud sync failed, saved locally");
    return { success: false };
  }
};

export const setEditId = id => (editId = id);
export const setTransactions = data => (transactions = data);
export const toggleCategoryFilter = category => {
  activeCategory = activeCategory === category ? null : category;
};

export const addTransaction = async e => {
  e.preventDefault();

  if (!textEl.value || !categoryEl.value || !amountEl.value)
    return showError("All fields are required");

  if (+amountEl.value === 0)
    return showError("Amount cannot be zero");

  const existing = transactions.find(t => t.id === editId);

  // If editing, detect no-op BEFORE creating new object
  if (editId && existing) {
    const isUnchanged =
      existing.text === textEl.value &&
      existing.category === categoryEl.value &&
      existing.amount === +amountEl.value;

    if (isUnchanged) {
      // Reset UI but do nothing else
      editId = null;
      form.querySelector("button").textContent = "Add Transaction";
      
      textEl.value = existing.text;
      amountEl.value = existing.amount;
      categoryEl.value = existing.category;

      chartStatus.textContent = "No changes detected";
      
      return;
    }
  }

  const data = {
    id: editId ?? Date.now(),
    text: textEl.value,
    category: categoryEl.value,
    amount: +amountEl.value,
    date: existing?.date ?? new Date().toISOString(),

    updatedAt: Date.now(),
    updatedBy: deviceId
  };

  // SNAPSHOT BEFORE MUTATION
  pushUndoState(
    createUndoState({
      transactions,
      cloudMeta,
      chartMode,
      label: editId ? "Undo edit" : "Undo add"
    })
  );

  // MUTATE
  transactions = editId
    ? transactions.map(t => (t.id === editId ? data : t))
    : [...transactions, data];

  const result = await saveData(
    transactions,
    editId
      ? {
          type: "edit",
          category: data.category,
          previousCategory: existing?.category
        }
      : {
          type: "add",
          category: data.category
        }
  );

  if (!result.success) {
    chartStatus.textContent = "Saved locally (cloud offline)";
  } else {
    chartStatus.textContent = "Data synced to cloud";
  }

  broadcastState({
    transactions,
    cloudMeta,
    chartMode
  });

  editId = null;
  form.querySelector("button").textContent =
    "Add Transaction";
  form.reset();
  
  init();
};

export const deleteTransaction = async id => {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  // SNAPSHOT BEFORE MUTATION
  pushUndoState(
    createUndoState({
      transactions,
      cloudMeta,
      chartMode,
      label: "Undo delete"
    })
  );

  // MUTATE
  transactions = transactions.filter(tx => tx.id !== id);

  const result = await saveData(transactions, {
    type: "delete",
    category: t.category
  });

  if (!result.success) {
    chartStatus.textContent = "Saved locally (cloud offline)";
  } else {
    chartStatus.textContent = "Data synced to cloud";
  }

  broadcastState({
    transactions,
    cloudMeta,
    chartMode
  });

  init();
};

export const editTransaction = id => {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  textEl.value = t.text;
  amountEl.value = t.amount;
  categoryEl.value = t.category;  
  editId = id;
  form.querySelector("button").textContent = "Update Transaction";
};

export const addTransactionToDOM = t => {
  const li = document.createElement("li");
  li.className = t.amount < 0 ? "minus" : "plus";

  li.innerHTML = `
    <div>
      <strong>${t.text}</strong>
      <small>(${t.category})</small>
    </div>
    <span>${formatMoney(Math.abs(t.amount))}</span>
    <div>
      <button data-edit="${t.id}">✏️</button>
      <button data-delete="${t.id}">❌</button>
    </div>
  `;

  listEl.appendChild(li);
};
