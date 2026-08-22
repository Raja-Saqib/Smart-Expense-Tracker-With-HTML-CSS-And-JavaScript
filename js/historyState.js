import { isUndoStateEqual } from "./undoCompare.js";
import { publish } from "./eventBus.js";
import { deepFreeze } from "./deepFreeze.js";
import { isDev } from "./deepFreeze.js";
import { validateSnapshot } from "./stateValidator.js";

const MAX_STACK_SIZE = 30;

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

export const canUndo = () => undoStack.length > 1;
export const canRedo = () => redoStack.length > 0;
export const hasHistory = () => undoStack.length > 0;

export const clearUndoHistory = () => {
  undoStack = [];
  redoStack = [];
  publish("history:changed");
};

export const getNextUndoLabel = () => {
  if (undoStack.length < 2) return null;

  return undoStack[undoStack.length - 1]?.label || null;
};

export const getUndoStack = () => [...undoStack];
export const getRedoStack = () => [...redoStack];

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
