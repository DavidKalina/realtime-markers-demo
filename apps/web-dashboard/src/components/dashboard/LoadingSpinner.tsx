interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({
  message = "Loading dashboard...",
  className,
}: LoadingSpinnerProps) {
  return (
    <div className={`min-h-screen bg-background p-8 ${className}`}>
      <div className="container mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
