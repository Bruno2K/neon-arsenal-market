import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/page-state";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="container py-20">
          <ErrorState
            title="Algo deu errado"
            description={this.state.error.message}
            action={
              <Button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Tentar novamente
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
