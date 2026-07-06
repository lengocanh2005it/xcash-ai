import { parseCorsOrigins } from './cors.util';

describe('parseCorsOrigins', () => {
  it('returns localhost default when empty', () => {
    expect(parseCorsOrigins()).toEqual(['http://localhost:5173']);
    expect(parseCorsOrigins('   ')).toEqual(['http://localhost:5173']);
  });

  it('parses single origin', () => {
    expect(parseCorsOrigins('https://app.xcash.ai')).toEqual(['https://app.xcash.ai']);
  });

  it('parses comma-separated origins and deduplicates', () => {
    expect(
      parseCorsOrigins('https://app.xcash.ai, https://www.xcash.ai ,https://app.xcash.ai'),
    ).toEqual(['https://app.xcash.ai', 'https://www.xcash.ai']);
  });
});
