import { 
  CLOUD_CONFIG 
} from "../config.js";
import {
  isSupportedCurrency
} from "./currency.js";

const API_BASE =
  CLOUD_CONFIG.API_BASE;

const CACHE_KEY =
  CLOUD_CONFIG.CACHE_KEY;

const CACHE_TTL =
  60 * 60 * 1000; // 1 hour

const normalizeCurrency = currency =>
  String(currency ?? "")
    .trim()
    .toUpperCase();

const readCache = () => {
  try {
    const raw =
      localStorage.getItem(
        CACHE_KEY
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeCache = cache => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(cache)
    );
  } catch {
    // Cache failure should never
    // break the application.
  }
};

const isFreshCache = cache => {
  if (!cache) {
    return false;
  }

  if (
    typeof cache.fetchedAt !==
    "number"
  ) {
    return false;
  }

  return (
    Date.now() -
      cache.fetchedAt <
    CACHE_TTL
  );
};

export const fetchExchangeRates =
  async (
    baseCurrency,
    currencies
  ) => {
    const base =
      normalizeCurrency(
        baseCurrency
      );

    if (
      !isSupportedCurrency(base)
    ) {
      throw new Error(
        `Unsupported base currency: ${base}`
      );
    }

    const uniqueCurrencies = [
      ...new Set(
        currencies
          .map(normalizeCurrency)
          .filter(currency =>
            isSupportedCurrency(
              currency
            )
          )
      )
    ].filter(
      currency =>
        currency !== base
    );

    /*
     * Nothing to convert.
     */
    if (
      uniqueCurrencies.length === 0
    ) {
      return {
        baseCurrency: base,
        rates: {
          [base]: 1
        },
        fetchedAt: Date.now()
      };
    }

    const cached =
      readCache();

    /*
     * Reuse a recent cache if it
     * belongs to the same base
     * currency and contains every
     * required currency.
     */
    if (
      isFreshCache(cached) &&
      cached.baseCurrency === base
    ) {
      const hasAllRates =
        uniqueCurrencies.every(
          currency =>
            Number.isFinite(
              cached.rates?.[
                currency
              ]
            )
        );

      if (hasAllRates) {
        return cached;
      }
    }

    /*
     * Frankfurter returns:
     *
     * 1 BASE = rate QUOTE
     *
     * We invert the rate later
     * because we need:
     *
     * 1 SOURCE = X BASE
     */
    const quotes =
      uniqueCurrencies.join(",");

    const url =
      `${API_BASE}/rates` +
      `?base=${encodeURIComponent(
        base
      )}` +
      `&quotes=${encodeURIComponent(
        quotes
      )}`;

    const response =
      await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Exchange-rate request failed (${response.status})`
      );
    }

    const rows =
      await response.json();

    if (!Array.isArray(rows)) {
      throw new Error(
        "Invalid exchange-rate response"
      );
    }

    const rates = {
      [base]: 1
    };

    rows.forEach(row => {
      const quote =
        normalizeCurrency(
          row.quote
        );

      const rate =
        Number(row.rate);

      if (
        isSupportedCurrency(
          quote
        ) &&
        Number.isFinite(rate) &&
        rate > 0
      ) {
        rates[quote] = rate;
      }
    });

    /*
     * Verify every required currency
     * was returned.
     */
    for (
      const currency of
        uniqueCurrencies
    ) {
      if (
        !Number.isFinite(
          rates[currency]
        )
      ) {
        throw new Error(
          `Exchange rate unavailable for ${currency}`
        );
      }
    }

    const cache = {
      baseCurrency: base,
      rates,
      fetchedAt: Date.now()
    };

    writeCache(cache);

    return cache;
  };

export const convertAmount =
  (
    amount,
    fromCurrency,
    baseCurrency,
    rates
  ) => {
    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      )
    ) {
      return null;
    }

    const from =
      normalizeCurrency(
        fromCurrency
      );

    const base =
      normalizeCurrency(
        baseCurrency
      );

    if (
      from === base
    ) {
      return numericAmount;
    }

    const baseToSourceRate =
      Number(rates?.[from]);

    if (
      !Number.isFinite(
        baseToSourceRate
      ) ||
      baseToSourceRate <= 0
    ) {
      return null;
    }

    /*
     * If:
     *
     * 1 PKR = 0.0035 USD
     *
     * then:
     *
     * 1 USD ≈ 285.71 PKR
     *
     * Therefore we invert.
     */
    const sourceToBaseRate =
      1 / baseToSourceRate;

    return (
      numericAmount *
      sourceToBaseRate
    );
  };

export const getTransactionCurrencies =
  transactions => [
    ...new Set(
      transactions
        .map(
          transaction =>
            normalizeCurrency(
              transaction.currency
            )
        )
        .filter(Boolean)
    )
  ];

