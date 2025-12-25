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
const formatMoney = num => `$${num.toLocaleString()}`;

const saveData = () =>
  localStorage.setItem("transactions", JSON.stringify(transactions));

const showError = msg => {
  errorEl.textContent = msg;
  setTimeout(() => (errorEl.textContent = ""), 3000);
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

  const data = {
    id: editId ?? Date.now(),
    text: textEl.value,
    category: categoryEl.value,
    amount: +amountEl.value,
    date: new Date().toISOString()
  };

  transactions = editId
    ? transactions.map(t => (t.id === editId ? data : t))
    : [...transactions, data];

  editId = null;
  saveData();
  form.reset();
  init();
};

const deleteTransaction = id => {
  transactions = transactions.filter(t => t.id !== id);
  saveData();
  init();
};

// ======================
// UI RENDERING
// ======================
const renderList = data => {
  listEl.innerHTML = "";
  data.forEach(t => {
    const li = document.createElement("li");
    li.className = t.amount < 0 ? "minus" : "plus";
    li.innerHTML = `
      <span>${t.text} (${t.category})</span>
      <span>${formatMoney(Math.abs(t.amount))}</span>
      <button onclick="deleteTransaction(${t.id})">❌</button>
    `;
    listEl.appendChild(li);
  });
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
  const totals = {};
  data.filter(t => t.amount < 0).forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });

  Object.keys(totals).forEach(cat => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${cat}</td><td>${formatMoney(totals[cat])}</td>`;
    tableBody.appendChild(row);
  });
};

// ======================
// CHART
// ======================
const drawChart = data => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const totals = {};
  data.filter(t => t.amount < 0).forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  });

  const values = Object.values(totals);
  if (!values.length) return;

  let start = 0;
  const total = values.reduce((a, b) => a + b, 0);
  const colors = ["#ff6384", "#36a2eb", "#ffce56", "#4caf50"];

  values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 120, start, start + slice);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    start += slice;
  });
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
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
});

// ======================
init();
