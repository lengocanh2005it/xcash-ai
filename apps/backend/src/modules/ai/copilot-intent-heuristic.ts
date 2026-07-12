const REVIEW_QUEUE_COUNT_PHRASES = new Set([
  'có bao nhiêu giao dịch đang chờ duyệt',
  'có bao nhiêu giao dịch chờ duyệt',
  'giao dịch chờ duyệt có bao nhiêu',
  'số giao dịch chờ duyệt',
  'còn bao nhiêu giao dịch chờ duyệt',
  'bao nhiêu giao dịch cần duyệt',
]);

export function matchReviewQueueCountIntent(message: string): boolean {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+$/g, '')
    .trim();
  return REVIEW_QUEUE_COUNT_PHRASES.has(normalized);
}
