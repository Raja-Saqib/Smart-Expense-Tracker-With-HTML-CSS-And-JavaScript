import { subscribe } from "./eventBus.js";
import { getUndoStack, getRedoStack, getCurrentIndex } from "./historyState.js";
import { diffSnapshots } from "./snapshotDiff.js";

let panel;

export const initDebugPanel = ({
  deviceId,
  getCloudMeta,
  getChartMode
}) => {
  panel = document.createElement("div");

  panel.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    width: 320px;
    max-height: 400px;
    overflow: auto;
    background: #111;
    color: #0f0;
    font-size: 12px;
    padding: 10px;
    border-radius: 6px;
    z-index: 9999;
    display: none;
  `;

  document.body.appendChild(panel);

  const render = () => {
    const undo = getUndoStack();
    const redo = getRedoStack();
    const index = undo.length ? getCurrentIndex() : "N/A";

    panel.innerHTML = `
        <strong>DEBUG PANEL</strong><br/><br/>
        Undo stack: ${undo.length}<br/>
        Redo stack: ${redo.length}<br/>
        Current index: ${index}<br/>
        Device: ${deviceId}<br/>
        Chart mode: ${getChartMode()}<br/>
        <br/>
        <strong>Snapshots:</strong><br/>
        ${undo.map((s, i) => {
        const prev = undo[i - 1];
        const diffs = prev
            ? diffSnapshots(prev, s).join(", ")
            : "initial state";

        return `${i === index ? "➡️" : ""} ${i}. ${
            s.label
        } (${diffs})`;
        }).join("<br/>")}
        <br/><br/>
        <strong>Redo Entries:</strong><br/>
        ${redo.map((s, i) => `${i}. ${s.label}`).join("<br/>")}`
  };

  subscribe("history:changed", render); 

  document.addEventListener("keydown", e => {
    if (
      e.ctrlKey &&
      e.shiftKey &&
      e.key.toLowerCase() === "d"
    ) {
      panel.style.display =
        panel.style.display === "none"
          ? "block"
          : "none";
    }
  });
};
