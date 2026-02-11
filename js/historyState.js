let undoStack = [];

export const pushUndoState = state => {
  undoStack.push(JSON.stringify(state));
};

export const popUndoState = () => {
  return undoStack.length
    ? JSON.parse(undoStack.pop())
    : null;
};
