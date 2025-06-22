"use client";

import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LazyPageWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export function LazyPageWrapper({
  children,
  fallback = <DefaultLoadingFallback />,
  className,
}: LazyPageWrapperProps) {
  return (
    <div className={cn("w-full", className)}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </div>
  );
}
