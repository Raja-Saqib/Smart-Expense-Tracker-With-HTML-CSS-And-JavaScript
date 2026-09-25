import {
  isSupportedCurrency
} from "./currency.js";

import {
  VALID_CATEGORIES,
  isIncomeCategory,
  isExpenseCategory
} from "./transactionRules.js";

const REQUIRED_TRANSACTION_FIELDS = new Set([
  "id",
  "text",
  "category",
  "amount",
  "date",
  "updatedAt",
  "updatedBy"
]);

const TRANSACTION_FIELDS = new Set([
  ...REQUIRED_TRANSACTION_FIELDS,
  "currency"
]);

const MAX_TEXT_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 50;

const hasOwn = (object, property) =>
  Object.prototype.hasOwnProperty.call(
    object,
    property
  );

const isStrictISODateString = value => {
  if (typeof value !== "string") {
    return false;
  }

  const pattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (!pattern.test(value)) {
    return false;
  }

  const timestamp =
    Date.parse(value);

  return Number.isFinite(timestamp);
};


/**
 * Validate one transaction.
 */
export const validateTransaction = transaction => {
  const errors = {};

  // --------------------------------------------------
  // Root object
  // --------------------------------------------------

  if (
    !transaction ||
    typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    return {
      valid: false,
      errors: {
        transaction:
          "Transaction must be an object"
      }
    };
  }

  // --------------------------------------------------
  // Required fields
  // --------------------------------------------------

  for (
    const field of REQUIRED_TRANSACTION_FIELDS
  ) {
    if (!hasOwn(transaction, field)) {
      errors[field] =
        "Required transaction field is missing";
    }
  }

  // --------------------------------------------------
  // Unknown fields
  // --------------------------------------------------

  for (const key of Object.keys(transaction)) {
    if (!TRANSACTION_FIELDS.has(key)) {
      errors[key] =
        "Unknown transaction field";
    }
  }

  // --------------------------------------------------
  // id
  // --------------------------------------------------

  if (
    hasOwn(transaction, "id") &&
    (
      !Number.isSafeInteger(transaction.id) ||
      transaction.id < 0
    )
  ) {
    errors.id =
      "id must be a non-negative safe integer";
  }

  // --------------------------------------------------
  // text
  // --------------------------------------------------

  if (hasOwn(transaction, "text")) {
    if (typeof transaction.text !== "string") {
      errors.text =
        "text must be a string";
    } else if (
      transaction.text.length >
      MAX_TEXT_LENGTH
    ) {
      errors.text =
        `text must not exceed ${MAX_TEXT_LENGTH} characters`;
    }
  }

  // --------------------------------------------------
  // category
  // --------------------------------------------------

  if (hasOwn(transaction, "category")) {
    if (
      typeof transaction.category !== "string"
    ) {
      errors.category =
        "category must be a string";
    } else if (
      transaction.category.trim() === ""
    ) {
      errors.category =
        "category must not be empty";
    } else if (
      transaction.category.length >
      MAX_CATEGORY_LENGTH
    ) {
      errors.category =
        `category must not exceed ${MAX_CATEGORY_LENGTH} characters`;
    } else if (
      !VALID_CATEGORIES.has(
        transaction.category
      )
    ) {
      errors.category =
        "category is not an allowed transaction category";
    }
  }

  // --------------------------------------------------
  // currency
  // --------------------------------------------------

  if (hasOwn(transaction, "currency")) {
    if (
      typeof transaction.currency !== "string" ||
      !isSupportedCurrency(transaction.currency)
    ) {
      errors.currency =
        "currency must be a supported currency code";
    }
  }

  // --------------------------------------------------
  // amount
  // --------------------------------------------------

  if (hasOwn(transaction, "amount")) {
    if (
      typeof transaction.amount !== "number" ||
      !Number.isFinite(transaction.amount)
    ) {
      errors.amount =
        "amount must be a finite number";
    } else if (
      transaction.amount === 0
    ) {
      errors.amount =
        "amount cannot be zero";
    } else if (
      typeof transaction.category === "string" &&
      VALID_CATEGORIES.has(transaction.category)
    ) {
      if (
        isIncomeCategory(transaction.category) &&
        transaction.amount <= 0
      ) {
        errors.amount =
          "income transactions must have a positive amount";
      }

      if (
        isExpenseCategory(transaction.category) &&
        transaction.amount >= 0
      ) {
        errors.amount =
          "expense transactions must have a negative amount";
      }
    }
  }

  // --------------------------------------------------
  // date
  // --------------------------------------------------

  if (hasOwn(transaction, "date")) {
    if (
      !isStrictISODateString(
        transaction.date
      )
    ) {
      errors.date =
        "date must be a valid ISO-8601 UTC timestamp";
    }
  }

  // --------------------------------------------------
  // updatedAt
  // --------------------------------------------------

  if (hasOwn(transaction, "updatedAt")) {
    if (
      !Number.isSafeInteger(
        transaction.updatedAt
      ) ||
      transaction.updatedAt < 0
    ) {
      errors.updatedAt =
        "updatedAt must be a non-negative safe integer";
    }
  }

  // --------------------------------------------------
  // updatedBy
  // --------------------------------------------------

  if (hasOwn(transaction, "updatedBy")) {
    if (
      typeof transaction.updatedBy !== "string" ||
      transaction.updatedBy.trim() === ""
    ) {
      errors.updatedBy =
        "updatedBy must be a non-empty string";
    }
  }

  // --------------------------------------------------
  // Timestamp consistency
  // --------------------------------------------------

  if (
    !errors.date &&
    !errors.updatedAt
  ) {
    const dateTimestamp =
      Date.parse(transaction.date);

    if (
      transaction.updatedAt <
      dateTimestamp
    ) {
      errors.updatedAt =
        "updatedAt cannot be earlier than transaction date";
    }
  }

  return {
    valid:
      Object.keys(errors).length === 0,
    errors
  };
};


/**
 * Validate the complete transaction array.
 */
export const validateTransactions = transactions => {
  if (!Array.isArray(transactions)) {
    return {
      valid: false,
      errors: {
        transactions:
          "transactions must be an array"
      }
    };
  }

  const errors = {};
  const ids = new Map();

  transactions.forEach(
    (transaction, index) => {
      const result =
        validateTransaction(transaction);

      if (!result.valid) {
        errors[index] =
          result.errors;
      }

      if (
        transaction &&
        typeof transaction === "object" &&
        Number.isSafeInteger(transaction.id)
      ) {
        if (ids.has(transaction.id)) {
          const firstIndex =
            ids.get(transaction.id);

          errors[index] ??= {};

          errors[index].id =
            `Duplicate transaction ID; first used at index ${firstIndex}`;
        } else {
          ids.set(
            transaction.id,
            index
          );
        }
      }
    }
  );

  return {
    valid:
      Object.keys(errors).length === 0,
    errors
  };
};


/**
 * Validate application snapshot.
 */
export const validateSnapshot = snapshot => {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  ) {
    throw new Error(
      "Invalid snapshot object"
    );
  }

  if (
    !snapshot.state ||
    typeof snapshot.state !== "object" ||
    Array.isArray(snapshot.state)
  ) {
    throw new Error(
      "Invalid snapshot.state"
    );
  }

  const {
    transactions,
    cloudMeta,
    chartMode
  } = snapshot.state;

  const transactionResult =
    validateTransactions(
      transactions
    );

  if (!transactionResult.valid) {
    throw new Error(
      `Invalid transactions: ${JSON.stringify(
        transactionResult.errors
      )}`
    );
  }

  if (
    !cloudMeta ||
    typeof cloudMeta !== "object" ||
    Array.isArray(cloudMeta)
  ) {
    throw new Error(
      "Invalid cloudMeta object"
    );
  }

  if (
    typeof chartMode !== "string"
  ) {
    throw new Error(
      "Invalid chartMode"
    );
  }

  if (
    chartMode !== "pie" &&
    chartMode !== "donut"
  ) {
    throw new Error(
      'chartMode must be either "pie" or "donut"'
    );
  }

  return true;
};

export const sanitizeTransactions = transactions => {
  if (!Array.isArray(transactions)) {
    return {
      transactions: [],
      invalidTransactions: [],
      valid: false
    };
  }

  const validTransactions = [];
  const invalidTransactions = [];

  const ids = new Map();

  transactions.forEach((transaction, index) => {
    const result =
      validateTransaction(transaction);

    if (!result.valid) {
      invalidTransactions.push({
        index,
        transaction,
        errors: result.errors
      });

      return;
    }

    if (ids.has(transaction.id)) {
      invalidTransactions.push({
        index,
        transaction,
        errors: {
          id:
            `Duplicate transaction ID; first used at index ${ids.get(transaction.id)}`
        }
      });

      return;
    }

    ids.set(
      transaction.id,
      index
    );

    validTransactions.push(transaction);
  });

  return {
    transactions: validTransactions,
    invalidTransactions,
    valid:
      invalidTransactions.length === 0
  };
};
