import { Activity } from 'lucide-react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-svh bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-md items-center">
        <Card className="w-full border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Activity className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl text-foreground">{title}</CardTitle>
              </div>
            </div>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
