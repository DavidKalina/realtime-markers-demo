import { useEffect } from "react";
import { useRouter } from "expo-router";

/**
 * @deprecated Redirects to /browse. The Spaces feature has been replaced by Districts.
 */
export default function SpacesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/browse");
  }, [router]);

  return null;
}
