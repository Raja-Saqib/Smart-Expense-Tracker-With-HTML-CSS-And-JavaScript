import { pushToCloud } from "./cloud/cloudSync.js";

export let transactions =
  JSON.parse(localStorage.getItem("transactions")) || [];

export let editId = null;
export let activeCategory = null;

export const saveData = async (meta = {}) => {
  localStorage.setItem("transactions", JSON.stringify(transactions));
  try {
    await pushToCloud(transactions, meta);
    chartStatus.textContent = "Data synced to cloud";
  } catch (e) {
    console.warn("Cloud sync failed, saved locally");
  }
};

export const setEditId = id => (editId = id);
export const setTransactions = data => (transactions = data);
export const toggleCategoryFilter = category => {
  activeCategory = activeCategory === category ? null : category;
};

export const addTransaction = e => {
  e.preventDefault();

  if (!textEl.value || !categoryEl.value || !amountEl.value)
    return showError("All fields are required");

  if (+amountEl.value === 0)
    return showError("Amount cannot be zero");

  const existing = transactions.find(t => t.id === editId);

  const data = {
    id: editId ?? Date.now(),
    text: textEl.value,
    category: categoryEl.value,
    amount: +amountEl.value,
    date: existing?.date ?? new Date().toISOString()
  };

  transactions = editId
    ? transactions.map(t => (t.id === editId ? data : t))
    : [...transactions, data];

  saveData(
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

  editId = null;
  form.querySelector("button").textContent =
    "Add Transaction";
  form.reset();
  init();
};

export const deleteTransaction = id => {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  transactions = transactions.filter(tx => tx.id !== id);

  saveData({
    type: "delete",
    category: t.category
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
