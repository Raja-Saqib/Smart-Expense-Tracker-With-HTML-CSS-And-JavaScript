export const initEvents = ({
  form,
  monthEl,
  clearFilterBtn,
  exportBtn,
  listEl,
  themeBtn,
  undoBtn,
  redoBtn,
  handlers
}) => {
  form.addEventListener("submit", handlers.addTransaction);

  monthEl.addEventListener("change", handlers.init);

  clearFilterBtn.addEventListener("click", handlers.clearFilter);

  exportBtn.addEventListener("click", handlers.exportCSV);

  listEl.addEventListener("click", e => {
    const editButton = e.target.closest("[data-edit]");
    const deleteButton = e.target.closest("[data-delete]");

    if (editButton) {
      handlers.editTransaction(+editButton.dataset.edit);
      return;
    }

    if (deleteButton) {
      handlers.deleteTransaction(+deleteButton.dataset.delete);
    }
  });

  themeBtn.addEventListener("click", handlers.toggleTheme);

  undoBtn.addEventListener("click", handlers.undo);
  redoBtn.addEventListener("click", handlers.redo);

  document.addEventListener("keydown", e => {
    handlers.keydown(e, {
      undoBtn,
      redoBtn
    });
  });
};
