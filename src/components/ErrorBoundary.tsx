import * as React from 'react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
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
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Une erreur est survenue</h1>
            <p className="text-slate-500 mb-6 text-sm">
              L'application a rencontré un problème inattendu.
            </p>
            <div className="bg-slate-100 p-4 rounded-lg text-left mb-6 overflow-auto max-h-40">
              <code className="text-xs text-slate-700 font-mono">
                {this.state.error?.message}
              </code>
            </div>
            <Button onClick={() => window.location.reload()} className="w-full">
              Recharger la page
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = '/'} 
              className="w-full mt-2"
            >
              Retour à l'accueil
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
