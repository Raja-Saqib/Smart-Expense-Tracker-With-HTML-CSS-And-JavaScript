import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  isSupportedCurrency
} from "./currency.js";

export const formatMoney = (
  amount,
  currency = DEFAULT_CURRENCY
) => {
  const normalizedCurrency =
    isSupportedCurrency(currency)
      ? currency
      : DEFAULT_CURRENCY;

  const {
    locale
  } = CURRENCIES[
    normalizedCurrency
  ];

  return new Intl.NumberFormat(
    locale,
    {
      style: "currency",
      currency: normalizedCurrency
    }
  ).format(Number(amount) || 0);
};

export const showError = (el, msg) => {
  el.textContent = msg;

  setTimeout(
    () => (el.textContent = ""),
    3000
  );
};

