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
const legendEl = document.getElementById("chartLegend");

// ======================
// STATE
// ======================
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let editId = null;
let slices = [];

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

const getChartColors = () => {
  const styles = getComputedStyle(document.body);
  return [
    styles.getPropertyValue("--chart-1").trim(),
    styles.getPropertyValue("--chart-2").trim(),
    styles.getPropertyValue("--chart-3").trim(),
    styles.getPropertyValue("--chart-4").trim(),
    styles.getPropertyValue("--chart-5").trim()
  ];
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
  legendEl.innerHTML = "";
  slices = [];

  const totals = getCategoryTotals(data);
  const entries = Object.entries(totals);
  if (!entries.length) return;

  const totalAmount = entries.reduce((a, [, v]) => a + v, 0);

  const colors = getChartColors();

  let startAngle = 0;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 120;

  entries.forEach(([category, value], i) => {
    const sliceAngle = (value / totalAmount) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const color = colors[i % colors.length];

    // Draw slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.fillStyle = getComputedStyle(document.body)
      .getPropertyValue("--chart-text")
      .trim();
    ctx.fill();

    // Save slice for hover detection
    slices.push({
      category,
      value,
      startAngle,
      endAngle,
      color
    });

    // Legend
    const percent = ((value / totalAmount) * 100).toFixed(1);
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-color" style="background:${color}"></span>
      ${category}: ${formatMoney(value)} (${percent}%)
    `;
    legendEl.appendChild(item);

    startAngle = endAngle;
  });

  // Center total
  ctx.fillStyle = "#666";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Total", cx, cy - 10);
  ctx.fillText(formatMoney(totalAmount), cx, cy + 10);
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

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - canvas.width / 2;
  const y = e.clientY - rect.top - canvas.height / 2;
  const angle = Math.atan2(y, x);
  const adjustedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
  const distance = Math.sqrt(x * x + y * y);

  canvas.title = "";

  if (distance > 120) return;

  const slice = slices.find(
    s => adjustedAngle >= s.startAngle && adjustedAngle <= s.endAngle
  );

  if (slice) {
    const percent = (
      (slice.value /
        slices.reduce((a, s) => a + s.value, 0)) *
      100
    ).toFixed(1);

    canvas.title = `${slice.category}: ${formatMoney(
      slice.value
    )} (${percent}%)`;
  }
});

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
  init();
});

// Load theme on startup
if (localStorage.getItem("theme") === "dark")
  document.body.classList.add("dark");

init();
