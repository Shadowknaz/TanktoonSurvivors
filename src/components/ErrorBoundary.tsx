import React from 'react';

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly message: string;
}

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
}

/**
 * Root-level error boundary.
 * Catches unhandled React render / lifecycle errors (including those triggered
 * by Pixi panics propagating through event handlers) and renders a styled
 * fallback so the user sees something actionable instead of a blank screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught unhandled error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a0a0a',
          zIndex: 9999,
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            background: '#ff3333',
            border: '8px solid #000',
            boxShadow: '12px 12px 0 #000',
            padding: '2.5rem 3rem',
            maxWidth: 540,
            textAlign: 'center',
            transform: 'rotate(-1.5deg)',
          }}
        >
          <h1
            style={{
              fontSize: '3rem',
              fontWeight: 900,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '-2px',
              WebkitTextStroke: '3px #000',
              marginBottom: '1rem',
            }}
          >
            CRITICAL ERROR
          </h1>
          <p
            style={{
              background: '#000',
              color: '#ff3333',
              padding: '0.75rem 1rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              wordBreak: 'break-word',
              marginBottom: '1.5rem',
              textAlign: 'left',
            }}
          >
            {this.state.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: '#ffdd00',
              border: '6px solid #000',
              boxShadow: '6px 6px 0 #000',
              padding: '0.75rem 2rem',
              fontSize: '1.25rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            RELOAD
          </button>
        </div>
      </div>
    );
  }
}
