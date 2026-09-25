export const DEFAULT_CURRENCY = "USD";

export const CURRENCIES = {
  USD: {
    code: "USD",
    name: "US Dollar",
    locale: "en-US"
  },

  EUR: {
    code: "EUR",
    name: "Euro",
    locale: "de-DE"
  },

  GBP: {
    code: "GBP",
    name: "British Pound",
    locale: "en-GB"
  },

  PKR: {
    code: "PKR",
    name: "Pakistani Rupee",
    locale: "en-PK"
  },

  INR: {
    code: "INR",
    name: "Indian Rupee",
    locale: "en-IN"
  },

  JPY: {
    code: "JPY",
    name: "Japanese Yen",
    locale: "ja-JP"
  },

  CNY: {
    code: "CNY",
    name: "Chinese Yuan",
    locale: "zh-CN"
  },

  CAD: {
    code: "CAD",
    name: "Canadian Dollar",
    locale: "en-CA"
  },

  AUD: {
    code: "AUD",
    name: "Australian Dollar",
    locale: "en-AU"
  }
};

export const isSupportedCurrency = currency =>
  typeof currency === "string" &&
  Object.prototype.hasOwnProperty.call(
    CURRENCIES,
    currency
  );

