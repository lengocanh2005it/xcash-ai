import { BILLING_SETTINGS_KNOWLEDGE } from './billing-settings';
import { CASSO_KNOWLEDGE, type KnowledgeSection } from './casso';
import { TT133_KNOWLEDGE } from './tt133';
import { XCASH_FEATURES_KNOWLEDGE } from './xcash-features';

export const ALL_SECTIONS: KnowledgeSection[] = [
  ...CASSO_KNOWLEDGE,
  ...TT133_KNOWLEDGE,
  ...XCASH_FEATURES_KNOWLEDGE,
  ...BILLING_SETTINGS_KNOWLEDGE,
];

/** Knowledge used internally by Copilot — not shown as "Nguồn" chips in the chat UI. */
export const KNOWLEDGE_SECTION_IDS_HIDDEN_FROM_SOURCES = new Set(
  ALL_SECTIONS.filter((s) => s.citeInSources === false).map((s) => s.id),
);

export interface KnowledgeSearchResult {
  sections: Array<{ id: string; title: string; content: string }>;
  query: string;
  totalFound: number;
}

/** Keyword hit at/above this score skips pgvector + embedding API (fast path). */
export const KNOWLEDGE_KEYWORD_STRONG_MATCH_THRESHOLD = 10;

function scoreKnowledgeSections(
  query: string,
): Array<{ section: KnowledgeSection; score: number }> {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 1);

  return ALL_SECTIONS.map((section) => {
    let score = 0;
    for (const kw of section.keywords) {
      if (q.includes(kw)) score += 10;
      else if (kw.includes(q)) score += 5;
      else for (const word of words) if (kw.includes(word)) score += 2;
    }
    const titleLower = section.title.toLowerCase();
    if (titleLower.includes(q)) score += 8;
    else for (const word of words) if (titleLower.includes(word)) score += 3;
    const contentLower = section.content.toLowerCase();
    for (const word of words) if (contentLower.includes(word)) score += 1;
    return { section, score };
  });
}

export function getTopKeywordKnowledgeScore(query: string): number {
  if (!query.trim()) return 0;
  return Math.max(0, ...scoreKnowledgeSections(query).map((s) => s.score));
}

export function hasStrongKeywordKnowledgeMatch(
  query: string,
  threshold = KNOWLEDGE_KEYWORD_STRONG_MATCH_THRESHOLD,
): boolean {
  return getTopKeywordKnowledgeScore(query) >= threshold;
}

/**
 * Keyword-based fallback search — dùng khi pgvector chưa có data hoặc fast path.
 */
export function searchKnowledgeByKeyword(query: string, maxResults = 2): KnowledgeSearchResult {
  if (!query.trim()) return { sections: [], query, totalFound: 0 };

  const relevant = scoreKnowledgeSections(query)
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return {
    sections: relevant.map((r) => ({
      id: r.section.id,
      title: r.section.title,
      content: r.section.content,
    })),
    query,
    totalFound: relevant.length,
  };
}

export type { KnowledgeSection };
