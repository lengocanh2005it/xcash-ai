import { Bot, StopCircle } from 'lucide-react';
import { CopilotActionCard } from '@/components/copilot/CopilotActionCard';
import { CopilotMessageActions } from '@/components/copilot/CopilotMessageActions';
import type { CopilotActivity } from '@/components/copilot/CopilotSourceChips';
import { CopilotSourceChips } from '@/components/copilot/CopilotSourceChips';
import { HighlightedText } from '@/components/shared/HighlightedText';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  activities?: CopilotActivity[];
  isPartial?: boolean;
}

export function CopilotMessageBubble({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-none bg-muted px-4 py-3 text-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 group/msg">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground mt-0.5">
        <Bot className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          <HighlightedText text={msg.content} />
        </div>
        {msg.activities && msg.activities.length > 0 && (
          <>
            <CopilotSourceChips
              activities={msg.activities.filter((a) => a.kind !== 'action_card')}
            />
            {msg.activities
              .filter((a) => a.kind === 'action_card' && a.actionCard)
              .map((a) => (
                // biome-ignore lint/style/noNonNullAssertion: filtered above
                <CopilotActionCard key={a.actionCard!.transactionId} actionCard={a.actionCard!} />
              ))}
          </>
        )}
        {msg.isPartial && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <StopCircle className="size-3" />
            Đã dừng
          </span>
        )}
        <div className="mt-1.5 flex opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity">
          <CopilotMessageActions content={msg.content} />
        </div>
      </div>
    </div>
  );
}
