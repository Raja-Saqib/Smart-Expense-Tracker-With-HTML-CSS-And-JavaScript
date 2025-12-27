export const getFiltered = (transactions, monthEl) => {
  if (!monthEl.value) return transactions;

  const [y, m] = monthEl.value.split("-");
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() == y && d.getMonth() + 1 == m;
  });
};
