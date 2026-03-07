import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useUserLocation } from "@/contexts/LocationContext";
import { apiClient } from "@/services/ApiClient";

const LOCATION_TIMEOUT_MS = 5000;

/**
 * On fresh app open, resolves the user's city from GPS and navigates
 * directly to /spaces/[city]. Falls back to /spaces if city can't be
 * resolved or location times out.
 *
 * Returns `isBoot` — true while still resolving, so the layout can
 * show a loading screen instead of the default index route.
 */
export function useBootRedirect() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { hasCompletedOnboarding, isLoading: isOnboardingLoading } =
    useOnboarding();
  const { userLocation } = useUserLocation();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [done, setDone] = useState(false);
  const fetching = useRef(false);
  const wasAuthenticated = useRef(isAuthenticated);

  const authReady = !isAuthLoading && !isOnboardingLoading;
  const hasLocation = !!userLocation;

  // When user transitions from unauthenticated → authenticated (login/register),
  // reset so the boot redirect runs again for the new session.
  useEffect(() => {
    if (!authReady) return;
    if (!wasAuthenticated.current && isAuthenticated) {
      setDone(false);
      fetching.current = false;
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

  // Timeout: if location never arrives, fall back to /spaces
  useEffect(() => {
    if (done || !authReady || !isAuthenticated || !hasCompletedOnboarding || hasLocation) return;
    const timer = setTimeout(() => {
      if (fetching.current) return;
      setDone(true);
      routerRef.current.replace("/spaces");
    }, LOCATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [done, authReady, isAuthenticated, hasCompletedOnboarding, hasLocation]);

  // Once we have location, fetch city and navigate (runs exactly once)
  useEffect(() => {
    if (done || fetching.current) return;
    if (!authReady || !isAuthenticated || !hasCompletedOnboarding) return;
    if (!userLocation) return;

    fetching.current = true;
    const [lng, lat] = userLocation;

    apiClient.events
      .getLandingPageData({
        userLat: Math.round(lat * 100) / 100,
        userLng: Math.round(lng * 100) / 100,
        featuredLimit: 1,
        upcomingLimit: 0,
      })
      .then((data) => {
        if (data.resolvedCity) {
          routerRef.current.replace({
            pathname: "/spaces/[city]",
            params: { city: data.resolvedCity },
          });
        } else {
          routerRef.current.replace("/spaces");
        }
      })
      .catch(() => {
        routerRef.current.replace("/spaces");
      })
      .finally(() => {
        setDone(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, authReady, isAuthenticated, hasCompletedOnboarding, hasLocation]);

  return { isBoot: !done };
}
