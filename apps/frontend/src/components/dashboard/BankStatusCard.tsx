import { CheckCircle2, Landmark } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BankAccountDetailsDialog } from '@/components/dashboard/BankAccountDetailsDialog';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { Button } from '@/components/ui/button';
import type { OnboardingGrant } from '@/types/onboarding';

interface BankStatusCardProps {
  bankingLinked: boolean;
  grants: OnboardingGrant[];
}

export function BankStatusCard({ bankingLinked, grants }: BankStatusCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const bankAction =
    bankingLinked && grants.length > 0 ? (
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => setDetailsOpen(true)}
        aria-label="Xem thông tin tài khoản ngân hàng"
        title="Xem thông tin tài khoản"
      >
        <Landmark className="size-4" />
      </button>
    ) : (
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Landmark className="size-4" />
      </div>
    );

  const linkedFooter = (
    <p className="flex items-center gap-2 text-sm text-primary">
      <CheckCircle2 className="size-4 shrink-0" />
      Sẵn sàng nhận giao dịch
      {grants.length > 1 ? (
        <span className="text-muted-foreground">· {grants.length} tài khoản</span>
      ) : null}
    </p>
  );

  return (
    <>
      <DashboardStatCard
        label="Trạng thái ngân hàng"
        value={bankingLinked ? 'Đã liên kết' : 'Chưa liên kết'}
        action={bankAction}
        footer={
          bankingLinked ? (
            linkedFooter
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/onboarding">Tiếp tục onboarding</Link>
            </Button>
          )
        }
      />

      {bankingLinked && grants.length > 0 ? (
        <BankAccountDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          grants={grants}
        />
      ) : null}
    </>
  );
}
