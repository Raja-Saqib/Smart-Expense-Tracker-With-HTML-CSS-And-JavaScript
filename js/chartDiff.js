export const getChangedCategories = (
  prev = [],
  next = []
) => {
  const prevMap = Object.fromEntries(
    prev.map(s => [s.category, s.value])
  );

  return next
    .filter(
      s =>
        !prevMap[s.category] ||
        prevMap[s.category] !== s.value
    )
    .map(s => s.category);
};
