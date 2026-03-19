import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";

/**
 * On fresh app open, redirects authenticated users to /user (dashboard).
 *
 * Returns `isBoot` — true while still resolving, so the layout can
 * show a loading screen instead of the default index route.
 */
export function useBootRedirect() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: isOnboardingLoading } =
    useOnboarding();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [done, setDone] = useState(false);
  const wasAuthenticated = useRef(isAuthenticated);

  const authReady = !isAuthLoading && !isOnboardingLoading;

  // When user transitions from unauthenticated → authenticated (login/register),
  // reset so the boot redirect runs again for the new session.
  useEffect(() => {
    if (!authReady) return;
    if (!wasAuthenticated.current && isAuthenticated) {
      setDone(false);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [authReady, isAuthenticated]);

  // Not authenticated or not onboarded — no boot redirect needed
  useEffect(() => {
    if (!authReady || done) return;
    if (!isAuthenticated || !hasCompletedOnboarding) {
      setDone(true);
    }
  }, [authReady, isAuthenticated, hasCompletedOnboarding, done]);

  // Authenticated + onboarded → go to dashboard
  useEffect(() => {
    if (done || !authReady) return;
    if (!isAuthenticated || !hasCompletedOnboarding) return;

    routerRef.current.replace("/user");
    setDone(true);
  }, [done, authReady, isAuthenticated, hasCompletedOnboarding]);

  return { isBoot: !done };
}
