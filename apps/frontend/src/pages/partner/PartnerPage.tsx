import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PartnerPage() {
  return (
    <div className="min-h-svh bg-muted">
      <Header
        title="Partner Dashboard"
        description="Khu vực dành cho Cas Partner — sẽ được triển khai ở Sprint 3"
      />
      <div className="p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Đang phát triển</CardTitle>
            <CardDescription>Partner layout và API sẽ có ở sprint sau</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Tài khoản Cas Partner không truy cập được các màn hình nghiệp vụ tenant.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
