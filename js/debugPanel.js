import { subscribe } from "./eventBus.js";
import { getUndoStack, getRedoStack, getCurrentIndex, jumpToState } from "./historyState.js";
import { diffSnapshots } from "./snapshotDiff.js";
import { MAX_STACK_SIZE } from "./historyState.js";

let panel;

export const initDebugPanel = ({
  deviceId,
  getCloudMeta,
  getChartMode,
  applySnapshot
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
    const threshold = MAX_STACK_SIZE - 2;
    const nearLimit = undo.length >= threshold;
    const cloudMeta = getCloudMeta();

    panel.innerHTML = `
        <strong>DEBUG PANEL</strong><br/><br/>
        Undo stack: ${undo.length}<br/>
        Redo stack: ${redo.length}<br/>
        Current index: ${index}<br/>
        Device: ${deviceId}<br/>
        Chart mode: ${getChartMode()}<br/>
        Cloud updatedAt: ${cloudMeta?.updatedAt ?? "N/A"}<br/>
        Cloud version: ${cloudMeta?.version ?? "N/A"}<br/>
        <br/>
        <strong>Snapshots:</strong><br/>
        ${undo.map((s, i) => {
            const prev = undo[i - 1];
            const diffs = prev
                ? diffSnapshots(prev, s)
                : ["initial state"];

            return `
                <div data-index="${i}" style="margin-bottom:6px;">
                    <div 
                        data-toggle="${i}" 
                        style="cursor:pointer;"
                    >
                        ${i === index ? "➡️" : ""} 
                        ${i}. ${s.label}
                    </div>
                    <div 
                        data-diff="${i}" 
                        style="display:none; margin-left:10px; font-size:11px;"
                    >
                        ${diffs.join("<br/>")}
                    </div>
                </div>
            `;
        }).join("")}
        <br/><br/>
        <strong>Redo Entries:</strong><br/>
        ${redo.map((s, i) => `${i}. ${s.label}`).join("<br/>")}
        ${nearLimit ? 
            `<div style="color:orange;">
                ⚠ Undo stack nearing limit (${undo.length}/${MAX_STACK_SIZE})
            </div>` 
        : ""}`
  };

  subscribe("history:changed", render); 
  render(); // Initial render
  
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
  panel.addEventListener("click", e => {
    const target = e.target.closest("[data-index]");
    if (!target) return;

    const index = Number(target.dataset.index);
    const state = jumpToState(index);
    if (!state) return;

    applySnapshot(state);

    if (e.target.dataset.toggle !== undefined) {
        const id = e.target.dataset.toggle;
        const diffEl = panel.querySelector(`[data-diff="${id}"]`);
        if (diffEl) {
            diffEl.style.display =
            diffEl.style.display === "none"
                ? "block"
                : "none";
        }
    }
  });
};
