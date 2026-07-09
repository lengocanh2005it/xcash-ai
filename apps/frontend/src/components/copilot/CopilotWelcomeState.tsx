import {
  BarChart2,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  HelpCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const SUGGESTIONS = [
  { icon: TrendingUp, text: 'Doanh thu tháng này bao nhiêu?' },
  { icon: BarChart2, text: 'So sánh tháng này với tháng trước' },
  { icon: ClipboardList, text: 'Có bao nhiêu giao dịch chờ xét duyệt?' },
  { icon: CreditCard, text: 'Xem thông tin gói dịch vụ' },
  { icon: Building2, text: 'Đã liên kết ngân hàng chưa?' },
  { icon: BookOpen, text: 'Tra cứu tài khoản TT133' },
  { icon: HelpCircle, text: 'Không thấy giao dịch từ Casso?' },
  { icon: Sparkles, text: 'Tìm giao dịch theo từ khóa' },
];

interface CopilotWelcomeStateProps {
  onSendMessage: (text: string) => void;
}

export function CopilotWelcomeState({ onSendMessage }: CopilotWelcomeStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12 gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <Bot className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mình có thể giúp bạn</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Hỏi đáp kế toán, tra cứu số liệu, xem báo cáo và quản lý giao dịch — tất cả ngay trong
            chat.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
        {SUGGESTIONS.map(({ icon: Icon, text }) => (
          <button
            key={text}
            type="button"
            onClick={() => onSendMessage(text)}
            className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 px-4 py-3 text-left text-sm transition-colors group"
          >
            <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
              {text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
