import { activeCategory } from "./state.js";

export const getFiltered = (transactions, monthEl) => {
  let data = transactions;

  if (monthEl.value) {
    const [y, m] = monthEl.value.split("-");
    data = data.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() == y && d.getMonth() + 1 == m;
    });
  }

  if (activeCategory) {
    data = data.filter(t => t.category === activeCategory);
  }

  return data;
};
