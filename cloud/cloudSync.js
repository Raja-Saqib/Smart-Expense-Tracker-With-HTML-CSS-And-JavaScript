import { ensureAnonymousUser, supabase } from "./supabaseClient.js";
import { deviceId } from "../js/deviceIdentity.js";

const LEGACY_MIGRATION_MAX_RETRIES = 3;

/**
 * Pushes the current application state to Supabase.
 *
 * One row is stored for each authenticated Supabase user.
 *
 * @param {Object} params
 * @param {Array} params.transactions
 * @param {Object} params.cloudMeta
 * @param {string} params.chartMode
 * @param {string} params.deviceId
 * @param {Object} params.meta
 * @returns {Promise<Object>} Cloud state using the application's existing format.
 */
export const pushToCloud = async ({
  transactions,
  cloudMeta,
  chartMode,
  deviceId,
  meta = {},
}) => {
  const user = await ensureAnonymousUser();

  const nextVersion =
    (cloudMeta?.version ?? 0) + 1;

  const updatedAt = Date.now();

  const payload = {
    user_id: user.id,
    version: nextVersion,
    updated_at: new Date(updatedAt).toISOString(),
    updated_by: deviceId,
    transactions,
    chart_mode: chartMode,
    meta,
  };

  const {
    data,
    error,
  } = await supabase
    .from("expense_tracker_state")
    .upsert(
      payload,
      {
        onConflict: "user_id",
      }
    )
    .select()
    .single();

  if (error) {
    const cloudError = new Error(
      `Supabase push failed: ${error.message}`
    );

    cloudError.status = error.status;
    cloudError.code = error.code;

    throw cloudError;
  }

  if (!data) {
    throw new Error(
      "Supabase push succeeded but no state was returned"
    );
  }

  return {
    version: Number(data.version),
    updatedAt: Date.parse(data.updated_at),
    updatedBy: data.updated_by,
    transactions: data.transactions,
    chartMode: data.chart_mode,
    meta: data.meta,
    userId: data.user_id,
  };
};

const isJSONValue = value => {
  try {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      return true;
    }

    if (typeof value === "number") {
      return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
      return value.every(isJSONValue);
    }

    if (
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      return Object.values(value).every(isJSONValue);
    }

    return false;
  } catch {
    return false;
  }
};

const VALID_CATEGORIES = new Set([
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Income",
  "Other"
]);

const TRANSACTION_FIELDS = new Set([
  "id",
  "text",
  "category",
  "amount",
  "date",
  "updatedAt",
  "updatedBy"
]);

const MAX_TEXT_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 50;

const hasOwn = (object, property) =>
  Object.prototype.hasOwnProperty.call(object, property);

const isStrictISODateString = value => {
  if (typeof value !== "string") {
    return false;
  }

  // Require full ISO-8601 UTC timestamp:
  // 2026-09-08T06:21:39.123Z
  const ISO_UTC_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (!ISO_UTC_PATTERN.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  // Reject impossible dates that Date.parse() may normalize.
  return new Date(timestamp).toISOString() === value;
};

export const validateTransaction = transaction => {
  // -----------------------------------------
  // Boundary: only accept JSON-shaped objects
  // -----------------------------------------

  if (!isJSONValue(transaction)) {
    return {
      valid: false,
      errors: {
        transaction:
          "Transaction must contain only JSON-compatible values"
      }
    };
  }

  if (
    transaction === null ||
    typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    return {
      valid: false,
      errors: {
        transaction:
          "Transaction must be a JSON object"
      }
    };
  }

  const errors = {};

  // -----------------------------------------
  // Unknown fields
  // -----------------------------------------

  for (const key of Object.keys(transaction)) {
    if (!TRANSACTION_FIELDS.has(key)) {
      errors[key] = "Unknown transaction field";
    }
  }

  // -----------------------------------------
  // Required fields
  // -----------------------------------------

  for (const field of TRANSACTION_FIELDS) {
    if (!hasOwn(transaction, field)) {
      errors[field] = "Required field is missing";
    }
  }

  // -----------------------------------------
  // id
  // -----------------------------------------

  if (hasOwn(transaction, "id")) {
    if (
      !Number.isSafeInteger(transaction.id) ||
      transaction.id < 0
    ) {
      errors.id =
        "id must be a non-negative safe integer";
    }
  }

  // -----------------------------------------
  // text
  // -----------------------------------------

  if (hasOwn(transaction, "text")) {
    if (typeof transaction.text !== "string") {
      errors.text = "text must be a string";
    } else {
      if (transaction.text !== transaction.text.trim()) {
        errors.text =
          "text must not have leading or trailing whitespace";
      }

      if (transaction.text.length > MAX_TEXT_LENGTH) {
        errors.text =
          `text must not exceed ${MAX_TEXT_LENGTH} characters`;
      }
    }
  }

  // -----------------------------------------
  // category
  // -----------------------------------------

  if (hasOwn(transaction, "category")) {
    if (typeof transaction.category !== "string") {
      errors.category =
        "category must be a string";
    } else {
      if (transaction.category.trim() === "") {
        errors.category =
          "category must not be empty";
      }

      if (
        transaction.category.length >
        MAX_CATEGORY_LENGTH
      ) {
        errors.category =
          `category must not exceed ${MAX_CATEGORY_LENGTH} characters`;
      }
    }
  }

  // -----------------------------------------
  // amount
  // -----------------------------------------

  if (hasOwn(transaction, "amount")) {
    if (typeof transaction.amount !== "number") {
      errors.amount =
        "amount must be a number";
    } else if (!Number.isFinite(transaction.amount)) {
      errors.amount =
        "amount must be a finite number";
    } else if (transaction.amount === 0) {
      errors.amount =
        "amount must not be zero";
    }
  }

  // -----------------------------------------
  // date
  // -----------------------------------------

  if (hasOwn(transaction, "date")) {
    if (!isStrictISODateString(transaction.date)) {
      errors.date =
        "date must be a valid ISO 8601 UTC timestamp";
    }
  }

  // -----------------------------------------
  // updatedAt
  // -----------------------------------------

  if (hasOwn(transaction, "updatedAt")) {
    if (
      !Number.isSafeInteger(transaction.updatedAt) ||
      transaction.updatedAt < 0
    ) {
      errors.updatedAt =
        "updatedAt must be a non-negative safe integer";
    }
  }

  // -----------------------------------------
  // updatedBy
  // -----------------------------------------

  if (hasOwn(transaction, "updatedBy")) {
    if (
      typeof transaction.updatedBy !== "string" ||
      transaction.updatedBy.trim() === ""
    ) {
      errors.updatedBy =
        "updatedBy must be a non-empty string";
    }
  }

  // -----------------------------------------
  // updatedAt >= date
  // -----------------------------------------

  if (
    isStrictISODateString(transaction.date) &&
    Number.isSafeInteger(transaction.updatedAt) &&
    transaction.updatedAt >= 0
  ) {
    const dateTimestamp = Date.parse(
      transaction.date
    );

    if (transaction.updatedAt < dateTimestamp) {
      errors.updatedAt =
        "updatedAt must not be earlier than date";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateTransactions = transactions => {
  if (!Array.isArray(transactions)) {
    return {
      valid: false,
      errors: {
        transactions: "Transactions must be an array"
      }
    };
  }

  const errors = {};
  const ids = new Map();

  transactions.forEach((transaction, index) => {
    const result = validateTransaction(transaction);

    if (!result.valid) {
      errors[index] = result.errors;
    }

    if (
      transaction &&
      typeof transaction === "object" &&
      Number.isSafeInteger(transaction.id)
    ) {
      if (ids.has(transaction.id)) {
        const firstIndex = ids.get(transaction.id);

        errors[index] ??= {};
        errors[index].id =
          `Duplicate transaction ID; first used at index ${firstIndex}`;
      } else {
        ids.set(transaction.id, index);
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateCloudPayload = data => {
  const errors = {};

  // Root object
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return {
      valid: false,
      errors: {
        payload: "Cloud payload must be an object"
      }
    };
  }

  // Root fields
  const allowedFields = new Set([
    "version",
    "updatedAt",
    "updatedBy",
    "transactions",
    "chartMode",
    "meta"
  ]);

  for (const key of Object.keys(data)) {
    if (!allowedFields.has(key)) {
      errors[key] = "Unknown cloud payload field";
    }
  }

  // version
  if (
    !Number.isSafeInteger(data.version) ||
    data.version < 0
  ) {
    errors.version =
      "Version must be a non-negative safe integer";
  }

  // updatedAt
  if (
    !Number.isSafeInteger(data.updatedAt) ||
    data.updatedAt < 0
  ) {
    errors.updatedAt =
      "updatedAt must be a non-negative safe integer";
  }

  // updatedBy
  if (
    typeof data.updatedBy !== "string" ||
    data.updatedBy.trim() === ""
  ) {
    errors.updatedBy =
      "updatedBy must be a non-empty string";
  }

  // chartMode
  if (
    data.chartMode !== "pie" &&
    data.chartMode !== "donut"
  ) {
    errors.chartMode =
      'chartMode must be either "pie" or "donut"';
  }

  // transactions
  const transactionResult =
    validateTransactions(data.transactions);

  if (!transactionResult.valid) {
    errors.transactions =
      transactionResult.errors;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};

const createTimeoutSignal = (
  timeout,
  callerSignal
) => {
  const controller = new AbortController();

  let timeoutId = setTimeout(
    () => controller.abort("timeout"),
    timeout
  );

  const abortFromCaller = () => {
    controller.abort("caller");
  };

  callerSignal?.addEventListener(
    "abort",
    abortFromCaller,
    { once: true }
  );

  return {
    signal: controller.signal,

    cleanup: () => {
      clearTimeout(timeoutId);

      callerSignal?.removeEventListener(
        "abort",
        abortFromCaller
      );
    }
  };
};

const CLOUD_PULL_TIMEOUT = 10_000;

const createPullSignal = (
  timeout,
  callerSignal
) => {
  // Modern browsers
  if (
    typeof AbortSignal?.timeout === "function" &&
    typeof AbortSignal?.any === "function"
  ) {
    const timeoutSignal =
      AbortSignal.timeout(timeout);

    const signal = callerSignal
      ? AbortSignal.any([
          timeoutSignal,
          callerSignal
        ])
      : timeoutSignal;

    return {
      signal,
      cleanup: () => {}
    };
  }

  // Compatibility fallback
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort("timeout"),
    timeout
  );

  const abortFromCaller = () => {
    controller.abort("caller");
  };

  callerSignal?.addEventListener(
    "abort",
    abortFromCaller,
    { once: true }
  );

  return {
    signal: controller.signal,

    cleanup: () => {
      clearTimeout(timeoutId);

      callerSignal?.removeEventListener(
        "abort",
        abortFromCaller
      );
    }
  };
};

/**
 * Pulls the current user's state from Supabase.
 *
 * The Supabase user identity replaces the old JSONBlob blobId.
 *
 * @param {Object} options
 * @param {AbortSignal} options.signal
 * @returns {Promise<Object|null>}
 */
export const pullFromCloud = async ({
  signal: callerSignal
} = {}) => {
  const {
    signal,
    cleanup
  } = createPullSignal(
    CLOUD_PULL_TIMEOUT,
    callerSignal
  );

  try {
    if (callerSignal?.aborted) {
      console.warn(
        "Cloud pull cancelled by caller"
      );

      return null;
    }

    const user =
      await ensureAnonymousUser();

    if (callerSignal?.aborted) {
      console.warn(
        "Cloud pull cancelled by caller"
      );

      return null;
    }

    const {
      data,
      error
    } = await supabase
      .from("expense_tracker_state")
      .select(
        "version, updated_at, updated_by, transactions, chart_mode, meta"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (signal.aborted) {
      console.warn(
        "Cloud pull cancelled or timed out"
      );

      return null;
    }

    if (error) {
      console.warn(
        "Supabase pull failed:",
        error
      );

      return null;
    }

    if (!data) {
      console.info(
        "No cloud state exists for this Supabase user yet."
      );

      return null;
    }

    const cloudPayload = {
      version: Number(data.version),
      updatedAt: Date.parse(data.updated_at),
      updatedBy: data.updated_by,
      transactions: data.transactions,
      chartMode: data.chart_mode,
      meta: data.meta
    };

    // Migrate legacy transactions that are missing updatedBy.
    const hasLegacyTransactions =
      Array.isArray(cloudPayload.transactions) &&
      cloudPayload.transactions.some(
        transaction =>
          !transaction.updatedBy
      );

    if (
      hasLegacyTransactions &&
      typeof cloudPayload.updatedBy === "string" &&
      cloudPayload.updatedBy.trim()
    ) {
      cloudPayload.transactions =
        cloudPayload.transactions.map(
          transaction => ({
            ...transaction,
            updatedBy:
              transaction.updatedBy ??
              cloudPayload.updatedBy
          })
        );

      // Persist the migrated state with bounded retry attempts.
      let migratedData = null;
      let migrationError = null;

      for (
        let attempt = 1;
        attempt <= LEGACY_MIGRATION_MAX_RETRIES;
        attempt++
      ) {
        const currentVersion =
          Number(cloudPayload.version);

        const migratedVersion =
          currentVersion + 1;

        const migratedAt =
          new Date().toISOString();

        const result = await supabase
          .from("expense_tracker_state")
          .update({
            transactions:
              cloudPayload.transactions,

            chart_mode:
              cloudPayload.chartMode,

            meta:
              cloudPayload.meta,

            version:
              migratedVersion,

            updated_at:
              migratedAt,

            updated_by:
              deviceId
          })
          .eq("user_id", user.id)
          .eq("version", currentVersion)
          .select()
          .maybeSingle();

        migratedData = result.data;
        migrationError = result.error;

        if (migrationError) {
          break;
        }

        if (migratedData) {
          break;
        }

        // Version conflict: fetch the latest cloud state
        // before trying the migration again.
        if (
          attempt < LEGACY_MIGRATION_MAX_RETRIES
        ) {
          const {
            data: latestData,
            error: latestError
          } = await supabase
            .from("expense_tracker_state")
            .select(
              "version, updated_at, updated_by, transactions, chart_mode, meta"
            )
            .eq("user_id", user.id)
            .maybeSingle();

          if (latestError || !latestData) {
            migrationError =
              latestError ??
              new Error(
                "Could not retrieve latest cloud state for migration retry"
              );

            break;
          }

          cloudPayload.version =
            Number(latestData.version);

          cloudPayload.updatedAt =
            Date.parse(latestData.updated_at);

          cloudPayload.updatedBy =
            latestData.updated_by;

          cloudPayload.transactions =
            Array.isArray(latestData.transactions)
              ? latestData.transactions.map(
                  transaction => ({
                    ...transaction,
                    updatedBy:
                      transaction.updatedBy ??
                      latestData.updated_by
                  })
                )
              : latestData.transactions;

          cloudPayload.chartMode =
            latestData.chart_mode;

          cloudPayload.meta =
            latestData.meta;
        }
      }

      if (migrationError) {
        console.warn(
          "Legacy transaction migration could not be persisted:",
          migrationError
        );
      } else if (migratedData) {
        cloudPayload.version =
          Number(migratedData.version);

        cloudPayload.updatedAt =
          Date.parse(
            migratedData.updated_at
          );

        cloudPayload.updatedBy =
          migratedData.updated_by;

        console.info(
          "Legacy transactions migrated and persisted to Supabase."
        );
      } else {
        console.warn(
          "Legacy transaction migration was not persisted because the cloud version changed."
        );
      }
    }

    const validation =
      validateCloudPayload(cloudPayload);

    if (!validation.valid) {
      console.warn(
        "Invalid Supabase cloud payload:",
        validation.errors
      );

      return null;
    }

    return cloudPayload;

  } catch (error) {
    if (callerSignal?.aborted) {
      console.warn(
        "Cloud pull cancelled by caller"
      );
    } else if (
      error?.name === "TimeoutError"
    ) {
      console.warn(
        "Cloud pull timed out"
      );
    } else {
      console.warn(
        "Cloud pull unavailable:",
        error
      );
    }

    return null;

  } finally {
    cleanup();
  }
};

export const detectConflicts = (
  local,
  remote
) => {
  const conflicts = [];

  const localMap = new Map(local.map(t => [t.id, t]));

  for (const r of remote) {
    const l = localMap.get(r.id);

    if (!l) continue;

    if (
      l.updatedAt !== r.updatedAt &&
      l.updatedBy !== r.updatedBy
    ) {
      conflicts.push({
        id: r.id,
        local: l,
        remote: r
      });
    }
  }

  return conflicts;
};

export const autoResolveConflicts = conflicts => {
  const resolved = [];
  const unresolved = [];

  for (const c of conflicts) {
    const { local, remote } = c;

    if (local.category === remote.category) {
      resolved.push(
        local.updatedAt > remote.updatedAt
          ? local
          : remote
      );
    } else {
      unresolved.push(c);
    }
  }

  return { resolved, unresolved };
};
