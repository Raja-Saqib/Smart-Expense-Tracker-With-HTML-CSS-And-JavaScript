// ======================
// DOM ELEMENTS
// ======================
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const listEl = document.getElementById("list");
const form = document.getElementById("form");
const textEl = document.getElementById("text");
const amountEl = document.getElementById("amount");
const categoryEl = document.getElementById("category");
const errorEl = document.getElementById("error");
const monthEl = document.getElementById("month");
const clearFilterBtn = document.getElementById("clearFilter");
const exportBtn = document.getElementById("exportCSV");
const themeBtn = document.getElementById("themeBtn");
const tableBody = document.getElementById("categoryTable");
const canvas = document.getElementById("expenseChart");
const ctx = canvas.getContext("2d");

// ======================
// STATE
// ======================
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let editId = null;

// ======================
// UTILITIES
// ======================
const formatMoney = n => `$${n.toLocaleString()}`;

const saveData = () =>
  localStorage.setItem("transactions", JSON.stringify(transactions));

const showError = msg => {
  errorEl.textContent = msg;
  setTimeout(() => (errorEl.textContent = ""), 3000);
};

const getCategoryTotals = data => {
  const totals = {};
  data.filter(t => t.amount < 0).forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });
  return totals;
};

// ======================
// FILTERING
// ======================
const getFiltered = () => {
  if (!monthEl.value) return transactions;
  const [y, m] = monthEl.value.split("-");
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() == y && d.getMonth() + 1 == m;
  });
};

// ======================
// TRANSACTIONS
// ======================
const addTransaction = e => {
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

  editId = null;
  form.querySelector("button").textContent = "Add Transaction";
  saveData();
  form.reset();
  init();
};

const deleteTransaction = id => {
  transactions = transactions.filter(t => t.id !== id);
  saveData();
  init();
};

const editTransaction = id => {
  const t = transactions.find(t => t.id === id);
  if (!t) return;

  textEl.value = t.text;
  amountEl.value = t.amount;
  categoryEl.value = t.category;
  editId = id;
  form.querySelector("button").textContent = "Update Transaction";
};

const addTransactionToDOM = t => {
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

// ======================
// UI RENDERING
// ======================
const renderList = data => {
  listEl.innerHTML = "";
  if (!data.length) {
    listEl.innerHTML = "<li>No transactions yet</li>";
    return;
  }
  data.forEach(addTransactionToDOM);
};

const updateSummary = data => {
  const amounts = data.map(t => t.amount);
  const total = amounts.reduce((a, b) => a + b, 0);
  const income = amounts.filter(a => a > 0).reduce((a, b) => a + b, 0);
  const expense = amounts.filter(a => a < 0).reduce((a, b) => a + b, 0);

  balanceEl.textContent = formatMoney(total);
  incomeEl.textContent = formatMoney(income);
  expenseEl.textContent = formatMoney(Math.abs(expense));
};

const renderCategories = data => {
  tableBody.innerHTML = "";
  const totals = getCategoryTotals(data);

  if (!Object.keys(totals).length) {
    tableBody.innerHTML =
      `<tr><td colspan="2">No expense data</td></tr>`;
    return;
  }

  Object.entries(totals).forEach(([cat, val]) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${cat}</td><td>${formatMoney(val)}</td>`;
    tableBody.appendChild(row);
  });
};

// ======================
// CHART
// ======================
const drawChart = data => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const totals = getCategoryTotals(data);
  const values = Object.values(totals);
  if (!values.length) return;

  let start = 0;
  const sum = values.reduce((a, b) => a + b, 0);
  const colors = ["#ff6384", "#36a2eb", "#ffce56", "#4caf50"];

  values.forEach((v, i) => {
    const slice = (v / sum) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 120, start, start + slice);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    start += slice;
  });
};

// ======================
// CSV EXPORT
// ======================
const exportCSV = data => {
  if (!data.length) return showError("No data to export");

  const rows = [
    ["Description", "Category", "Amount", "Date"],
    ...data.map(t => [
      t.text,
      t.category,
      t.amount,
      new Date(t.date).toLocaleDateString()
    ])
  ];

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
};

// ======================
// INIT
// ======================
const init = () => {
  const data = getFiltered();
  renderList(data);
  updateSummary(data);
  renderCategories(data);
  drawChart(data);
};

// ======================
// EVENTS
// ======================
form.addEventListener("submit", addTransaction);
monthEl.addEventListener("change", init);
clearFilterBtn.addEventListener("click", () => {
  monthEl.value = "";
  init();
});
exportBtn.addEventListener("click", () => exportCSV(getFiltered()));

listEl.addEventListener("click", e => {
  if (e.target.dataset.edit)
    editTransaction(+e.target.dataset.edit);
  if (e.target.dataset.delete)
    deleteTransaction(+e.target.dataset.delete);
});

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
});

// Load theme on startup
if (localStorage.getItem("theme") === "dark")
  document.body.classList.add("dark");

init();
