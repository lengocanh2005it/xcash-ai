import { ScrollText } from 'lucide-react';
import { AuditLogPanel } from '@/components/audit/AuditLogPanel';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PartnerAuditPage() {
  return (
    <>
      <Header
        title="Nhật ký hoạt động"
        description="Theo dõi thao tác Partner trên toàn hệ thống"
      />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="size-4" />
              Audit log hệ thống
            </CardTitle>
            <CardDescription>
              Ghi lại khóa/mở doanh nghiệp, đổi gói, cập nhật bảng giá và các thao tác quan trọng
              khác.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuditLogPanel
              endpoint="/partner/audit-logs"
              showTenant
              emptyTitle="Chưa có nhật ký Partner"
              emptyDescription="Các thao tác trên Partner Console sẽ xuất hiện tại đây."
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
