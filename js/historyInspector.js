import {
  getUndoStack,
  getCurrentIndex
} from "./historyState.js";

export const renderHistoryInspector = (
  container,
  onJump
) => {
  const history = getUndoStack();
  const currentIndex = getCurrentIndex();

  container.innerHTML = "";

  history.forEach((entry, index) => {
    const li = document.createElement("li");

    const button = document.createElement("button");

    button.type = "button";
    button.dataset.historyIndex = index;

    const date = new Date(entry.timestamp)
      .toLocaleTimeString();

    button.textContent =
      index === currentIndex
        ? `${index + 1}. ${entry.label} (${date}) — Current`
        : `${index + 1}. ${entry.label} (${date})`;

    if (index === currentIndex) {
      button.disabled = true;
      button.setAttribute("aria-current", "step");
    }

    button.addEventListener("click", async () => {
      await onJump(index);
    });

    li.appendChild(button);
    container.appendChild(li);
  });
};
