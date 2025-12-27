export const resolveAgeRange = (source) => {
  const minFromSource = source?.edad_minima_permitida;
  const maxFromSource = source?.edad_maxima_permitida;
  if (minFromSource != null || maxFromSource != null) {
    return { min: minFromSource ?? null, max: maxFromSource ?? null };
  }

  const categories = Array.isArray(source?.categorias) ? source.categorias : [];
  const hasUnbounded = categories.some(
    (category) =>
      category && category.edad_minima == null && category.edad_maxima == null,
  );
  if (hasUnbounded) {
    return { min: null, max: null };
  }

  let min = null;
  let max = null;
  categories.forEach((category) => {
    if (!category) return;
    if (category.edad_minima != null) {
      min = min == null ? category.edad_minima : Math.min(min, category.edad_minima);
    }
    if (category.edad_maxima != null) {
      max = max == null ? category.edad_maxima : Math.max(max, category.edad_maxima);
    }
  });

  return { min, max };
};

export const formatAgeRange = (min, max) => {
  if (min == null && max == null) return 'Sin restricción de edad';
  if (min != null && max != null) return `${min} a ${max} años`;
  if (min != null) return `Desde ${min} años`;
  return `Hasta ${max} años`;
};
