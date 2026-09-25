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

  const EPSILON = 0.0001;

  return [...allCategories].filter(cat => {
    return Math.abs((prevMap[cat] || 0) - (nextMap[cat] || 0)) > EPSILON;
  });
};
