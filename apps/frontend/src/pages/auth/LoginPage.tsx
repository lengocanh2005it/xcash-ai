import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage, useAuth } from '@/hooks/useAuth';
import { isEmailNotVerifiedError } from '@/lib/errors';
import { getRememberedEmail, getRememberMePreference } from '@/lib/remember-me';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setRememberMe(getRememberMePreference());
    setEmail(getRememberedEmail());
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login({ email, password, rememberMe });
      toast.success('Đăng nhập thành công');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (isEmailNotVerifiedError(error)) {
        toast.message('Email chưa được xác thực', {
          description: 'Chúng tôi đang gửi mã OTP đến hộp thư của bạn.',
        });
        navigate(`/verify-email?email=${encodeURIComponent(email)}&autosend=1`, { replace: true });
        return;
      }
      toast.error(getErrorMessage(error, 'Email hoặc mật khẩu không đúng'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Đăng nhập" description="Đăng nhập để tiếp tục sử dụng X-Cash AI">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="admin@abc.edu.vn"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="cursor-pointer font-normal text-muted-foreground">
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            Ghi nhớ đăng nhập
          </Label>
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
