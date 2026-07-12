import { matchReviewQueueCountIntent } from './copilot-intent-heuristic';

const PHRASES = [
  'có bao nhiêu giao dịch đang chờ duyệt',
  'có bao nhiêu giao dịch chờ duyệt',
  'giao dịch chờ duyệt có bao nhiêu',
  'số giao dịch chờ duyệt',
  'còn bao nhiêu giao dịch chờ duyệt',
  'bao nhiêu giao dịch cần duyệt',
] as const;

describe('matchReviewQueueCountIntent', () => {
  it.each(PHRASES)('matches exact phrase %#', (phrase) => {
    expect(matchReviewQueueCountIntent(phrase)).toBe(true);
  });

  it('matches when casing and trailing punctuation differ', () => {
    expect(matchReviewQueueCountIntent('Có bao nhiêu giao dịch chờ duyệt?')).toBe(true);
    expect(matchReviewQueueCountIntent('  SỐ GIAO DỊCH CHỜ DUYỆT  ')).toBe(true);
    expect(matchReviewQueueCountIntent('bao nhiêu giao dịch cần duyệt!!!')).toBe(true);
  });

  it('does not match nearby but different intents', () => {
    expect(matchReviewQueueCountIntent('Doanh thu tháng này bao nhiêu?')).toBe(false);
    expect(matchReviewQueueCountIntent('Danh sách giao dịch chờ duyệt')).toBe(false);
    expect(matchReviewQueueCountIntent('liệt kê giao dịch đang chờ duyệt')).toBe(false);
  });

  it('does not match empty or whitespace-only input', () => {
    expect(matchReviewQueueCountIntent('')).toBe(false);
    expect(matchReviewQueueCountIntent('   ')).toBe(false);
  });
});
