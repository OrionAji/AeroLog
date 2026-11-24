import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { FirestoreErrorInfo } from '../services/firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', details: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = 'Something went wrong while loading your logbook.';
    let details: string | null = error?.message || null;

    try {
      const parsed = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.toLowerCase().includes('permission')) {
          message =
            'Access to this record was denied by security rules. Make sure your email is verified and you are signed in to your own account.';
        } else if (parsed.error.toLowerCase().includes('quota')) {
          message = 'Database daily usage limit reached. Please try again shortly.';
        } else {
          message = 'Unable to sync with your private cloud logbook.';
        }
        details = `${parsed.operationType ?? 'operation'} on ${parsed.path ?? 'database'}: ${parsed.error}`;
      }
    } catch {
      // Non-JSON error message
    }

    return { hasError: true, message, details };
  }

  componentDidCatch(error: Error) {
    console.error('Aerolog ErrorBoundary caught error:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#F7F8FA] dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700 shrink-0 dark:bg-red-950/70 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Logbook Error
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your flight records remain safely stored.</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-700 leading-relaxed dark:text-slate-300">{this.state.message}</p>

          {this.state.details && (
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 font-mono text-[11px] text-slate-600 break-words dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
              {this.state.details}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reload Aerolog
            </button>
          </div>
        </div>
      </div>
    );
  }
}
