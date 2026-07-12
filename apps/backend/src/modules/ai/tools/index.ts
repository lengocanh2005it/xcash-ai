import type { CopilotToolEntry } from '../copilot-tool.types';
import { accountTools } from './account-tools';
import { actionTools } from './action-tools';
import { billingTools } from './billing-tools';
import { knowledgeTools } from './knowledge-tools';
import { reportTools } from './report-tools';
import { reviewTools } from './review-tools';

export const ALL_TOOLS: CopilotToolEntry[] = [
  ...reportTools,
  ...reviewTools,
  ...accountTools,
  ...knowledgeTools,
  ...billingTools,
  ...actionTools,
];
