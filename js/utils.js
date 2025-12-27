export const formatMoney = num => `$${num.toLocaleString()}`;

export const showError = (el, msg) => {
  el.textContent = msg;
  setTimeout(() => (el.textContent = ""), 3000);
};
