import {
  BellRing,
  Building2,
  CreditCard,
  Lock,
  MessageSquare,
  ScrollText,
  Sliders,
  Users,
} from 'lucide-react';
import { lazy, type ReactNode, Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import {
  canViewAuditLogs,
  canViewBankingSettings,
  canViewBilling,
  canViewThreshold,
  isAdmin,
} from '@/lib/rbac';
import { AuditTab } from '@/pages/settings/tabs/AuditTab';
import { BankingTab } from '@/pages/settings/tabs/BankingTab';
import { NotificationsTab } from '@/pages/settings/tabs/NotificationsTab';
import { ThresholdTab } from '@/pages/settings/tabs/ThresholdTab';

const BillingTab = lazy(() =>
  import('@/pages/settings/tabs/BillingTab').then((m) => ({ default: m.BillingTab })),
);
const TeamTab = lazy(() =>
  import('@/pages/settings/tabs/TeamTab').then((m) => ({ default: m.TeamTab })),
);
const CopilotHistoryTab = lazy(() =>
  import('@/pages/settings/tabs/CopilotHistoryTab').then((m) => ({ default: m.CopilotHistoryTab })),
);

// ─── Tab config ───────────────────────────────────────────────────

type SettingsTabConfig = {
  value: string;
  label: string;
  icon: typeof Building2;
  render: () => ReactNode;
  adminOnly?: boolean;
  auditOnly?: boolean;
  bankingOnly?: boolean;
  billingOnly?: boolean;
  thresholdOnly?: boolean;
};

function isSettingsTabLocked(tab: SettingsTabConfig, role?: string | null): boolean {
  if (tab.adminOnly && !isAdmin(role)) return true;
  if (tab.auditOnly && !canViewAuditLogs(role)) return true;
  if (tab.bankingOnly && !canViewBankingSettings(role)) return true;
  if (tab.billingOnly && !canViewBilling(role)) return true;
  if (tab.thresholdOnly && !canViewThreshold(role)) return true;
  return false;
}

const TAB_SKELETON = <Skeleton className="h-48 w-full" />;

// ─── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const userRole = user?.role;
  const activeTab = searchParams.get('tab') ?? 'banking';

  const tabs: SettingsTabConfig[] = useMemo(
    () => [
      {
        value: 'banking',
        label: 'Ngân hàng',
        icon: Building2,
        bankingOnly: true,
        render: () => <BankingTab />,
      },
      {
        value: 'threshold',
        label: 'Ngưỡng AI',
        icon: Sliders,
        thresholdOnly: true,
        render: () => <ThresholdTab />,
      },
      {
        value: 'notifications',
        label: 'Thông báo',
        icon: BellRing,
        adminOnly: true,
        render: () => <NotificationsTab />,
      },
      {
        value: 'team',
        label: 'Thành viên',
        icon: Users,
        adminOnly: true,
        render: () => (
          <Suspense fallback={TAB_SKELETON}>
            <TeamTab />
          </Suspense>
        ),
      },
      {
        value: 'audit',
        label: 'Nhật ký',
        icon: ScrollText,
        auditOnly: true,
        render: () => <AuditTab />,
      },
      {
        value: 'billing',
        label: 'Gói dịch vụ',
        icon: CreditCard,
        billingOnly: true,
        render: () => (
          <Suspense fallback={TAB_SKELETON}>
            <BillingTab />
          </Suspense>
        ),
      },
      {
        value: 'copilot-history',
        label: 'Lịch sử Copilot',
        icon: MessageSquare,
        render: () => (
          <Suspense fallback={TAB_SKELETON}>
            <CopilotHistoryTab />
          </Suspense>
        ),
      },
    ],
    [],
  );

  const defaultTab = useMemo(
    () => tabs.find((tab) => !isSettingsTabLocked(tab, userRole))?.value ?? 'copilot-history',
    [tabs, userRole],
  );

  useEffect(() => {
    const current = tabs.find((tab) => tab.value === activeTab);
    if (current && isSettingsTabLocked(current, userRole)) {
      setSearchParams({ tab: defaultTab }, { replace: true });
    }
  }, [activeTab, defaultTab, setSearchParams, tabs, userRole]);

  const resolvedTab =
    tabs.find((tab) => tab.value === activeTab && !isSettingsTabLocked(tab, userRole))?.value ??
    defaultTab;

  return (
    <>
      <Header title="Cài đặt" description="Quản lý tài khoản và cấu hình hệ thống" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Tabs
          value={resolvedTab}
          onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
        >
          <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const locked = isSettingsTabLocked(tab, userRole);
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={locked}
                  className="gap-1.5"
                  title={tab.label}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {locked && <Lock className="size-3 opacity-50" />}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              {resolvedTab === tab.value ? tab.render() : null}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}
