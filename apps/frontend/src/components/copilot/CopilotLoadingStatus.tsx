import { BarChart3, BookOpen, Database, Globe } from 'lucide-react';

export interface StreamActivity {
  kind: 'internal_data' | 'knowledge' | 'web_search';
  label: string;
  source?: string;
}

interface Props {
  activity?: StreamActivity;
}

export function CopilotLoadingStatus({ activity }: Props) {
  if (!activity) {
    return (
      <div className="flex gap-1 items-center h-4">
        <span className="size-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="size-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="size-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    );
  }

  const Icon =
    activity.kind === 'web_search'
      ? Globe
      : activity.kind === 'knowledge'
        ? BookOpen
        : activity.kind === 'internal_data'
          ? BarChart3
          : Database;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
      <Icon
        className={`size-4 shrink-0 animate-pulse ${activity.kind === 'web_search' ? 'text-amber-600' : 'text-primary'}`}
      />
      <span>{activity.label}</span>
      {activity.source && activity.kind === 'web_search' && (
        <span className="text-xs opacity-70">({activity.source})</span>
      )}
    </div>
  );
}
