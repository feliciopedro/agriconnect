import React from 'react';
import { AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  expanded: boolean;
}

/**
 * Top-level React ErrorBoundary.
 * Catches unhandled render errors and shows a white recovery page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, expanded: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16 text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-[#FFFBEB] flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-[#D97706]" aria-hidden="true" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-[#111827] font-display mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-[#6B7280] max-w-xs leading-relaxed mb-8">
          An unexpected error occurred. Please reload the page to continue.
        </p>

        {/* Reload button */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2D6A4F] hover:bg-[#235A41] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reload page
        </button>

        {/* Collapsible error detail */}
        <div className="mt-8 w-full max-w-md text-left">
          <button
            onClick={() => this.setState((s) => ({ expanded: !s.expanded }))}
            className="flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#6B7280] font-semibold transition-colors cursor-pointer mx-auto"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${this.state.expanded ? 'rotate-180' : ''}`}
            />
            {this.state.expanded ? 'Hide' : 'Show'} error details
          </button>

          {this.state.expanded && this.state.error && (
            <pre className="mt-3 p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-[11px] text-[#374151] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
