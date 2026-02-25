import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import type { AppContext } from "../types/context";

export const areaScanHandler = async (c: Context<AppContext>) => {
  const body = await c.req.json<{ lat: number; lng: number; radius?: number }>();
  const { lat, lng } = body;
  const radius = Math.min(body.radius ?? 2000, 15000);

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return c.json(
      { error: "Invalid coordinates. lat: -90 to 90, lng: -180 to 180" },
      400,
    );
  }

  const areaScanService = c.get("areaScanService");
  const redisService = c.get("redisService");

  const result = await areaScanService.getAreaProfile(lat, lng, radius);

  return streamSSE(c, async (stream) => {
    try {
      // Send metadata first (includes events array)
      await stream.writeSSE({
        event: "metadata",
        data: JSON.stringify({ ...result.zoneStats, events: result.events }),
      });

      if (result.cached && result.text) {
        // Cached result — send the full text as a single content event
        await stream.writeSSE({ event: "content", data: result.text });
        await stream.writeSSE({ event: "done", data: "" });
        return;
      }

      if (!result.stream) {
        await stream.writeSSE({ event: "content", data: "No data available." });
        await stream.writeSSE({ event: "done", data: "" });
        return;
      }

      // Stream LLM chunks and accumulate for caching
      let fullText = "";

      for await (const chunk of result.stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullText += content;
          await stream.writeSSE({ event: "content", data: content });
        }
      }

      await stream.writeSSE({ event: "done", data: "" });

      // Cache the result
      const geohash = encodeGeohashSimple(lat, lng);
      const hourBucket = Math.floor(Date.now() / (3600 * 1000));
      const cacheKey = `area-scan:${geohash}:${hourBucket}:${radius}`;
      await redisService.set(
        cacheKey,
        JSON.stringify({ zoneStats: result.zoneStats, events: result.events, text: fullText }),
        3600,
      );
    } catch (error) {
      console.error("[AreaScan] Stream error:", error);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ error: "Stream error" }),
      });
    }
  });
};

// Simple geohash for cache key (matches AreaScanService)
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function encodeGeohashSimple(lat: number, lng: number, precision = 6): string {
  let minLat = -90,
    maxLat = 90;
  let minLng = -180,
    maxLng = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
