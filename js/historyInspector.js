import { setCloudMeta } from "../cloud/cloudState.js";
import { chartMode, setChartMode } from "./chartState.js";
import { getUndoStack, jumpToState } from "./historyState.js";
import { saveData, transactions, setTransactions } from "./state.js";
import { updateUndoUI } from "./ui.js";

export const renderHistoryInspector = (
  container,
  onJump
) => {
  const stack = getUndoStack();

  container.innerHTML = "";

  stack.forEach((state, index) => {
    const li = document.createElement("li");

    const date = new Date(state.timestamp)
      .toLocaleTimeString();

    li.textContent = `${index + 1}. ${state.label} (${date})`;

    li.addEventListener("click", () => {
      onJump(index);
    });

    container.appendChild(li);
  });
};

renderHistoryInspector(historyList, index => {
  const state = jumpToState(index);
  if (!state) return;

  setTransactions(structuredClone(state.state.transactions));
  setCloudMeta(state.state.cloudMeta);
  setChartMode(state.state.chartMode);

  saveData({
    transactions,
    cloudMeta: getCloudMeta(),
    chartMode,
    meta: {
      type: "history-jump"
    }
  });
  init();
  updateUndoUI();
});
