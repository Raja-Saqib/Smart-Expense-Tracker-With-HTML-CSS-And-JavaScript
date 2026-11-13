import { isUndoStateEqual } from "./undoCompare.js";
import { publish } from "./eventBus.js";
import { deepFreeze } from "./deepFreeze.js";
import { isDev } from "./deepFreeze.js";
import { validateSnapshot } from "./stateValidator.js";

export const MAX_STACK_SIZE = 30;

let undoStack = [];
let redoStack = [];

/**
 * Create canonical undo snapshot
 * (NO slices stored — slices are derived)
 */
export const createUndoState = ({
  transactions,
  cloudMeta,
  chartMode,
  label = "State change"
}) => {
  const snapshot = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    label,
    state: {
      transactions: structuredClone(transactions),
      cloudMeta: structuredClone(cloudMeta),
      chartMode
    }
  };

  if (isDev) {
    validateSnapshot(snapshot);
    deepFreeze(snapshot);
  }

  return snapshot;
};

/**
 * Push new undo state with dedupe + cap
 */
export const pushUndoState = state => {
  const last = undoStack[undoStack.length - 1];

  if (last && isUndoStateEqual(last, state)) {
    return; // prevent duplicate
  }

  undoStack.push(state);

  if (undoStack.length > MAX_STACK_SIZE) {
    undoStack.shift();
  }

  // Clear redo stack on new action
  redoStack = [];

  publish("history:changed");
};

/**
 * Record an externally synchronized state as a
 * new history transition.
 *
 * Unlike replaceCurrentUndoStateAndClearRedo(),
 * this preserves the previous local state so the
 * remote transition itself can be undone.
 *
 * If the incoming state is identical to the current
 * history state, nothing is added and the existing
 * redo branch is preserved.
 */
export const recordExternalUndoState = state => {
  if (!state) {
    return false;
  }

  const last =
    undoStack[undoStack.length - 1];

  if (
    last &&
    isUndoStateEqual(last, state)
  ) {
    return false;
  }

  undoStack.push(state);

  if (
    undoStack.length >
    MAX_STACK_SIZE
  ) {
    undoStack.shift();
  }

  /*
   * An external state is a new branch.
   * Therefore any redo states belonging to
   * the previous branch are no longer valid.
   */
  redoStack = [];

  publish("history:changed");

  return true;
};

/**
 * Replace the current undo state without affecting redo history.
 *
 * Used when persistence updates metadata (for example cloud version)
 * after an undo/redo operation.
 */
export const replaceCurrentUndoState = state => {
  if (!undoStack.length) return;

  undoStack[undoStack.length - 1] = state;

  publish("history:changed");
};

/**
 * Replace the current undo state and invalidate redo history.
 *
 * Used when an external state replacement occurs,
 * such as a cross-tab synchronization update.
 */
export const replaceCurrentUndoStateAndClearRedo = state => {
  if (!undoStack.length) return;

  undoStack[undoStack.length - 1] = state;
  redoStack = [];

  publish("history:changed");
};

/**
 * Undo (true undo semantics)
 */
export const undo = () => {
  if (undoStack.length < 2) return null;

  const current = undoStack.pop();
  redoStack.push(current);

  publish("history:changed");

  return undoStack[undoStack.length - 1];
};

export const rollbackUndo = expectedCurrent => {
  const currentRedoState  = redoStack[redoStack.length - 1];

  if (currentRedoState !== expectedCurrent) return false;

  redoStack.pop();
  undoStack.push(expectedCurrent);

  publish("history:changed");

  return true;
};

/**
 * Redo
 */
export const redo = () => {
  if (!redoStack.length) return null;

  const state = redoStack.pop();
  undoStack.push(state);

  publish("history:changed");

  return state;
};

export const rollbackRedo = expectedCurrent => {
  const currentUndoState  = undoStack[undoStack.length - 1];

  if (currentUndoState  !== expectedCurrent) return false;

  undoStack.pop();
  redoStack.push(expectedCurrent);

  publish("history:changed");

  return true;
};

export const canUndo = () => undoStack.length > 1;
export const canRedo = () => redoStack.length > 0;
export const hasHistory = () => undoStack.length > 0;

export const clearUndoHistory = () => {
  undoStack = [];
  redoStack = [];
  publish("history:changed");
};

const getActionLabel = label => {
  if (!label) return null;

  return label
    .replace(/^Undo\s+/i, "")
    .replace(/^Redo\s+/i, "");
};

export const getNextUndoLabel = () => {
  if (undoStack.length < 2) {
    return null;
  }

  const actionLabel = getActionLabel(
    undoStack[undoStack.length - 1]?.label
  );

  return actionLabel
    ? `Undo ${actionLabel}`
    : null;
};

export const getNextRedoLabel = () => {
  if (!redoStack.length) {
    return null;
  }

  const actionLabel = getActionLabel(
    redoStack[redoStack.length - 1]?.label
  );

  return actionLabel
    ? `Redo ${actionLabel}`
    : null;
};

export const getUndoStack = () => [...undoStack];
export const getRedoStack = () => [...redoStack];

export const getHistoryState = index => {
  if (index < 0 || index >= undoStack.length) {
    return null;
  }

  return undoStack[index];
};

export const commitJumpToState = index => {
  if (index < 0 || index >= undoStack.length) {
    return null;
  }

  const target = undoStack[index];

  const removed = undoStack.slice(index + 1);

  redoStack = [
    ...removed.reverse(),
    ...redoStack
  ];

  undoStack = undoStack.slice(0, index + 1);

  publish("history:changed");

  return target;
};

export const jumpToState = index => {
  if (index < 0 || index >= undoStack.length) return null;

  const target = undoStack[index];

  // Move everything after index to redo stack
  const removed = undoStack.slice(index + 1);

  redoStack = [...removed.reverse(), ...redoStack];

  undoStack = undoStack.slice(0, index + 1);

  publish("history:changed");

  return target;
};

export const getCurrentIndex = () =>
  undoStack.length - 1;

export const captureHistoryState = () => ({
  undoStack: [...undoStack],
  redoStack: [...redoStack]
});

export const restoreHistoryState = historyState => {
  if (
    !historyState ||
    !Array.isArray(historyState.undoStack) ||
    !Array.isArray(historyState.redoStack)
  ) {
    return false;
  }

  undoStack = [...historyState.undoStack];
  redoStack = [...historyState.redoStack];

  publish("history:changed");

  return true;
};

