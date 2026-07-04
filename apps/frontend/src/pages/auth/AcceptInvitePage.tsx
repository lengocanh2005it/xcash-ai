import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage, useAuth } from '@/hooks/useAuth';
import { getApiData } from '@/lib/api';

interface InvitePreview {
  email: string;
  name: string;
  businessName: string;
  role: string;
  inviterName: string;
  expiresInSeconds: number;
}

const roleLabel: Record<string, string> = {
  accountant: 'Kế toán',
  viewer: 'Chỉ xem',
};

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { acceptInvite } = useAuth();
  const token = searchParams.get('token') ?? '';

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('Link mời không hợp lệ');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    getApiData<InvitePreview>(`/auth/invite?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(error, 'Link mời không hợp lệ hoặc đã hết hạn'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsSubmitting(true);

    try {
      await acceptInvite({ token, password, confirmPassword });
      toast.success('Kích hoạt tài khoản thành công');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể kích hoạt tài khoản'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AuthLayout title="Kích hoạt tài khoản" description="Đang tải thông tin lời mời...">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthLayout>
    );
  }

  if (loadError || !preview) {
    return (
      <AuthLayout
        title="Link mời không hợp lệ"
        description={loadError ?? 'Vui lòng liên hệ Admin.'}
      >
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Kích hoạt tài khoản"
      description={`${preview.inviterName} mời bạn tham gia ${preview.businessName}`}
    >
      <div className="mb-4 rounded-lg border bg-muted/40 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Email:</span> {preview.email}
        </p>
        <p>
          <span className="text-muted-foreground">Vai trò:</span>{' '}
          {roleLabel[preview.role] ?? preview.role}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || password.length < 8 || confirmPassword.length < 8}
        >
          {isSubmitting ? 'Đang kích hoạt...' : 'Kích hoạt và đăng nhập'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Quay lại đăng nhập
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
