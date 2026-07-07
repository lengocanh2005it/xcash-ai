interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const AI_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'text-embedding-3-small': { inputPer1M: 0.02, outputPer1M: 0 },
};

const DEFAULT_PRICING: ModelPricing = { inputPer1M: 0.15, outputPer1M: 0.6 };

export function calcCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = AI_PRICING[model] ?? DEFAULT_PRICING;
  return (tokensIn * pricing.inputPer1M + tokensOut * pricing.outputPer1M) / 1_000_000;
}
