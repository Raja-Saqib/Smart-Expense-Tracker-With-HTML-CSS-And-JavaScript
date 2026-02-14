export const getChangedCategories = (
  prev = [],
  next = []
) => {
  const prevMap = Object.fromEntries(
    prev.map(s => [s.category, s.value])
  );

  const nextMap = Object.fromEntries(
    next.map(s => [s.category, s.value])
  );

  const allCategories = new Set([
    ...Object.keys(prevMap),
    ...Object.keys(nextMap)
  ]);

  return [...allCategories].filter(cat => {
    return prevMap[cat] !== nextMap[cat];
  });
};
