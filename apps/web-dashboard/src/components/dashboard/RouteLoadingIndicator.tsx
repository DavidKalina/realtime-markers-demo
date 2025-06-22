"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export function RouteLoadingIndicator() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Show loading indicator when pathname changes
    setIsLoading(true);

    // Hide loading indicator after a short delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary animate-pulse" />
      <div className="h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-ping" />
    </div>
  );
}
