"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // User is authenticated, redirect to dashboard
        router.push("/dashboard");
      } else {
        // User is not authenticated, redirect to login
        router.push("/login");
      }
    }
  }, [user, isLoading, router]);

  return <LoadingSpinner />;
}
