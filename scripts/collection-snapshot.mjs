/** Compare material collection changes, not refresh timestamps. */
export function snapshotChanged(previous, next) {
  if (!previous) return true;
  const stable = snapshot => {
    const rows = Array.isArray(snapshot?.records) ? snapshot.records :
      Array.isArray(snapshot?.filings) ? snapshot.filings : [];
    return JSON.stringify({
      status: snapshot?.status ?? null,
      errors: Array.isArray(snapshot?.errors) ? snapshot.errors : [],
      rows: rows.map(row => row && typeof row === 'object'
        ? Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'retrieved_at'))
        : row)
    });
  };
  return stable(previous) !== stable(next);
}
