import { useRouter } from "next/navigation";

// Simple route preloading hook
export function useRoutePreloader() {
  const router = useRouter();

  const preloadRoute = (href: string) => {
    // Prefetch the route
    router.prefetch(href);
  };

  return {
    preloadRoute,
  };
}

// Debounce function for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
