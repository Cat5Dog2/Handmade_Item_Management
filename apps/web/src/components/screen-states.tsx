import type { ReactNode } from "react";

interface ScreenLoadingStateProps {
  message: ReactNode;
}

interface ScreenErrorStateProps {
  children?: ReactNode;
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

interface ScreenEmptyStateProps {
  children?: ReactNode;
  message: ReactNode;
}

export function ScreenLoadingState({ message }: ScreenLoadingStateProps) {
  return (
    <div className="management-page__status" role="status">
      {message}
    </div>
  );
}

export function ScreenErrorState({
  children,
  message,
  onRetry,
  retryLabel = "再試行"
}: ScreenErrorStateProps) {
  return (
    <div className="management-page__notice is-error" role="alert">
      <p>{message}</p>
      {children}
      {onRetry ? (
        <button className="secondary-button" type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ScreenEmptyState({ children, message }: ScreenEmptyStateProps) {
  return (
    <div className="management-page__empty">
      <p>{message}</p>
      {children}
    </div>
  );
}
