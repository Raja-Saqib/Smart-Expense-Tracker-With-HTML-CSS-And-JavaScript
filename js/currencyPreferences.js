import { CLOUD_CONFIG } from "../config.js";

const BASE_CURRENCY_KEY =
  CLOUD_CONFIG.BASE_CURRENCY_KEY;

export const getBaseCurrency = defaultCurrency => {
  const stored =
    localStorage.getItem(BASE_CURRENCY_KEY);

  return stored || defaultCurrency;
};

export const setBaseCurrency = currency => {
  localStorage.setItem(
    BASE_CURRENCY_KEY,
    currency
  );
};

