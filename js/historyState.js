import { isUndoStateEqual } from "./undoCompare.js";

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
}) => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  label,
  state: {
    transactions: structuredClone(transactions),
    cloudMeta: structuredClone(cloudMeta),
    chartMode
  }
});

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
};

/**
 * Undo (true undo semantics)
 */
export const undo = () => {
  if (undoStack.length < 2) return null;

  const current = undoStack.pop();
  redoStack.push(current);

  return undoStack[undoStack.length - 1];
};

/**
 * Redo
 */
export const redo = () => {
  if (!redoStack.length) return null;

  const state = redoStack.pop();
  undoStack.push(state);
  return state;
};

export const canUndo = () => undoStack.length > 1;
export const canRedo = () => redoStack.length > 0;

export const clearUndoHistory = () => {
  undoStack = [];
  redoStack = [];
};
