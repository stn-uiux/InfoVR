import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="wizard-error-screen">
          <div className="wizard-error-card">
            <h1 className="wizard-error-card__title">Application Error Encountered</h1>
            <p className="wizard-error-card__desc">
              An unexpected error occurred while rendering the page. Don't worry, your unsaved actions might still be recoverable if you reload, but the view crashed.
            </p>
            <pre className="wizard-error-card__pre">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="wizard-error-card__btn"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
