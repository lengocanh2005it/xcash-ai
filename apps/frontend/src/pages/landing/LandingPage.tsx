import { SubscriptionPlan } from '@xcash/shared-types';
import { ArrowRight, Check, ChevronRight, Menu, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { formatVND } from '@/lib/format-vnd';
import { cn } from '@/lib/utils';
import {
  DEMO_TRANSACTIONS,
  formatCopilotQuota,
  formatPlanQuota,
  LANDING_FEATURES,
  LANDING_PLANS,
  LANDING_STATS,
  LANDING_STEPS,
  planDisplayName,
} from './landing-data';

const NAV_LINKS = [
  { href: '#tinh-nang', label: 'Tính năng' },
  { href: '#cach-hoat-dong', label: 'Cách hoạt động' },
  { href: '#bang-gia', label: 'Bảng giá' },
] as const;

function scrollToSection(href: string) {
  const id = href.replace('#', '');
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-border/60 bg-background/85 shadow-sm backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <Logo markSize={36} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => scrollToSection(link.href)}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/login">Đăng nhập</Link>
          </Button>
          <Button size="sm" className="hidden shadow-md shadow-primary/20 sm:inline-flex" asChild>
            <Link to="/register">
              Dùng thử miễn phí
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Mở menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[min(100vw-2rem,20rem)]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left">
                  <LogoMark size={28} />
                  X-Cash AI
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className="justify-start"
                    onClick={() => {
                      setMobileOpen(false);
                      scrollToSection(link.href);
                    }}
                  >
                    {link.label}
                  </Button>
                ))}
                <div className="my-2 border-t" />
                <Button variant="outline" asChild onClick={() => setMobileOpen(false)}>
                  <Link to="/login">Đăng nhập</Link>
                </Button>
                <Button asChild onClick={() => setMobileOpen(false)}>
                  <Link to="/register">Dùng thử miễn phí</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function HeroDemoCard() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const demo = DEMO_TRANSACTIONS[index];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % DEMO_TRANSACTIONS.length);
        setVisible(true);
      }, 280);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0">
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-primary/20 blur-3xl" />
      <Card
        className={cn(
          'relative overflow-hidden border-primary/20 bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur-sm transition-all duration-300',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Giao dịch mới
            </Badge>
            <span className="text-xs text-muted-foreground">vừa xong</span>
          </div>
          <CardTitle className="text-base font-medium leading-snug">{demo.content}</CardTitle>
          <CardDescription className="font-mono text-base font-semibold text-foreground">
            {demo.amount}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              AI gợi ý định khoản TT133
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-bold tracking-tight">
                  {demo.debit}
                  <span className="mx-1 text-muted-foreground">/</span>
                  {demo.credit}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{demo.label}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-primary">{demo.confidence}%</p>
                <p className="text-xs text-muted-foreground">độ tin cậy</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-dashed border-primary/30 bg-background px-3 py-2 text-center text-xs text-muted-foreground">
              Vuốt phải → Xác nhận
            </div>
            <div className="flex-1 rounded-lg border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
              Sửa nếu cần
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="absolute -right-4 -bottom-4 hidden rounded-2xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:block">
        <p className="text-xs text-muted-foreground">Tiết kiệm mỗi ngày</p>
        <p className="text-lg font-bold text-primary">~45 phút</p>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[min(100%,900px)] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-20 right-0 h-64 w-64 rounded-full bg-chart-2/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(to right, oklch(0.635 0.168 155 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.635 0.168 155 / 0.08) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div className="text-center lg:text-left">
          <Badge
            variant="secondary"
            className="mb-5 border-primary/20 bg-primary/10 px-3 py-1 text-primary"
          >
            Định khoản tự động cho SME Việt Nam
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Giao dịch ngân hàng →{' '}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              định khoản TT133
            </span>{' '}
            trong vài giây
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground text-pretty lg:mx-0">
            X-Cash AI tự động nhận giao dịch ngân hàng và dùng AI gợi ý tài khoản Nợ/Có theo chuẩn
            kế toán — kế toán chỉ cần xác nhận hoặc sửa. Giảm tới 80% thời gian nhập liệu thủ công.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button
              size="lg"
              className="h-12 w-full px-8 shadow-lg shadow-primary/25 sm:w-auto"
              asChild
            >
              <Link to="/register">
                Bắt đầu miễn phí
                <ChevronRight className="ml-1 size-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full sm:w-auto"
              onClick={() => scrollToSection('#cach-hoat-dong')}
            >
              Xem cách hoạt động
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground lg:justify-start">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              Định khoản chính xác
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              Đúng chuẩn TT133
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              Tự động hoàn toàn
            </div>
          </div>
        </div>

        <HeroDemoCard />
      </div>
    </section>
  );
}

function StatsBand() {
  return (
    <section
      className="border-y border-border/60 bg-muted/20 py-12 sm:py-14"
      aria-label="Số liệu nổi bật"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-y-8 sm:gap-x-6 lg:grid-cols-4 lg:divide-x lg:divide-border/60">
          {LANDING_STATS.map((stat) => (
            <div key={stat.label} className="px-2 text-center lg:px-6">
              <p className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                {stat.value}
              </p>
              <p className="mx-auto mt-2 max-w-[16rem] text-sm text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="tinh-nang" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Mọi thứ SME cần để đóng sổ nhanh hơn
          </h2>
          <p className="mt-4 text-muted-foreground">
            Từ giao dịch ngân hàng đến báo cáo Excel — một nền tảng, không cần nhập tay từng dòng.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:auto-rows-fr md:grid-cols-3">
          {LANDING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className={cn(
                  'group h-full border-border/70 bg-card/80 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
                  feature.className,
                )}
              >
                <CardHeader className="h-full">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <section
      id="cach-hoat-dong"
      className="scroll-mt-24 border-y border-border/60 bg-muted/20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ba bước là xong</h2>
          <p className="mt-4 text-muted-foreground">
            Không cần dữ liệu lịch sử dài — hoạt động ngay từ giao dịch đầu tiên sau khi liên kết.
          </p>
        </div>

        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          <div className="pointer-events-none absolute top-10 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
          {LANDING_STEPS.map((step) => (
            <div key={step.step} className="relative text-center md:text-left">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border-2 border-primary/30 bg-background font-mono text-lg font-bold text-primary shadow-sm md:mx-0">
                {step.step}
              </div>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="bang-gia" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Gói dịch vụ linh hoạt</h2>
          <p className="mt-4 text-muted-foreground">
            Bắt đầu miễn phí, nâng cấp khi doanh nghiệp phát triển. Thanh toán qua PayOS.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {LANDING_PLANS.map((plan) => (
            <Card
              key={plan.plan}
              className={cn(
                'relative flex flex-col',
                plan.highlight
                  ? 'border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/20'
                  : 'border-border/70',
              )}
            >
              {plan.highlight ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-md">
                    Phổ biến nhất
                  </Badge>
                </div>
              ) : null}
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{planDisplayName(plan.plan)}</CardTitle>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-1">
                  <span className="text-[1.75rem] font-bold tabular-nums leading-none tracking-tight">
                    {plan.pricePerMonth === 0 ? 'Miễn phí' : formatVND(plan.pricePerMonth)}
                  </span>
                  {plan.pricePerMonth > 0 ? (
                    <span className="text-sm text-muted-foreground">/tháng</span>
                  ) : null}
                </div>
                <CardDescription className="mt-1 space-y-0.5">
                  <span className="block">
                    {formatPlanQuota(plan.transactionQuota)}
                    {plan.overageHint ? ` · ${plan.overageHint}` : ''}
                  </span>
                  <span className="block">{formatCopilotQuota(plan.copilotQuota, plan.plan)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant={plan.highlight ? 'default' : 'outline'} className="w-full" asChild>
                  <Link to="/register">
                    {plan.plan === SubscriptionPlan.FREE ? 'Đăng ký miễn phí' : 'Chọn gói này'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-chart-3 px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Sẵn sàng bỏ Excel nhập tay?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">
              Tạo tài khoản miễn phí, liên kết Cas Link và để AI định khoản giúp bạn ngay hôm nay.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 w-full bg-background text-foreground hover:bg-background/90 sm:w-auto"
                asChild
              >
                <Link to="/register">Đăng ký miễn phí</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
                asChild
              >
                <Link to="/login">Đã có tài khoản</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <Logo markSize={32} />
        <p className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} X-Cash AI — Định khoản tự động theo TT133
        </p>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/login" className="text-muted-foreground hover:text-foreground">
            Đăng nhập
          </Link>
          <Link to="/register" className="font-medium text-primary hover:underline">
            Đăng ký
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <LandingNavbar />
      <main>
        <HeroSection />
        <StatsBand />
        <FeaturesSection />
        <StepsSection />
        <PricingSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
