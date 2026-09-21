const MAX_RETRIES = 3;

/**
 * Error used when an operation cannot safely be rebased
 * onto the latest cloud state.
 */
export class OperationConflictError extends Error {
  constructor(message, details = {}) {
    super(message);

    this.name = "OperationConflictError";
    this.code = "OPERATION_REBASE_CONFLICT";
    this.details = details;
  }
}

/**
 * Error used when optimistic concurrency detects that
 * another writer committed a newer cloud version.
 */
export class CloudVersionConflictError extends Error {
  constructor(message, details = {}) {
    super(message);

    this.name = "CloudVersionConflictError";
    this.code = "CLOUD_VERSION_CONFLICT";
    this.details = details;
  }
}

/**
 * Safely extracts a cloud version.
 */
const getVersion = state => {
  const version =
    Number(state?.cloudMeta?.version);

  if (
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return 0;
  }

  return version;
};

const REBASEABLE_OPERATION_TYPES =
  new Set([
    "add",
    "edit",
    "delete",
    "setChartMode",
    "mergeTransactions"
  ]);

const isRebaseableOperation =
  operation =>
    REBASEABLE_OPERATION_TYPES.has(
      operation?.type
    );


/**
 * Apply one user operation to a state snapshot.
 *
 * This function is pure:
 *
 * state + operation -> new state
 *
 * It does not touch:
 * - DOM
 * - LocalStorage
 * - Supabase
 * - BroadcastChannel
 * - history
 */
export const applyOperation = (
  state,
  operation
) => {
  if (!state || typeof state !== "object") {
    throw new OperationConflictError(
      "Cannot apply operation to an invalid state."
    );
  }

  if (
    !operation ||
    typeof operation !== "object"
  ) {
    throw new OperationConflictError(
      "Cannot apply an invalid operation."
    );
  }

  if (!Array.isArray(state.transactions)) {
    throw new OperationConflictError(
      "Cannot apply operation because transactions are invalid."
    );
  }

  switch (operation.type) {
    case "add": {
      if (
        !operation.transaction ||
        typeof operation.transaction !== "object"
      ) {
        throw new OperationConflictError(
          "Add operation contains no valid transaction."
        );
      }

      return {
        ...state,

        transactions: [
          ...state.transactions,
          operation.transaction
        ]
      };
    }

    case "edit": {
      if (
        typeof operation.transactionId !==
        "string"
      ) {
        throw new OperationConflictError(
          "Edit operation contains no valid transaction ID."
        );
      }

      const index =
        state.transactions.findIndex(
          transaction =>
            transaction.id ===
            operation.transactionId
        );

      if (index === -1) {
        throw new OperationConflictError(
          "The transaction being edited no longer exists.",
          {
            operation
          }
        );
      }

      if (
        !operation.changes ||
        typeof operation.changes !== "object"
      ) {
        throw new OperationConflictError(
          "Edit operation contains no valid changes."
        );
      }

      const transactions =
        [...state.transactions];

      transactions[index] = {
        ...transactions[index],
        ...operation.changes
      };

      return {
        ...state,
        transactions
      };
    }

    case "delete": {
      if (
        typeof operation.transactionId !==
        "string"
      ) {
        throw new OperationConflictError(
          "Delete operation contains no valid transaction ID."
        );
      }

      const exists =
        state.transactions.some(
          transaction =>
            transaction.id ===
            operation.transactionId
        );

      /*
       * Delete is idempotent.
       *
       * If another tab already deleted the
       * transaction, our desired result already
       * exists, so we don't treat that as failure.
       */
      if (!exists) {
        return state;
      }

      return {
        ...state,

        transactions:
          state.transactions.filter(
            transaction =>
              transaction.id !==
              operation.transactionId
          )
      };
    }

    case "setChartMode": {
      if (
        operation.chartMode !== "pie" &&
        operation.chartMode !== "donut"
      ) {
        throw new OperationConflictError(
          "Invalid chart mode."
        );
      }

      return {
        ...state,
        chartMode:
          operation.chartMode
      };
    }

    case "replaceTransactions":
      if (!Array.isArray(operation.transactions)) {
        throw new OperationConflictError(
          "Replacement transactions must be an array."
        );
      }

      return {
        ...state,
        transactions:
          structuredClone(
            operation.transactions
          )
      }
    
    case "restoreTransactions":
      if (!Array.isArray(operation.transactions)) {
        throw new OperationConflictError(
          "Restored transactions must be an array."
        );
      }

      return {
        ...state,
        transactions:
          structuredClone(
            operation.transactions
          )
      }

    case "restoreState":
      if (
        !Array.isArray(
        operation.transactions
        )
      ) {
        throw new OperationConflictError(
          "Restored transactions must be an array."
        );
      }

      if (
        operation.chartMode !== "pie" &&
        operation.chartMode !== "donut"
      ) {
        throw new OperationConflictError(
          "Invalid restored chart mode."
        );
      }

      return {
        ...state,

        transactions:
          structuredClone(
            operation.transactions
          ),

        chartMode:
          operation.chartMode
      }

    case "mergeTransactions": {
      if (
        !Array.isArray(
          operation.transactions
        )
      ) {
        throw new OperationConflictError(
          "mergeTransactions requires transactions"
        );
      }

      const existingIds =
        new Set(
          state.transactions.map(
            transaction =>
            transaction.id
          )
        );

      const mergedTransactions =
        [...state.transactions];

      for (
        const transaction of
        operation.transactions
      ) {
        if (
          !transaction ||
          !Number.isSafeInteger(
            transaction.id
          )
        ) {
          continue;
        }

        if (
          existingIds.has(
            transaction.id
          )
        ) {
          continue;
        }

        mergedTransactions.push(
          structuredClone(
            transaction
          )
        );

        existingIds.add(
          transaction.id
        );
      }

      return {
        ...state,
        transactions:
          mergedTransactions
      };
    }

    case "replaceState": {
      if (
        !operation.state ||
        typeof operation.state !== "object"
      ) {
        throw new OperationConflictError(
          "replaceState requires a state"
        );
      }

      return {
        ...state,
        transactions:
          structuredClone(
            operation.state.transactions
          ),
        chartMode:
        operation.state.chartMode,
        meta:
          structuredClone(
            operation.state.meta ?? {}
          )
      };
    }

    default:
      throw new OperationConflictError(
        `Unsupported operation type: ${operation.type}.`,
        {
          operation
        }
      );
  }
};

/**
 * Returns true only for the specific optimistic
 * concurrency conflict generated by pushToCloud().
 */
export const isVersionConflict = error => {
  return (
    error?.code ===
      "CLOUD_VERSION_CONFLICT" ||
    error?.name ===
      "CloudVersionConflictError"
  );
};

/**
 * Creates the state that should be written for
 * one attempt.
 */
const prepareNextState = ({
  state,
  operation,
  deviceId
}) => {
  const expectedVersion =
    getVersion(state);

  const nextVersion =
    expectedVersion + 1;

  const rebasedState =
    applyOperation(
      state,
      operation
    );

  return {
    expectedVersion,

    nextVersion,

    state: {
      ...rebasedState,

      cloudMeta: {
        ...rebasedState.cloudMeta,

        version: nextVersion,
        updatedAt: Date.now(),
        deviceId
      }
    }
  };
};

/**
 * Saves a user operation using optimistic
 * concurrency with bounded retries.
 *
 * Required dependencies:
 *
 * pushToCloud()
 * pullFromCloud()
 *
 * The caller supplies those functions so this
 * module remains independent from Supabase.
 */
export const saveWithRetry = async ({
  userId,
  state,
  operation,
  deviceId,
  pushToCloud,
  pullFromCloud,
  maxRetries = MAX_RETRIES
}) => {
  if (!userId) {
    throw new Error(
      "Authenticated user is required for cloud synchronization."
    );
  }

  if (
    typeof pushToCloud !== "function"
  ) {
    throw new TypeError(
      "pushToCloud must be a function."
    );
  }

  if (
    typeof pullFromCloud !== "function"
  ) {
    throw new TypeError(
      "pullFromCloud must be a function."
    );
  }

  if (
    !Number.isSafeInteger(maxRetries) ||
    maxRetries < 1 ||
    maxRetries > MAX_RETRIES
  ) {
    throw new RangeError(
      `maxRetries must be between 1 and ${MAX_RETRIES}.`
    );
  }

  if (!operation?.type) {
    throw new OperationConflictError(
      "A valid operation is required."
    );
  }

  let workingState = state;

  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    const {
      expectedVersion,
      nextVersion,
      state: nextState
    } = prepareNextState({
      state: workingState,
      operation,
      deviceId
    });

    try {
      const savedState =
        await pushToCloud({
          userId,

          transactions:
            nextState.transactions,

          cloudMeta:
            nextState.cloudMeta,

          chartMode:
            nextState.chartMode,

          deviceId,

          meta:
            nextState.meta,

          expectedVersion,

          nextVersion
        });

      /*
       * Successful conditional write.
       *
       * pushToCloud() has now confirmed that
       * expectedVersion was still current.
       */
      return {
        success: true,
        state: savedState,
        version: Number(
          savedState.version
        ),
        attempts: attempt,
        rebased: attempt > 1
      };
    } catch (error) {
      /*
       * Only version conflicts are retryable.
       *
       * Network errors, authentication errors,
       * validation errors, etc. are not silently
       * retried here.
       */
      if (!isVersionConflict(error)) {
        throw error;
      }

      /*
       * We have exhausted our bounded retry budget.
       */
      if (attempt >= maxRetries) {
        throw new CloudVersionConflictError(
          "Cloud state changed repeatedly; retry limit reached.",
          {
            attempts: attempt,
            maxRetries,
            expectedVersion,
            nextVersion,
            operation
          }
        );
      }

      /*
       * Another tab committed a newer version.
       *
       * Pull that authoritative state.
       */
      const latestState =
        await pullFromCloud({
          userId
        });

      if (!latestState) {
        throw new CloudVersionConflictError(
          "Unable to retrieve the latest cloud state after a version conflict.",
          {
            attempts: attempt,
            operation
          }
        );
      }

      /*
       * IMPORTANT:
       *
       * We do NOT apply the operation here.
       *
       * The next loop iteration will:
       *
       * latestState
       *      +
       * operation
       *      ↓
       * applyOperation()
       *
       * This guarantees that every retry starts
       * from the newest state.
       */
      workingState = latestState;
    }
  }

  /*
   * Defensive guard. The loop should always
   * either return or throw.
   */
  throw new CloudVersionConflictError(
    "Cloud save ended without a successful result.",
    {
      operation
    }
  );
};
