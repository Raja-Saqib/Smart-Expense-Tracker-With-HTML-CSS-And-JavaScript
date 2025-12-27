export const initEvents = ({
  form,
  monthEl,
  listEl,
  themeBtn,
  handlers
}) => {
  form.addEventListener("submit", handlers.addTransaction);
  monthEl.addEventListener("change", handlers.init);

  listEl.addEventListener("click", e => {
    if (e.target.dataset.edit)
      handlers.editTransaction(+e.target.dataset.edit);
    if (e.target.dataset.delete)
      handlers.deleteTransaction(+e.target.dataset.delete);
  });

  themeBtn.addEventListener("click", handlers.toggleTheme);
};
