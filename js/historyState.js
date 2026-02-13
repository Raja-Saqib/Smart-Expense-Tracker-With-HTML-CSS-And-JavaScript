// state/undoManager.js

import { isUndoStateEqual } from "./undoCompare.js";

const MAX_STACK_SIZE = 30;

let undoStack = [];
let redoStack = [];

/**
 * Create a structured undo snapshot
 */
export const createUndoState = ({
  transactions,
  slices,
  cloudMeta,
  chartMode,
  label = "State change"
}) => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  label,
  data: {
    transactions: structuredClone(transactions),
    cloudMeta: structuredClone(cloudMeta)
  },
  chart: {
    slices: structuredClone(slices),
    chartMode
  }
});

/**
 * Push new undo state with dedupe + compression
 */
export const pushUndoState = state => {
  const last = undoStack[undoStack.length - 1];

  // 🔹 Deduplicate identical states
  if (last && isUndoStateEqual(last, state)) {
    return;
  }

  undoStack.push(state);

  // 🔹 Cap stack size
  if (undoStack.length > MAX_STACK_SIZE) {
    undoStack.shift();
  }

  // 🔹 Clear redo stack on new action
  redoStack = [];
};

/**
 * Undo last state
 */
export const undo = () => {
  if (!undoStack.length) return null;

  const current = undoStack.pop();
  redoStack.push(current);

  return undoStack[undoStack.length - 1] || null;
};

/**
 * Redo previously undone state
 */
export const redo = () => {
  if (!redoStack.length) return null;

  const state = redoStack.pop();
  undoStack.push(state);
  return state;
};

/**
 * Peek last undo label (for UI)
 */
export const getLastUndoLabel = () => {
  const last = undoStack[undoStack.length - 1];
  return last?.label || null;
};

/**
 * Clear all history
 */
export const clearUndoHistory = () => {
  undoStack = [];
  redoStack = [];
};

/**
 * Optional debug info
 */
export const getUndoStackSize = () => undoStack.length;
