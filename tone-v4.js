function labelForScore(value) {
  const score = Number(value);
  if (score >= 80) return 'Great match';
  if (score >= 68) return 'Looks strong';
  if (score >= 55) return 'Worth a look';
  if (score >= 42) return 'Think it over';
  return 'Probably skip';
}
