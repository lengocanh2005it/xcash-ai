import { Activity, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHealthCheck } from '@/hooks/useHealthCheck';

function App() {
  const { data, isLoading, isError, refetch, isFetching } = useHealthCheck();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <CardTitle>PayPilot AI</CardTitle>
          </div>
          <CardDescription>
            Sprint 1 tuần 1 — Frontend foundation: Tailwind, ShadCN/UI, TanStack Query, Axios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Server className="size-4 text-muted-foreground" />
              <span>Backend health</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : isError ? (
              <Badge variant="destructive">Offline</Badge>
            ) : (
              <Badge variant="secondary">{data?.status ?? 'unknown'}</Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            API base:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'}
            </code>
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? 'Đang kiểm tra...' : 'Kiểm tra lại kết nối API'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
