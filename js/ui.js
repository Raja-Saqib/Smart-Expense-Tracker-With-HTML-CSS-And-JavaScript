import { transactions, setTransactions } from "./state.js";
import { formatMoney } from "./utils.js";
import {
  convertAmount
} from "./exchangeRates.js";
import { DEFAULT_CURRENCY } from "./currency.js";

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

  const description =
    t.text || "No description";

  strong.textContent = description;

  const category =
    document.createElement("small");

  category.textContent = ` (${t.category})`;

  textContainer.appendChild(strong);
  textContainer.appendChild(category);

  const amount =
    document.createElement("span");

  amount.className = "list-amount";
  amount.textContent =
    formatMoney(
      Math.abs(t.amount),
      t.currency
    );

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

const getConvertedAmount = (
  transaction,
  exchangeRateState
) => {
  const currency =
    transaction.currency ??
    DEFAULT_CURRENCY;

  return convertAmount(
    transaction.amount,
    currency,
    exchangeRateState.baseCurrency,
    exchangeRateState.rates
  );
};

export const updateSummary = (
  balanceEl,
  incomeEl,
  expenseEl,
  data,
  exchangeRateState
) => {
  let balance = 0;
  let income = 0;
  let expense = 0;

  data.forEach(transaction => {
    const converted =
      getConvertedAmount(
        transaction,
        exchangeRateState
      );

    if (
      converted === null
    ) {
      return;
    }

    balance += converted;

    if (converted > 0) {
      income += converted;
    }

    if (converted < 0) {
      expense +=
        Math.abs(converted);
    }
  });

  const currency =
    exchangeRateState.baseCurrency;

  balanceEl.textContent =
    formatMoney(
      balance,
      currency
    );

  incomeEl.textContent =
    formatMoney(
      income,
      currency
    );

  expenseEl.textContent =
    formatMoney(
      expense,
      currency
    );
};

export const renderCategories = (
  tableBody,
  data,
  exchangeRateState
) => {
  tableBody.innerHTML = "";

  const totals = {};

  data
    .filter(
      transaction =>
        transaction.amount < 0
    )
    .forEach(transaction => {
      const converted =
        getConvertedAmount(
          transaction,
          exchangeRateState
        );

      if (
        converted === null
      ) {
        return;
      }

      const category =
        transaction.category;

      totals[category] =
        (totals[category] || 0) +
        Math.abs(converted);
    });

  Object.entries(totals)
    .forEach(
      ([category, amount]) => {
        const row =
          document.createElement(
            "tr"
          );

        const categoryCell =
          document.createElement(
            "td"
          );

        categoryCell.textContent =
          category;

        const amountCell =
          document.createElement(
            "td"
          );

        amountCell.textContent =
          formatMoney(
            amount,
            exchangeRateState.baseCurrency
          );

        row.appendChild(
          categoryCell
        );

        row.appendChild(
          amountCell
        );

        tableBody.appendChild(
          row
        );
      }
    );
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
  { undoLabel, redoLabel, canRedo }
) => {
  if (!undoLabel) {
    undoBtn.disabled = true;
    undoBtn.textContent = "Undo";
  } else {
    undoBtn.disabled = false;
    undoBtn.textContent = undoLabel;
  }

  if (!redoLabel) {
    redoBtn.disabled = true;
    redoBtn.textContent = "Redo";
  } else {
    redoBtn.disabled = !canRedo;
    redoBtn.textContent = redoLabel;
  }
};

export const showImportModeModal = () =>
  new Promise(resolve => {
    const overlay =
      document.createElement("div");

    overlay.className =
      "import-mode-overlay";

    overlay.innerHTML = `
      <div
        class="import-mode-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="importModeTitle"
        aria-describedby="importModeDescription"
      >
        <h2 id="importModeTitle">
          Import CSV
        </h2>

        <p id="importModeDescription">
          How would you like to import the CSV data?
        </p>

        <div class="import-mode-options">

          <label>
            <input
              type="radio"
              name="importMode"
              value="merge"
              checked
            />

            <span>
              <strong>Merge</strong>

              <small>
                Add imported transactions to your existing data.
              </small>
            </span>
          </label>

          <label>
            <input
              type="radio"
              name="importMode"
              value="replace"
            />

            <span>
              <strong>Replace All</strong>

              <small>
                Remove existing transactions and use only the imported data.
              </small>
            </span>
          </label>

        </div>

        <div class="import-mode-actions">

          <button
            type="button"
            class="import-cancel-btn"
            data-import-mode="cancel"
          >
            Cancel
          </button>

          <button
            type="button"
            class="import-confirm-btn"
            data-import-mode="confirm"
          >
            Import
          </button>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const modal =
      overlay.querySelector(
        ".import-mode-modal"
      );

    const mergeRadio =
      overlay.querySelector(
        'input[value="merge"]'
      );

    const replaceRadio =
      overlay.querySelector(
        'input[value="replace"]'
      );

    const cancelButton =
      overlay.querySelector(
        '[data-import-mode="cancel"]'
      );

    const confirmButton =
      overlay.querySelector(
        '[data-import-mode="confirm"]'
      );

    const focusableElements = [
      mergeRadio,
      replaceRadio,
      cancelButton,
      confirmButton
    ];

    const cleanup = result => {
      document.removeEventListener(
        "keydown",
        handleKeydown
      );

      overlay.remove();

      resolve(result);
    };

    const handleKeydown = event => {
      /*
       * Escape = Cancel
       */
      if (event.key === "Escape") {
        event.preventDefault();

        cleanup(null);

        return;
      }

      /*
       * Keep keyboard focus inside the modal.
       */
      if (event.key === "Tab") {
        const visibleFocusable =
          focusableElements.filter(
            element =>
              element &&
              !element.disabled &&
              element.offsetParent !== null
          );

        if (!visibleFocusable.length) {
          return;
        }

        const first =
          visibleFocusable[0];

        const last =
          visibleFocusable[
            visibleFocusable.length - 1
          ];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();

          last.focus();

          return;
        }

        if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();

          first.focus();

          return;
        }
      }

      /*
       * Enter = Import
       *
       * Allow normal radio-button keyboard
       * behavior when a radio has focus.
       */
      if (
        event.key === "Enter" &&
        document.activeElement !== mergeRadio &&
        document.activeElement !== replaceRadio
      ) {
        event.preventDefault();

        cleanup(
          replaceRadio.checked
            ? "replace"
            : "merge"
        );
      }
    };

    /*
     * Cancel button
     */
    cancelButton.addEventListener(
      "click",
      () => {
        cleanup(null);
      }
    );

    /*
     * Import button
     */
    confirmButton.addEventListener(
      "click",
      () => {
        cleanup(
          replaceRadio.checked
            ? "replace"
            : "merge"
        );
      }
    );

    /*
     * Clicking the backdrop cancels.
     */
    overlay.addEventListener(
      "click",
      event => {
        if (event.target === overlay) {
          cleanup(null);
        }
      }
    );

    document.addEventListener(
      "keydown",
      handleKeydown
    );

    /*
     * Merge is selected by default.
     */
    mergeRadio.focus();
  });

