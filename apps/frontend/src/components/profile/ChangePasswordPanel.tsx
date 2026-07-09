import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { postApiData } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

const RESEND_COOLDOWN_SECONDS = 60;

interface ChangePasswordPanelProps {
  active: boolean;
  onCancel: () => void;
  onComplete: () => void;
  onStepChange?: (step: 'passwords' | 'otp') => void;
}

interface ChangePasswordRequestResult {
  message: string;
  otpExpiresInSeconds: number;
}

interface ChangePasswordConfirmResult {
  message: string;
}

export function ChangePasswordPanel({
  active,
  onCancel,
  onComplete,
  onStepChange,
}: ChangePasswordPanelProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [step, setStep] = useState<'passwords' | 'otp'>('passwords');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!active) {
      setStep('passwords');
      onStepChange?.('passwords');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setCooldown(0);
      setConfirmOpen(false);
    }
  }, [active, onStepChange]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const requestMutation = useMutation({
    mutationFn: (payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => postApiData<ChangePasswordRequestResult>('/auth/change-password/request', payload),
    onSuccess: (result) => {
      setConfirmOpen(false);
      toast.success(result.message);
      setStep('otp');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể gửi mã OTP')),
  });

  const resendMutation = useMutation({
    mutationFn: () => postApiData<ChangePasswordRequestResult>('/auth/change-password/resend', {}),
    onSuccess: (result) => {
      toast.success(result.message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể gửi lại mã OTP')),
  });

  const confirmMutation = useMutation({
    mutationFn: (payload: { otp: string }) =>
      postApiData<ChangePasswordConfirmResult>('/auth/change-password/confirm', payload),
    onSuccess: async (result) => {
      toast.success(result.message);
      onComplete();
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể đổi mật khẩu')),
  });

  const isPending =
    requestMutation.isPending || resendMutation.isPending || confirmMutation.isPending;

  const handlePasswordSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    if (currentPassword === newPassword) {
      toast.error('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmRequestOtp = () => {
    requestMutation.mutate({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  const handleOtpSubmit = (event: FormEvent) => {
    event.preventDefault();
    confirmMutation.mutate({ otp });
  };

  const handleResend = () => {
    if (cooldown > 0 || resendMutation.isPending) {
      return;
    }
    resendMutation.mutate();
  };

  if (!active) {
    return null;
  }

  if (step === 'passwords') {
    return (
      <>
        <form className="space-y-4" onSubmit={handlePasswordSubmit}>
          <div className="space-y-2">
            <Label htmlFor="change-current-password">Mật khẩu hiện tại</Label>
            <Input
              id="change-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-new-password">Mật khẩu mới</Label>
            <Input
              id="change-new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-confirm-password">Nhập lại mật khẩu mới</Label>
            <Input
              id="change-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Quay lại
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                currentPassword.length < 8 ||
                newPassword.length < 8 ||
                confirmPassword.length < 8
              }
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang gửi OTP...
                </>
              ) : (
                'Tiếp tục'
              )}
            </Button>
          </DialogFooter>
        </form>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) => !requestMutation.isPending && setConfirmOpen(open)}
          title="Xác nhận đổi mật khẩu?"
          description="Hệ thống sẽ gửi mã OTP qua email để xác thực. Sau khi đổi thành công, bạn sẽ cần đăng nhập lại. Bạn có chắc muốn tiếp tục?"
          confirmLabel="Đồng ý"
          cancelLabel="Hủy"
          loading={requestMutation.isPending}
          onConfirm={handleConfirmRequestOtp}
        />
      </>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleOtpSubmit}>
      <div className="space-y-2">
        <Label htmlFor="change-otp">Mã OTP</Label>
        <Input
          id="change-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          minLength={6}
          maxLength={6}
          pattern="\d{6}"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={resendMutation.isPending || cooldown > 0}
        onClick={handleResend}
      >
        {cooldown > 0
          ? `Gửi lại mã sau ${cooldown}s`
          : resendMutation.isPending
            ? 'Đang gửi...'
            : 'Gửi lại mã OTP'}
      </Button>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setStep('passwords')}>
          Quay lại
        </Button>
        <Button type="submit" disabled={isPending || otp.length !== 6}>
          {confirmMutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Đang xác nhận...
            </>
          ) : (
            'Xác nhận đổi mật khẩu'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
