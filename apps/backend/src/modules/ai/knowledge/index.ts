import { CASSO_KNOWLEDGE, type KnowledgeSection } from './casso';
import { TT133_KNOWLEDGE } from './tt133';
import { XCASH_FEATURES_KNOWLEDGE } from './xcash-features';

export const ALL_SECTIONS: KnowledgeSection[] = [
  ...CASSO_KNOWLEDGE,
  ...TT133_KNOWLEDGE,
  ...XCASH_FEATURES_KNOWLEDGE,
];

export interface KnowledgeSearchResult {
  sections: Array<{ id: string; title: string; content: string }>;
  query: string;
  totalFound: number;
}

/**
 * Keyword-based fallback search — dùng khi pgvector chưa có data.
 */
export function searchKnowledgeByKeyword(query: string, maxResults = 2): KnowledgeSearchResult {
  if (!query.trim()) return { sections: [], query, totalFound: 0 };

  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 1);

  const scored = ALL_SECTIONS.map((section) => {
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

  const relevant = scored
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
