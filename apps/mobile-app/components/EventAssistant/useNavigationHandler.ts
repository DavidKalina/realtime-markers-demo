import { useCallback } from "react";
import { useRouter } from "expo-router";
import { MapItem } from "@/types/map";

export const useNavigationHandler = () => {
  const router = useRouter();

  const navigateToDetails = useCallback(
    (item: MapItem) => {
      const route = item.type === "marker" ? `details?eventId=${item.id}` : "cluster";
      router.push(route as never);
    },
    [router]
  );

  return {
    navigateToDetails,
  };
};
