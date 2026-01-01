import { transactions, setTransactions, saveData } from "./state.js";
import { getFiltered } from "./filters.js";
import { renderList, updateSummary, renderCategories } from "./ui.js";
import { drawChart } from "./chart.js";
import { attachChartHover } from "./chartHover.js";
import { attachChartClick } from "./chartClick.js";
import { animateThemeTransition } from "./chartAnimations.js";
import { toggleChartMode } from "./chartState.js";
import { initEvents } from "./events.js";
import { pullFromCloud } from "./cloud/cloudSync.js";
import { animateChartTransition } from "./chartAnimations.js";
import { detectConflicts } from "../cloud/cloudSync.js";
import { showConflictModal } from "./ui.js";

// DOM
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const listEl = document.getElementById("list");
const tableBody = document.getElementById("categoryTable");
const form = document.getElementById("form");
const monthEl = document.getElementById("month");
const themeBtn = document.getElementById("themeBtn");
const canvas = document.getElementById("expenseChart");
const ctx = canvas.getContext("2d");
const patternToggle = document.getElementById("patternToggle");
const donutToggle = document.getElementById("donutToggle");
const chartStatus = document.getElementById("chartStatus");
const chartView = document.getElementById("chartView");
const tableView = document.getElementById("tableView");
const viewChartRadio = document.getElementById("viewChart");
const viewTableRadio = document.getElementById("viewTable");

const init = () => {
  const data = getFiltered(transactions, monthEl);
  renderList(listEl, data, addTransactionToDOM);
  updateSummary(balanceEl, incomeEl, expenseEl, data);
  renderCategories(tableBody, data);
  drawChart({
    canvas,
    ctx,
    data,
    legendEl,
    getFiltered,
    formatMoney
  });
  donutToggle.checked = chartMode === "donut";
  patternToggle.checked = patternMode;

  viewChartRadio.checked = viewMode === "chart";
  viewTableRadio.checked = viewMode === "table";

  chartView.hidden = viewMode !== "chart";
  tableView.hidden = viewMode !== "table";
};

initEvents({
  form,
  monthEl,
  listEl,
  themeBtn,
  handlers: {
    init,
    toggleTheme: () => document.body.classList.toggle("dark")
  }
});

toggleBtn.addEventListener("click", () => {
  toggleChartMode();
  init(); 
});

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );

  if (!prefersReducedMotion) {
    animateThemeTransition({
      ctx,
      canvas,
      redraw: () => drawChart({
        canvas,
        ctx,
        data: getFiltered(),
        legendEl,
        getFiltered,
        formatMoney
      })
    });
  } else {
    init();
  }
});

donutToggle.addEventListener("change", () => {
  chartMode = donutToggle.checked ? "donut" : "pie";
  localStorage.setItem("chartMode", chartMode);
  chartStatus.textContent =
    chartMode === "donut"
      ? "Donut chart enabled"
      : "Pie chart enabled";
  init(); // redraw chart
});

patternToggle.addEventListener("change", () => {
  patternMode = patternToggle.checked;
  localStorage.setItem("patternMode", patternMode);
  chartStatus.textContent = patternMode
    ? "Color-blind patterns enabled"
    : "Color-blind patterns disabled";
  init(); // redraw chart + legend
});

const updateViewMode = mode => {
  viewMode = mode;
  localStorage.setItem("viewMode", mode);

  chartView.hidden = mode !== "chart";
  tableView.hidden = mode !== "table";

  chartStatus.textContent =
    mode === "chart"
      ? "Chart view selected"
      : "Table view selected";
};

viewChartRadio.addEventListener("change", () => {
  if (viewChartRadio.checked) updateViewMode("chart");
});

viewTableRadio.addEventListener("change", () => {
  if (viewTableRadio.checked) updateViewMode("table");
});

resolveConflictsBtn.addEventListener("click", () => {
  setPreviousSlices(slices); // snapshot BEFORE merge

  applyConflictChoices(); // updates transactions

  init(); // redraws chart → new slices

  const changed = getChangedCategories(
    previousSlices,
    slices
  );

  if (changed.length) {
    highlightChangedSlices({
      ctx,
      cx: canvas.width / 2,
      cy: canvas.height / 2,
      radius: 120,
      innerRadius: chartMode === "donut" ? 70 : 0,
      slices,
      changedCategories: changed
    });

    chartStatus.textContent =
      `Conflicts resolved. Updated categories: ${changed.join(", ")}`;
  } else {
    chartStatus.textContent =
      "Conflicts resolved with no chart changes";
  }
});

attachChartHover(canvas);
attachChartClick(canvas, getFiltered, init);

(async () => {
  const cloudData = await pullFromCloud();

  const localUpdatedAt =
    JSON.parse(localStorage.getItem("cloudUpdatedAt")) || 0;

  let appliedCloud = false;

  if (
    cloudData &&
    cloudData.transactions &&
    cloudData.updatedAt > localUpdatedAt
  ) {
    // Preserve previous chart state BEFORE overwrite
    setPreviousSlices(slices);

    const conflicts = detectConflicts(
      transactions,
      cloudData.transactions
    );

    const { resolved, unresolved } =
      autoResolveConflicts(conflicts);

    // Apply auto-resolved transactions
    if (resolved.length) {
      resolved.forEach(r => {
        transactions = transactions.map(t =>
          t.id === r.id ? r : t
        );
      });
    }

    if (unresolved.length) {
      showConflictModal(unresolved);
      chartStatus.textContent =
        "Sync conflicts detected. Please resolve.";
      return; // ⛔ STOP normal sync
    }

    transactions = cloudData.transactions;

    localStorage.setItem(
      "transactions",
      JSON.stringify(transactions)
    );
    localStorage.setItem(
      "cloudUpdatedAt",
      cloudData.updatedAt
    );

    setCloudMeta(cloudData.meta);
    appliedCloud = true;
  }

  // Render UI (always)
  init();

  if (appliedCloud && previousSlices?.length && slices.length) {
    const changed = getChangedCategories(
      previousSlices,
      slices
    );

    if (changed.length) {
      highlightChangedSlices({
        ctx,
        cx: canvas.width / 2,
        cy: canvas.height / 2,
        radius: 120,
        innerRadius: chartMode === "donut" ? 70 : 0,
        slices,
        changedCategories: changed
      });

      chartStatus.textContent =
        `Updated categories: ${changed.join(", ")}`;
    } else {
      chartStatus.textContent =
        "Cloud data applied (no chart changes)";
    }
  } else if (appliedCloud) {
    chartStatus.textContent =
      "Data restored from cloud";
  }
})();
