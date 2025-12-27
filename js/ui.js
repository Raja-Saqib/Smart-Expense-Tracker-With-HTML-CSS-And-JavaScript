import { formatMoney } from "./utils.js";

export const renderList = (listEl, data, addToDOM) => {
  listEl.innerHTML = "";
  if (!data.length) {
    listEl.innerHTML = "<li>No transactions yet</li>";
    return;
  }
  data.forEach(addToDOM);
};

export const updateSummary = (balanceEl, incomeEl, expenseEl, data) => {
  const amounts = data.map(t => t.amount);
  const total = amounts.reduce((a, b) => a + b, 0);
  const income = amounts.filter(a => a > 0).reduce((a, b) => a + b, 0);
  const expense = amounts.filter(a => a < 0).reduce((a, b) => a + b, 0);

  balanceEl.textContent = formatMoney(total);
  incomeEl.textContent = formatMoney(income);
  expenseEl.textContent = formatMoney(Math.abs(expense));
};

export const renderCategories = (tableBody, data) => {
  tableBody.innerHTML = {};
  const totals = {};

  data.filter(t => t.amount < 0).forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });

  Object.entries(totals).forEach(([cat, val]) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${cat}</td><td>${formatMoney(val)}</td>`;
    tableBody.appendChild(row);
  });
};
