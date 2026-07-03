import { Role } from '@xcash/shared-types';
import { CheckCircle2, Circle, Landmark, Loader2, LogOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage, useAuth } from '@/hooks/useAuth';
import { useOnboardingMutations } from '@/hooks/useOnboarding';
import { CAS_LINK_FAILED_TOAST, type CasLinkMessage, openCasLinkPopup } from '@/lib/casLink';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, onboardingStatus, isOnboardingLoading, logout } = useAuth();
  const { createGrantToken, completeCallback } = useOnboardingMutations();
  const [isLinking, setIsLinking] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const popupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const linkFlowSettledRef = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const canLinkBanking = user?.role === Role.ADMIN || user?.role === Role.ACCOUNTANT;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('Đã đăng xuất');
      navigate('/login', { replace: true });
    } catch {
      toast.error('Không thể đăng xuất, vui lòng thử lại');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const clearPopupPoll = useCallback(() => {
    if (popupPollRef.current) {
      clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
  }, []);

  const watchPopupClose = (popup: Window) => {
    clearPopupPoll();
    popupPollRef.current = setInterval(() => {
      if (popup.closed) {
        clearPopupPoll();
        setIsLinking(false);
        if (!linkFlowSettledRef.current) {
          toast.error(CAS_LINK_FAILED_TOAST);
        }
        linkFlowSettledRef.current = false;
      }
    }, 500);
  };

  useEffect(() => {
    if (!isOnboardingLoading && onboardingStatus?.bankingLinked) {
      navigate('/dashboard', { replace: true });
    }
  }, [isOnboardingLoading, onboardingStatus?.bankingLinked, navigate]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const payload = event.data as CasLinkMessage | undefined;
      if (!payload?.type) {
        return;
      }

      if (payload.type === 'CAS_LINK_CANCELLED') {
        linkFlowSettledRef.current = true;
        popupRef.current?.close();
        clearPopupPoll();
        setIsLinking(false);
        toast.error(CAS_LINK_FAILED_TOAST);
        return;
      }

      if (payload.type === 'CAS_LINK_ERROR') {
        linkFlowSettledRef.current = true;
        popupRef.current?.close();
        clearPopupPoll();
        setIsLinking(false);
        toast.error(payload.message || CAS_LINK_FAILED_TOAST);
        return;
      }

      if (payload.type !== 'CAS_LINK_SUCCESS' || !payload.publicToken) {
        return;
      }

      try {
        linkFlowSettledRef.current = true;
        await completeCallback.mutateAsync(payload.publicToken);
        popupRef.current?.close();
        toast.success('Liên kết ngân hàng thành công!');
        navigate('/dashboard');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Không thể hoàn tất liên kết ngân hàng'));
      } finally {
        clearPopupPoll();
        setIsLinking(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearPopupPoll();
    };
  }, [completeCallback, navigate, clearPopupPoll]);

  const handleLinkBanking = async () => {
    linkFlowSettledRef.current = false;
    setIsLinking(true);

    try {
      const result = await createGrantToken.mutateAsync();
      const popup = openCasLinkPopup(result.grantToken, result.redirectUri, result.linkBaseUrl);
      popupRef.current = popup;

      if (!popup) {
        toast.error('Trình duyệt đã chặn popup. Vui lòng cho phép popup và thử lại.');
        setIsLinking(false);
        return;
      }

      watchPopupClose(popup);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể mở Cas Link'));
      setIsLinking(false);
    }
  };

  if (isOnboardingLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Skeleton className="h-10 w-72" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-muted">
      <Header
        title="Thiết lập ban đầu"
        description="Hoàn tất các bước dưới đây để bắt đầu nhận giao dịch tự động"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="size-4" />
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </Button>
        }
      />

      <div className="mx-auto grid max-w-4xl gap-4 p-4 sm:gap-6 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Tiến trình onboarding</CardTitle>
            <CardDescription>Theo dõi các bước thiết lập tài khoản doanh nghiệp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(onboardingStatus?.steps ?? []).map((step) => (
              <div key={step.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                {step.completed ? (
                  <CheckCircle2 className="size-5 text-primary" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.label}</p>
                </div>
                {step.completed ? <Badge variant="secondary">Hoàn thành</Badge> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5" />
              Liên kết tài khoản ngân hàng
            </CardTitle>
            <CardDescription>
              Kết nối tài khoản ngân hàng qua Cas Link để X-Cash AI tự động nhận giao dịch
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {onboardingStatus?.grants.length ? (
              <div className="space-y-3">
                {onboardingStatus.grants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{grant.bankName ?? 'Ngân hàng'}</p>
                      <p className="text-xs text-muted-foreground">{grant.accountNumber ?? '—'}</p>
                    </div>
                    <Badge variant="secondary">Đã liên kết</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chưa liên kết tài khoản ngân hàng nào. Bấm nút bên dưới để bắt đầu.
              </p>
            )}

            {canLinkBanking ? (
              <Button type="button" onClick={handleLinkBanking} disabled={isLinking}>
                {isLinking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang mở Cas Link...
                  </>
                ) : (
                  'Liên kết ngân hàng'
                )}
              </Button>
            ) : (
              <p className={cn('text-sm text-muted-foreground')}>
                Tài khoản Viewer không có quyền liên kết ngân hàng. Vui lòng liên hệ Admin hoặc Kế
                toán.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Sandbox demo: username <code>bankusrdemo1</code>, password <code>soproud</code>, OTP{' '}
              <code>123456</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
