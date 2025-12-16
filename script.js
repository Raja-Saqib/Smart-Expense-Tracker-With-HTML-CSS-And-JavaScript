const balance = document.getElementById("balance");
const income = document.getElementById("income");
const expense = document.getElementById("expense");
const list = document.getElementById("list");
const form = document.getElementById("form");
const text = document.getElementById("text");
const category = document.getElementById("category");
const monthFilter = document.getElementById("month");
const amount = document.getElementById("amount");
const themeBtn = document.getElementById("themeBtn");
const canvas = document.getElementById("expenseChart");
const ctx = canvas.getContext("2d");

let editId = null;

// Get data from localStorage
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

// Load saved theme on startup
function loadTheme() {
  const theme = localStorage.getItem("theme");
  if (theme === "dark") {
    document.body.classList.add("dark");
    themeBtn.textContent = "☀️";
  }
}

// Add transaction
function addTransaction(e) {
  e.preventDefault();

  if (editId !== null) {
    transactions = transactions.map(t =>
      t.id === editId
        ? {
            ...t,
            text: text.value,
            category: category.value,
            amount: +amount.value
          }
        : t
    );
    editId = null;
  } else {
    transactions.push({
      id: Date.now(),
      text: text.value,
      category: category.value,
      amount: +amount.value,
      date: new Date().toISOString()
    });
  }

  updateLocalStorage();
  init(); // re-render list, totals, chart

  text.value = "";
  amount.value = "";
  category.value = "";
}

// Add transaction to DOM
function addTransactionToDOM(transaction) {
  const sign = transaction.amount < 0 ? "-" : "+";
  const item = document.createElement("li");

  item.classList.add(transaction.amount < 0 ? "minus" : "plus");

  item.innerHTML = `
    <div>
      <strong>${transaction.text}</strong>
      <small>(${transaction.category})</small>
    </div> 
    <span>${sign}$${Math.abs(transaction.amount)}</span>
    <div>
      <button onclick="editTransaction(${transaction.id})">✏️</button>
      <button onclick="removeTransaction(${transaction.id})">❌</button>
    </div>
  `;

  list.appendChild(item);
}

function editTransaction(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;

  text.value = transaction.text;
  amount.value = transaction.amount;
  category.value = transaction.category;

  editId = id;
}

// Update balance, income, expense
function updateValues(data = transactions) {
  const amounts = data.map(t => t.amount);

  const total = amounts.reduce((acc, val) => acc + val, 0);
  const incomeTotal = amounts
    .filter(val => val > 0)
    .reduce((a, b) => a + b, 0);

  const expenseTotal = amounts
    .filter(val => val < 0)
    .reduce((a, b) => a + b, 0);

  balance.innerText = `$${total}`;
  income.innerText = `$${incomeTotal}`;
  expense.innerText = `$${Math.abs(expenseTotal)}`;
}

// Remove transaction
function removeTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  updateLocalStorage();
  init();
}

// Update localStorage
function updateLocalStorage() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function getFilteredTransactions() {
  if (!monthFilter.value) return transactions;

  const [year, month] = monthFilter.value.split("-");

  return transactions.filter(t => {
    const tDate = new Date(t.date);
    return (
      tDate.getFullYear() == year &&
      tDate.getMonth() + 1 == month
    );
  });
}

function getCategoryTotals(data) {
  const totals = {};

  data
    .filter(t => t.amount < 0)
    .forEach(t => {
      if (!totals[t.category]) {
        totals[t.category] = 0;
      }
      totals[t.category] += Math.abs(t.amount);
    });

  return totals;
}

function drawChart(data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const totals = getCategoryTotals(data);
  const categories = Object.keys(totals);
  const values = Object.values(totals);

  if (values.length === 0) return;

  const totalAmount = values.reduce((a, b) => a + b, 0);
  let startAngle = 0;

  const colors = [
    "#ff6384",
    "#36a2eb",
    "#ffce56",
    "#4caf50",
    "#9c27b0"
  ];

  values.forEach((value, index) => {
    const sliceAngle = (value / totalAmount) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 120, startAngle, startAngle + sliceAngle);
    ctx.closePath();

    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    startAngle += sliceAngle;
  });
}

// Initialize app
function init() {
  list.innerHTML = "";

  const filteredTransactions = getFilteredTransactions();

  filteredTransactions.forEach(addTransactionToDOM);
  updateValues(filteredTransactions);
  drawChart(filteredTransactions);
  loadTheme();
}

init();
form.addEventListener("submit", addTransaction);
monthFilter.addEventListener("change", init);
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  themeBtn.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});
