// js/transactionRules.js

export const INCOME_CATEGORIES = new Set([
  "Income",
  "Salary"
]);

export const EXPENSE_CATEGORIES = new Set([
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Rent",
  "Other"
]);

export const VALID_CATEGORIES = new Set([
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES
]);

export const isIncomeCategory = category =>
  INCOME_CATEGORIES.has(category);

export const isExpenseCategory = category =>
  EXPENSE_CATEGORIES.has(category);

/**
 * Converts an entered amount into the canonical
 * signed amount used throughout the application.
 *
 * Income categories  -> positive
 * Expense categories -> negative
 *
 * The user's entered sign is intentionally ignored.
 */
export const normalizeAmountByCategory = (
  amount,
  category
) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return null;
  }

  if (numericAmount === 0) {
    return null;
  }

  if (!VALID_CATEGORIES.has(category)) {
    return null;
  }

  return isIncomeCategory(category)
    ? Math.abs(numericAmount)
    : -Math.abs(numericAmount);
};

export const getCategoryType = category => {
  if (isIncomeCategory(category)) {
    return "income";
  }

  if (isExpenseCategory(category)) {
    return "expense";
  }

  return null;
};

