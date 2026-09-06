import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  isModal?: boolean;
  zIndexClass?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled render error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const content = (
        <div className="p-6 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-900 m-4 flex flex-col items-center text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-rose-900">
            {this.props.fallbackTitle || "Something went wrong loading this component"}
          </h3>
          <p className="text-xs text-rose-700 max-w-md font-mono bg-rose-100/60 p-2 rounded-lg break-all">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-3.5 py-1.5 rounded-xl bg-rose-800 hover:bg-rose-900 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Dismiss & Try Again</span>
            </button>
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.props.onReset}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            )}
          </div>
        </div>
      );

      if (this.props.isModal) {
        return (
          <div
            className={`fixed inset-0 ${this.props.zIndexClass || "z-50"} flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto`}
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-md w-full overflow-hidden">
              {content}
            </div>
          </div>
        );
      }

      return content;
    }

    return this.props.children;
  }
}
