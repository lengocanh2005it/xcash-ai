import type { ToolDeps } from '../copilot-tool.types';
import { knowledgeTools, truncateAtSentenceBoundary } from './knowledge-tools';

const searchKnowledgeBaseTool = knowledgeTools.find((t) => t.name === 'search_knowledge_base');
if (!searchKnowledgeBaseTool) {
  throw new Error('search_knowledge_base tool not found in knowledgeTools');
}

function depsWithKnowledgeResult(
  sections: Array<{ id: string; title: string; content: string }>,
): ToolDeps {
  return {
    knowledgeService: {
      searchKnowledge: jest.fn().mockResolvedValue({
        sections,
        query: 'câu hỏi test',
        totalFound: sections.length,
      }),
    },
  } as never;
}

describe('truncateAtSentenceBoundary', () => {
  it('returns content unchanged when at or under 800 chars', () => {
    const content = 'a'.repeat(800);
    expect(truncateAtSentenceBoundary(content)).toBe(content);
  });

  it('returns short content unchanged without adding an ellipsis', () => {
    const content = 'Nội dung ngắn.';
    expect(truncateAtSentenceBoundary(content)).toBe(content);
  });

  it('cuts at the nearest sentence boundary at or before 800 chars', () => {
    const content = `${'a'.repeat(700)}. ${'b'.repeat(200)}`;
    expect(truncateAtSentenceBoundary(content)).toBe(`${'a'.repeat(700)}.…`);
  });

  it('falls back to a hard cut at 800 chars when no period appears in the first 800 chars', () => {
    const content = 'a'.repeat(1000);
    expect(truncateAtSentenceBoundary(content)).toBe(`${'a'.repeat(800)}…`);
  });
});

describe('search_knowledge_base tool execute', () => {
  it('truncates long section content and leaves short section content untouched', async () => {
    const shortContent = 'Nội dung ngắn.';
    const longContent = `${'x'.repeat(700)}. ${'y'.repeat(200)}`;
    const deps = depsWithKnowledgeResult([
      { id: 'sec-short', title: 'Ngắn', content: shortContent },
      { id: 'sec-long', title: 'Dài', content: longContent },
    ]);

    const result = (await searchKnowledgeBaseTool.execute(deps, 'tenant-1', {
      query: 'x',
    })) as {
      sections: Array<{ id: string; title: string; content: string }>;
      query: string;
      totalFound: number;
    };

    expect(result.sections[0]).toEqual({ id: 'sec-short', title: 'Ngắn', content: shortContent });
    expect(result.sections[1].id).toBe('sec-long');
    expect(result.sections[1].title).toBe('Dài');
    expect(result.sections[1].content).toBe(`${'x'.repeat(700)}.…`);
    expect(result.query).toBe('câu hỏi test');
    expect(result.totalFound).toBe(2);
  });

  it('returns an empty sections array unchanged when the knowledge base has no hits', async () => {
    const deps = depsWithKnowledgeResult([]);

    const result = (await searchKnowledgeBaseTool.execute(deps, 'tenant-1', {
      query: 'không tồn tại',
    })) as { sections: unknown[]; totalFound: number };

    expect(result.sections).toEqual([]);
    expect(result.totalFound).toBe(0);
  });
});
