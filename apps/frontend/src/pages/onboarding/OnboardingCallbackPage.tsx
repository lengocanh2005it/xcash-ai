import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/hooks/useAuth';
import { useOnboardingMutations } from '@/hooks/useOnboarding';
import {
  CAS_LINK_FAILED_TOAST,
  parseCasLinkCallback,
  postCasLinkMessageToOpener,
} from '@/lib/casLink';

export default function OnboardingCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeCallback } = useOnboardingMutations();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    handledRef.current = true;
    const result = parseCasLinkCallback(searchParams.toString());

    if (result.status === 'cancelled') {
      if (postCasLinkMessageToOpener(result)) {
        window.close();
        return;
      }

      toast.error(CAS_LINK_FAILED_TOAST);
      navigate('/onboarding', { replace: true });
      return;
    }

    if (result.status === 'error') {
      if (postCasLinkMessageToOpener(result)) {
        window.close();
        return;
      }

      toast.error(result.message || CAS_LINK_FAILED_TOAST);
      navigate('/onboarding', { replace: true });
      return;
    }

    if (postCasLinkMessageToOpener(result)) {
      window.close();
      return;
    }

    completeCallback
      .mutateAsync(result.publicToken)
      .then(() => {
        toast.success('Liên kết ngân hàng thành công!');
        navigate('/dashboard', { replace: true });
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, 'Không thể hoàn tất liên kết ngân hàng'));
        navigate('/onboarding', { replace: true });
      });
  }, [completeCallback, navigate, searchParams]);

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Đang xử lý liên kết ngân hàng</CardTitle>
          <CardDescription>Vui lòng đợi trong giây lát...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Hoàn tất callback Cas Link
        </CardContent>
      </Card>
    </div>
  );
}
