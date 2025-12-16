const balance = document.getElementById("balance");
const income = document.getElementById("income");
const expense = document.getElementById("expense");
const list = document.getElementById("list");
const form = document.getElementById("form");
const text = document.getElementById("text");
const category = document.getElementById("category");
const monthFilter = document.getElementById("month");
const amount = document.getElementById("amount");

// Get data from localStorage
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

// Add transaction
function addTransaction(e) {
  e.preventDefault();

  const transaction = {
    id: Date.now(),
    text: text.value,
    category: category.value,
    amount: +amount.value,
    date: new Date().toISOString(),
  };

  transactions.push(transaction);
  addTransactionToDOM(transaction);
  updateValues();
  updateLocalStorage();

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
    <button onclick="removeTransaction(${transaction.id})">x</button>
  `;

  list.appendChild(item);
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

// Initialize app
function init() {
  list.innerHTML = "";

  const filteredTransactions = getFilteredTransactions();

  filteredTransactions.forEach(addTransactionToDOM);
  updateValues(filteredTransactions);
}

init();
form.addEventListener("submit", addTransaction);
monthFilter.addEventListener("change", init);
