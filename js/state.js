import { pushToCloud } from "./cloud/cloudSync.js";

export let transactions =
  JSON.parse(localStorage.getItem("transactions")) || [];

export let editId = null;
export let activeCategory = null;

export const saveData = async () => {
  localStorage.setItem("transactions", JSON.stringify(transactions));
  try {
    await pushToCloud(transactions);
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
