import { transactions, setTransactions } from "./state.js";
import { formatMoney } from "./utils.js";

export const addTransactionToDOM = t => {
  const li = document.createElement("li");

  li.className =
    t.amount < 0
      ? "money minus"
      : "money plus";

  const textContainer =
    document.createElement("div");

  textContainer.className = "list-text";

  const strong =
    document.createElement("strong");

  strong.textContent = t.text;

  const category =
    document.createElement("small");

  category.textContent = ` (${t.category})`;

  textContainer.appendChild(strong);
  textContainer.appendChild(category);

  const amount =
    document.createElement("span");

  amount.className = "list-amount";
  amount.textContent =
    formatMoney(Math.abs(t.amount));

  const buttons =
    document.createElement("div");

  buttons.className = "list-button";

  const editButton =
    document.createElement("button");

  editButton.dataset.edit = t.id;
  editButton.textContent = "✏️";

  const deleteButton =
    document.createElement("button");

  deleteButton.dataset.delete = t.id;
  deleteButton.textContent = "❌";

  buttons.appendChild(editButton);
  buttons.appendChild(deleteButton);

  li.appendChild(textContainer);
  li.appendChild(amount);
  li.appendChild(buttons);

  return li;
};

export const renderList = (listEl, data, addToDOM) => {
  listEl.innerHTML = "";

  if (!data.length) {
    listEl.innerHTML = "<li>No transactions yet</li>";
    return;
  }

  data.forEach(t => {
    listEl.appendChild(addToDOM(t));
  });
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
  tableBody.innerHTML = "";

  const totals = {};

  data
    .filter(t => t.amount < 0)
    .forEach(t => {
      totals[t.category] =
        (totals[t.category] || 0) +
        Math.abs(t.amount);
    });

  Object.entries(totals).forEach(([cat, val]) => {
    const row =
      document.createElement("tr");

    const categoryCell =
      document.createElement("td");

    categoryCell.textContent = cat;

    const amountCell =
      document.createElement("td");

    amountCell.textContent =
      formatMoney(val);

    row.appendChild(categoryCell);
    row.appendChild(amountCell);

    tableBody.appendChild(row);
  });
};

const renderConflict = conflict => {
  const card =
    document.createElement("div");

  card.className = "conflict-card";

  const heading =
    document.createElement("h4");

  heading.textContent =
    conflict.local.text;

  card.appendChild(heading);

  const localLabel =
    document.createElement("label");

  const localInput =
    document.createElement("input");

  localInput.type = "radio";
  localInput.name = conflict.id;
  localInput.value = "local";
  localInput.checked = true;

  localLabel.appendChild(localInput);

  localLabel.append(
    ` Keep this device (${formatMoney(
      conflict.local.amount
    )})`
  );

  const remoteLabel =
    document.createElement("label");

  const remoteInput =
    document.createElement("input");

  remoteInput.type = "radio";
  remoteInput.name = conflict.id;
  remoteInput.value = "remote";

  remoteLabel.appendChild(remoteInput);

  remoteLabel.append(
    ` Use cloud version (${formatMoney(
      conflict.remote.amount
    )})`
  );

  card.appendChild(localLabel);
  card.appendChild(remoteLabel);

  return card;
};

export const showConflictModal = conflicts => {
  const modal = document.getElementById("conflictModal");
  const list = modal.querySelector("#conflictList");

  list.innerHTML = "";

  conflicts.forEach(c => {
    list.appendChild(renderConflict(c));
  });

  modal.hidden = false;
  modal.focus();
};

export const applyConflictResolutions = conflicts => {
  conflicts.forEach(c => {
    const selected = document.querySelector(
      `input[name="${c.id}"]:checked`
    );

    if (!selected) return;

    const choice = selected.value;

    setTransactions(
      transactions.map(t =>
        t.id === c.id
          ? choice === "local"
            ? c.local
            : c.remote
          : t
      )
    );
  });
};

// replacement of applyConflictResolutions()
export const getConflictResolutions = conflicts => {
  return conflicts.flatMap(c => {
    const selected = document.querySelector(
      `input[name="${c.id}"]:checked`
    );

    if (!selected) return [];

    return [{
      id: c.id,
      choice: selected.value
    }];
  });
};

export const updateUndoUI = (
  undoBtn,
  redoBtn,
  { undoLabel, canRedo }
) => {
  if (!undoLabel) {
    undoBtn.disabled = true;
    undoBtn.textContent = "Undo";
  } else {
    undoBtn.disabled = false;
    undoBtn.textContent = undoLabel;
  }

  redoBtn.disabled = !canRedo;
};

