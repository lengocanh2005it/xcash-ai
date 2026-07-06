import { BarChart3, BookOpen, ExternalLink, Globe } from 'lucide-react';
import { useState } from 'react';
import { HighlightedText } from '@/components/shared/HighlightedText';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type CopilotActivityKind = 'internal_data' | 'knowledge' | 'web_search';

export interface CopilotActivity {
  kind: CopilotActivityKind;
  label: string;
  source?: string;
  urls?: string[];
  snippet?: string;
}

interface Props {
  activities: CopilotActivity[];
}

const KIND_ICON: Record<CopilotActivityKind, typeof BarChart3> = {
  internal_data: BarChart3,
  knowledge: BookOpen,
  web_search: Globe,
};

function SnippetPopover({
  activity,
  children,
}: {
  activity: CopilotActivity;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasContent = activity.snippet || (activity.urls && activity.urls.length > 0);

  if (!hasContent) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onClick={() => setOpen((v) => !v)} className="focus:outline-none">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-3 text-xs space-y-2"
        sideOffset={6}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {(() => {
            const Icon = KIND_ICON[activity.kind];
            return <Icon className="size-3.5 shrink-0 text-muted-foreground" />;
          })()}
          <span>{activity.label}</span>
          {activity.source && (
            <span className="ml-auto text-muted-foreground font-normal">{activity.source}</span>
          )}
        </div>

        {/* Snippet */}
        {activity.snippet && (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line border-t pt-2 text-[11px]">
            <HighlightedText text={activity.snippet} />
          </p>
        )}

        {/* URLs for web_search */}
        {activity.kind === 'web_search' && activity.urls && activity.urls.length > 0 && (
          <div className="flex flex-col gap-1 border-t pt-2">
            {activity.urls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline truncate"
              >
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function CopilotSourceChips({ activities }: Props) {
  if (activities.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
      <span className="text-xs text-muted-foreground">Nguồn:</span>
      {activities.map((a, i) => {
        const Icon = KIND_ICON[a.kind];
        const isWeb = a.kind === 'web_search';
        const hasContent = a.snippet || (a.urls && a.urls.length > 0);

        const badge = (
          <Badge
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list, no reorder
            key={i}
            variant={a.kind === 'internal_data' ? 'secondary' : 'outline'}
            className={[
              'gap-1 font-normal text-xs',
              isWeb ? 'border-amber-500/50 text-amber-800 dark:text-amber-200' : '',
              hasContent ? 'cursor-pointer hover:bg-muted/80 transition-colors' : '',
            ].join(' ')}
          >
            <Icon className="size-3 shrink-0" />
            {a.kind === 'knowledge' && a.source ? (
              <span>
                <span className="opacity-60">{a.source} · </span>
                {a.label}
              </span>
            ) : (
              <span>{a.label}</span>
            )}
            {hasContent && <span className="opacity-50 text-[10px]">↑</span>}
          </Badge>
        );

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable list, no reorder
          <SnippetPopover key={i} activity={a}>
            {badge}
          </SnippetPopover>
        );
      })}
    </div>
  );
}
