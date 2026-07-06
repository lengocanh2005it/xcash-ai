import { Skeleton } from '@/components/ui/skeleton';

export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-4 p-4 sm:p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['a', 'b', 'c', 'd'] as const).map((key) => (
          <Skeleton key={key} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-2 h-64 w-full rounded-xl" />
    </div>
  );
}
