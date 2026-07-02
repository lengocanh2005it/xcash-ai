export function maskAccountNumber(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const digits = value.replace(/\s/g, '');
  if (digits.length <= 4) {
    return '****';
  }

  return `****${digits.slice(-4)}`;
}

export function maskPersonName(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return value
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 1) {
        return '*';
      }

      return `${part[0]}${'*'.repeat(Math.min(3, part.length - 1))}`;
    })
    .join(' ');
}
