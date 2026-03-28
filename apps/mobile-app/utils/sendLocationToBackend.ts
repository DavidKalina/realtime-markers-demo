import * as SecureStore from "expo-secure-store";

export async function sendLocationToBackend(
  lat: number,
  lng: number,
): Promise<void> {
  const token = await SecureStore.getItemAsync("accessToken");
  if (!token) {
    console.log("[LocationSender] No auth token, skipping");
    return;
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error("[LocationSender] No API URL configured");
    return;
  }

  const response = await fetch(`${apiUrl}/api/users/location`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lng, lat }),
  });

  if (!response.ok) {
    console.error("[LocationSender] API error:", response.status);
  }
}
