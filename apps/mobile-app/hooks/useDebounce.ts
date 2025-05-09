// hooks/useDebounce.ts (or inline)
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // If delay is 0, update immediately without scheduling a timeout
    if (delay === 0) {
      setDebouncedValue(value);
      return;
    }

    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to clear the timeout if value or delay changes
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Re-run if value or delay changes

  // On initial render, useState(value) ensures the original value is used immediately.
  // Subsequently, it returns the current debouncedValue, which updates after the timeout.
  return debouncedValue;
}
