export const AI_CLASSIFY_JOB = 'ai-classify';

/** Few-shot: chỉ lấy ví dụ auto khi confidence >= ngưỡng này (tránh nhiễu từ AI chưa review). */
export const FEW_SHOT_MIN_AUTO_CONFIDENCE = 90;

/** Few-shot: cosine similarity tối thiểu (1 - distance pgvector). */
export const FEW_SHOT_MIN_SIMILARITY = 0.75;

export const FEW_SHOT_EXAMPLE_LIMIT = 5;

export const AI_CLASSIFY_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
};
