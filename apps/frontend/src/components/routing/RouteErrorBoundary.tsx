import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-lg font-semibold">Đã xảy ra lỗi</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Trang này gặp sự cố. Vui lòng tải lại hoặc quay về trang chủ.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              Quay lại
            </Button>
            <Button type="button" onClick={() => window.location.reload()}>
              Tải lại trang
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
