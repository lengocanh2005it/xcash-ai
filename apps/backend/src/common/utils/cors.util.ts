/** Comma-separated origins, e.g. `http://localhost:5173,https://app.example.com` */
export function parseCorsOrigins(raw?: string): string[] {
  if (!raw?.trim()) {
    return ['http://localhost:5173'];
  }

  return [
    ...new Set(
      raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ];
}
