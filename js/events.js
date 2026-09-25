export const initEvents = ({
  form,
  monthEl,
  clearFilterBtn,
  exportBtn,
  importBtn,
  importFileInput,
  listEl,
  themeBtn,
  undoBtn,
  redoBtn,
  baseCurrencyEl,
  loginForm,
  signupForm,
  logoutBtn,
  forgotPasswordBtn,
  passwordRecoveryForm,
  resetPasswordToggle,
  resetPasswordConfirmToggle,
  changePasswordForm,
  currentPasswordToggle,
  newPasswordToggle,
  confirmPasswordToggle,
  loginPasswordToggle,
  signupPasswordToggle,
  handlers
}) => {
  form.addEventListener("submit", handlers.addTransaction);

  monthEl.addEventListener("change", handlers.init);

  clearFilterBtn.addEventListener("click", handlers.clearFilter);

  exportBtn.addEventListener("click", handlers.exportCSV);

  importBtn.addEventListener("click", () => importFileInput.click());

  importFileInput.addEventListener("change", handlers.importCSV);

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

  baseCurrencyEl?.addEventListener(
    "change",
    handlers.baseCurrencyChange
  );

  document.addEventListener("keydown", e => {
    handlers.keydown(e, {
      undoBtn,
      redoBtn
    });
  });

    loginForm?.addEventListener(
      "submit",
      handlers.login
    );

    signupForm?.addEventListener(
      "submit",
      handlers.signup
    );

    logoutBtn?.addEventListener(
      "click",
      handlers.logout
    );

    forgotPasswordBtn?.addEventListener(
      "click",
      handlers.forgotPassword
    );

    passwordRecoveryForm?.addEventListener(
      "submit",
      handlers.resetPassword
    );

    resetPasswordToggle?.addEventListener(
      "click",
      handlers.toggleResetPassword
    );

    resetPasswordConfirmToggle?.addEventListener(
      "click",
      handlers.toggleResetPasswordConfirm
    );

    changePasswordForm?.addEventListener(
      "submit",
      handlers.changePassword
    );

    loginPasswordToggle?.addEventListener(
      "click",
      handlers.toggleLoginPassword
    );

    signupPasswordToggle?.addEventListener(
      "click",
      handlers.toggleSignupPassword
    );

    currentPasswordToggle?.addEventListener(
      "click",
      handlers.toggleCurrentPassword
    );

    newPasswordToggle?.addEventListener(
      "click",
      handlers.toggleNewPassword
    );

    confirmPasswordToggle?.addEventListener(
      "click",
      handlers.toggleConfirmPassword
    );
};
