import { BarChart3, Bot, FileCheck2, Landmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STEPS = [
  {
    icon: Landmark,
    title: 'Liên kết ngân hàng',
    description:
      'Kết nối tài khoản ngân hàng qua Cas Link để giao dịch tự động đổ về X-Cash AI theo thời gian thực.',
  },
  {
    icon: Bot,
    title: 'AI tự động định khoản',
    description:
      'Mỗi giao dịch mới sẽ được AI phân loại theo chuẩn TT133 — tự động ghi Nợ/Có nếu độ tin cậy đủ cao.',
  },
  {
    icon: FileCheck2,
    title: 'Human Review khi cần',
    description:
      'Giao dịch có độ tin cậy thấp sẽ vào hàng chờ Human Review để kế toán xác nhận hoặc sửa lại.',
  },
  {
    icon: BarChart3,
    title: 'Báo cáo & Copilot',
    description:
      'Xem báo cáo thu/chi, xuất Excel cuối tháng, hoặc hỏi AI Copilot bất kỳ câu hỏi tài chính nào.',
  },
];

function storageKey(userId: string) {
  return `xcash_welcome_tour_seen_${userId}`;
}

export function WelcomeTour({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(storageKey(userId));
    if (!seen) setOpen(true);
  }, [userId]);

  const dismiss = () => {
    localStorage.setItem(storageKey(userId), '1');
    setOpen(false);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <current.icon className="size-5" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Bước {step + 1}/{STEPS.length}
          </p>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30'
              }`}
              aria-hidden
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            Bỏ qua
          </Button>
          <Button onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}>
            {isLast ? 'Bắt đầu' : 'Tiếp theo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
