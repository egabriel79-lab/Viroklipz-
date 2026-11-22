import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Ha ocurrido un error inesperado.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Viroklipz ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-[#09090B] text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#121216] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              Algo interrumpió la reproducción
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              No pudimos completar esta acción en Viroklipz. Puedes recargar para continuar viendo el feed.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Recargar Viroklipz
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
