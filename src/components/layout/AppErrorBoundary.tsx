import { Component, type ErrorInfo, type ReactNode } from "react";
import "./AppErrorBoundary.css";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

const CHUNK_ERROR_PATTERN =
  /chunkloaderror|loading chunk|dynamically imported module|importing a module script failed/i;

function isChunkLoadError(error: Error): boolean {
  let candidate: unknown = error;

  while (candidate instanceof Error) {
    if (CHUNK_ERROR_PATTERN.test(candidate.message)) {
      return true;
    }
    candidate = (candidate as Error & { cause?: unknown }).cause;
  }

  return false;
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render failed", error, info.componentStack);
  }

  private refresh = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    const chunkFailed = isChunkLoadError(error);

    return (
      <main className="app-error-page">
        <section className="app-error-card" role="alert">
          <p className="app-error-card__label">Salsa Segura</p>
          <h1>{chunkFailed ? "Update ready" : "Page unavailable"}</h1>
          <p>
            {chunkFailed
              ? "The app was updated while this page was open."
              : "This page could not be displayed."}
          </p>
          <button type="button" onClick={this.refresh}>
            Refresh app
          </button>
        </section>
      </main>
    );
  }
}
