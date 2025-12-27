export let transactions =
  JSON.parse(localStorage.getItem("transactions")) || [];

export let editId = null;

export const saveData = () =>
  localStorage.setItem("transactions", JSON.stringify(transactions));

export const setEditId = id => (editId = id);
export const setTransactions = data => (transactions = data);
