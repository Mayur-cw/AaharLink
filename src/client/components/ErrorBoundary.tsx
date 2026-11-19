import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI exception in ErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <section className="panel panel--danger" role="alert" style={{ margin: '2rem auto', maxWidth: '720px' }}>
          <h1 className="heading-lg" style={{ color: 'var(--color-destructive)' }}>
            System Encountered an Unexpected Issue
          </h1>
          <p>
            An unexpected error occurred during rendering. Any draft forms stored in memory may have been preserved.
          </p>
          {this.state.error && (
            <div className="error-banner" style={{ margin: '1rem 0', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {this.state.error.message}
            </div>
          )}
          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={this.handleReset}
            >
              Reload Page
            </button>
            <Link to="/" className="btn btn--secondary" onClick={() => this.setState({ hasError: false, error: null })}>
              Return to Safety
            </Link>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
