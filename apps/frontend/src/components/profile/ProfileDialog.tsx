import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Role } from '@xcash/shared-types';
import { Building2, Camera, ChevronLeft, KeyRound, Loader2, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChangePasswordPanel } from '@/components/profile/ChangePasswordPanel';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { api, getApiData, patchApiData } from '@/lib/api';
import { prepareAvatarFile } from '@/lib/avatar-image';
import { getErrorMessage } from '@/lib/errors';
import { PLAN_LABEL } from '@/lib/plan';
import type { UpdateProfileInput, UserProfile } from '@/types/profile';
import { profileToAuthUser } from '@/types/profile';

const roleLabel: Record<string, string> = {
  admin: 'Quản trị viên',
  accountant: 'Kế toán',
  viewer: 'Người xem',
  cas_partner: 'Cas Partner',
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function uploadAvatarFile(file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<{ data: UserProfile }>('/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data as UserProfile;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordStep, setChangePasswordStep] = useState<'passwords' | 'otp'>('passwords');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getApiData<UserProfile>('/profile'),
    enabled: open,
  });

  const clearPendingAvatar = () => {
    setPendingAvatarFile(null);
    setPendingAvatarPreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  };

  useEffect(() => {
    if (!profile) {
      return;
    }
    setName(profile.name);
    setBusinessName(profile.businessName ?? '');
  }, [profile]);

  useEffect(() => {
    if (!open) {
      clearPendingAvatar();
      setChangePasswordOpen(false);
      setChangePasswordStep('passwords');
    }
  }, [open]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChangePasswordOpen(false);
      setChangePasswordStep('passwords');
    }
    onOpenChange(nextOpen);
  };

  const handleBackToProfile = () => {
    setChangePasswordOpen(false);
    setChangePasswordStep('passwords');
  };

  const applyProfileToUi = (next: UserProfile) => {
    updateUser(profileToAuthUser(next));
    queryClient.setQueryData(['profile'], next);
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      payload,
      avatarFile,
    }: {
      payload: UpdateProfileInput;
      avatarFile: File | null;
    }) => {
      let result: UserProfile | undefined;
      let profilePatched = false;

      try {
        if (Object.keys(payload).length > 0) {
          result = await patchApiData<UserProfile>('/profile', payload);
          profilePatched = true;
        }

        if (avatarFile) {
          result = await uploadAvatarFile(avatarFile);
        }

        return result;
      } catch (error) {
        if (profilePatched) {
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          throw new Error('PROFILE_PARTIAL');
        }
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result) {
        applyProfileToUi(result);
      }
      clearPendingAvatar();
      toast.success('Đã cập nhật thông tin');
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'PROFILE_PARTIAL') {
        toast.error('Đã cập nhật thông tin nhưng không upload được ảnh đại diện');
        return;
      }
      toast.error(getErrorMessage(error, 'Không thể lưu thông tin'));
    },
  });

  const canEditBusiness = profile?.role === Role.ADMIN && Boolean(profile?.tenantId);
  const hasBusinessTab = Boolean(profile?.tenantId);
  const displayAvatarUrl = pendingAvatarPreview ?? profile?.avatarUrl ?? null;

  const buildPayload = (): UpdateProfileInput => {
    const payload: UpdateProfileInput = {};

    if (name.trim() && name.trim() !== profile?.name) {
      payload.name = name.trim();
    }

    if (canEditBusiness) {
      if (businessName.trim() !== (profile?.businessName ?? '')) {
        payload.businessName = businessName.trim();
      }
    }

    return payload;
  };

  const handleSave = () => {
    const payload = buildPayload();
    const hasTextChanges = Object.keys(payload).length > 0;
    const hasAvatarChange = pendingAvatarFile !== null;

    if (!hasTextChanges && !hasAvatarChange) {
      toast.info('Không có thay đổi nào để lưu');
      return;
    }

    saveMutation.mutate({ payload, avatarFile: pendingAvatarFile });
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('Ảnh vượt quá giới hạn 5MB');
      return;
    }

    try {
      const prepared = await prepareAvatarFile(file);
      setPendingAvatarPreview((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return URL.createObjectURL(prepared);
      });
      setPendingAvatarFile(prepared);
    } catch {
      toast.error('Không thể xử lý ảnh, vui lòng thử file khác');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Thông tin tài khoản</DialogTitle>
          <DialogDescription>
            {changePasswordOpen
              ? changePasswordStep === 'passwords'
                ? 'Nhập mật khẩu hiện tại và mật khẩu mới. Hệ thống sẽ gửi mã OTP qua email để xác thực.'
                : 'Nhập mã OTP 6 chữ số đã gửi đến email của bạn để hoàn tất đổi mật khẩu.'
              : `Xem và chỉnh sửa thông tin cá nhân${hasBusinessTab ? ' cùng doanh nghiệp' : ''}.`}
          </DialogDescription>
        </DialogHeader>

        {changePasswordOpen ? (
          <div className="space-y-4">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleBackToProfile}
            >
              <ChevronLeft className="size-4" />
              Quay lại thông tin tài khoản
            </button>

            <div className="flex items-center gap-2 border-b pb-3">
              <KeyRound className="size-5 text-primary" />
              <p className="font-medium">Đổi mật khẩu</p>
            </div>

            <ChangePasswordPanel
              active={changePasswordOpen}
              onCancel={handleBackToProfile}
              onComplete={() => onOpenChange(false)}
              onStepChange={setChangePasswordStep}
            />
          </div>
        ) : isLoading || !profile ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Đang tải thông tin...
          </div>
        ) : (
          <Tabs defaultValue="personal" className="w-full">
            <TabsList
              className={hasBusinessTab ? 'grid w-full grid-cols-2' : 'grid w-full grid-cols-1'}
            >
              <TabsTrigger value="personal" className="gap-2">
                <UserRound className="size-4" />
                Cá nhân
              </TabsTrigger>
              {hasBusinessTab ? (
                <TabsTrigger value="business" className="gap-2">
                  <Building2 className="size-4" />
                  Doanh nghiệp
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="personal" className="space-y-5 pt-2">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <UserAvatar name={name || profile.name} avatarUrl={displayAvatarUrl} size="lg" />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    className="absolute right-0 bottom-0 rounded-full shadow-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saveMutation.isPending}
                    aria-label="Chọn ảnh đại diện"
                  >
                    <Camera className="size-4" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{name || profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel[profile.role] ?? profile.role}
                    {profile.plan ? ` · ${PLAN_LABEL[profile.plan]}` : ''}
                  </p>
                  {pendingAvatarFile ? (
                    <p className="text-xs text-primary">Ảnh mới — nhấn Lưu thay đổi để tải lên</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-name">Họ và tên</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nhập họ và tên"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={profile.email} disabled />
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setChangePasswordOpen(true)}
                >
                  <KeyRound className="size-4" />
                  Đổi mật khẩu
                </Button>
              </div>
            </TabsContent>

            {hasBusinessTab ? (
              <TabsContent value="business" className="space-y-4 pt-2">
                {!canEditBusiness ? (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    Chỉ Admin mới được chỉnh sửa tên doanh nghiệp.
                  </p>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="profile-business-name">Tên doanh nghiệp</Label>
                  <Input
                    id="profile-business-name"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    disabled={!canEditBusiness}
                    placeholder="Tên doanh nghiệp"
                  />
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
        )}

        {!changePasswordOpen ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || isLoading || !profile}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
