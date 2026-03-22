import type { Handler } from "hono";
import type { AppContext } from "../types/context";
import { withErrorHandling } from "../utils/handlerUtils";

export const listDistrictsHandler: Handler<AppContext> = withErrorHandling(
  async (c) => {
    const districtService = c.get("districtService");
    const ds = districtService["dataSource"];

    const { sort, order } = c.req.query();
    const sortCol = sort === "vitality" ? "vitality_score" : "itinerary_count";
    const sortDir = order === "asc" ? "ASC" : "DESC";

    const districts = await ds.query(
      `SELECT id, name, description, itinerary_count, avg_rating,
              total_adoptions, activity_tags, status,
              centroid_lat, centroid_lng, geohash,
              last_clustered_at, created_at, updated_at
       FROM districts
       WHERE status = 'active'
       ORDER BY ${sortCol} ${sortDir}`,
    );

    return c.json({
      districts: districts.map(
        (d: {
          id: string;
          name: string;
          description: string | null;
          itinerary_count: number;
          avg_rating: string | null;
          total_adoptions: number;
          activity_tags: string[];
          status: string;
          centroid_lat: string;
          centroid_lng: string;
          geohash: string;
          last_clustered_at: Date | null;
          created_at: Date;
          updated_at: Date;
        }) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          itineraryCount: d.itinerary_count,
          avgRating: d.avg_rating ? Number(d.avg_rating) : null,
          totalAdoptions: d.total_adoptions,
          activityTags: d.activity_tags || [],
          status: d.status,
          centroidLat: Number(d.centroid_lat),
          centroidLng: Number(d.centroid_lng),
          geohash: d.geohash,
          lastClusteredAt: d.last_clustered_at,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }),
      ),
      total: districts.length,
    });
  },
);

export const getDistrictDetailHandler: Handler<AppContext> = withErrorHandling(
  async (c) => {
    const districtService = c.get("districtService");
    const ds = districtService["dataSource"];
    const id = c.req.param("id");

    const [district] = await ds.query(
      `SELECT id, name, description, itinerary_count, avg_rating,
              total_adoptions, activity_tags, status,
              centroid_lat, centroid_lng, geohash,
              last_clustered_at, created_at
       FROM districts WHERE id = $1`,
      [id],
    );

    if (!district) {
      return c.json({ error: "District not found" }, 404);
    }

    const itineraries = await ds.query(
      `SELECT i.id, i.title, i.intention, i.activity_types,
              i.duration_hours, i.rating, i.times_adopted,
              i.created_at, u.email AS creator_email
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       JOIN users u ON u.id = i.user_id
       WHERE di.district_id = $1
       ORDER BY i.created_at DESC`,
      [id],
    );

    return c.json({
      district: {
        id: district.id,
        name: district.name,
        description: district.description,
        itineraryCount: district.itinerary_count,
        avgRating: district.avg_rating ? Number(district.avg_rating) : null,
        totalAdoptions: district.total_adoptions,
        activityTags: district.activity_tags || [],
        status: district.status,
        centroidLat: Number(district.centroid_lat),
        centroidLng: Number(district.centroid_lng),
        geohash: district.geohash,
        lastClusteredAt: district.last_clustered_at,
        createdAt: district.created_at,
      },
      itineraries: itineraries.map(
        (i: {
          id: string;
          title: string | null;
          intention: string | null;
          activity_types: string[];
          duration_hours: string;
          rating: string | null;
          times_adopted: number;
          created_at: Date;
          creator_email: string;
        }) => ({
          id: i.id,
          title: i.title,
          intention: i.intention,
          activityTypes: i.activity_types || [],
          durationHours: Number(i.duration_hours),
          rating: i.rating ? Number(i.rating) : null,
          timesAdopted: i.times_adopted,
          createdAt: i.created_at,
          creatorEmail: i.creator_email,
        }),
      ),
    });
  },
);

export const renameDistrictHandler: Handler<AppContext> = withErrorHandling(
  async (c) => {
    const districtService = c.get("districtService");
    const ds = districtService["dataSource"];
    const id = c.req.param("id");

    // Fetch member itineraries to feed the naming LLM
    const members = await ds.query(
      `SELECT i.id, i.title, i.summary, i.city, i.intention,
              i.activity_types, i.categories
       FROM district_itineraries di
       JOIN itineraries i ON i.id = di.itinerary_id
       WHERE di.district_id = $1`,
      [id],
    );

    if (members.length === 0) {
      return c.json({ error: "District has no members" }, 400);
    }

    const result = await districtService["nameDistrict"](members);

    await ds.query(
      `UPDATE districts SET name = $1, description = $2, updated_at = NOW() WHERE id = $3`,
      [result.name, result.description, id],
    );

    return c.json({
      success: true,
      name: result.name,
      description: result.description,
    });
  },
);

export const deleteDistrictHandler: Handler<AppContext> = withErrorHandling(
  async (c) => {
    const districtService = c.get("districtService");
    const ds = districtService["dataSource"];
    const id = c.req.param("id");

    await ds.query(
      `UPDATE districts SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return c.json({ success: true });
  },
);

export const reclusterRegionHandler: Handler<AppContext> = withErrorHandling(
  async (c) => {
    const districtService = c.get("districtService");
    const id = c.req.param("id");
    const ds = districtService["dataSource"];

    const [district] = await ds.query(
      `SELECT geohash FROM districts WHERE id = $1`,
      [id],
    );

    if (!district) {
      return c.json({ error: "District not found" }, 404);
    }

    // Clear debounce so clustering runs immediately
    const redisService = districtService["redisService"];
    await redisService.delete(`district:debounce:${district.geohash}`);

    await districtService.clusterRegion(district.geohash);

    return c.json({ success: true, geohash: district.geohash });
  },
);

export const reclusterAllHandler: Handler<AppContext> = withErrorHandling(
  async (c) => {
    const districtService = c.get("districtService");
    const ds = districtService["dataSource"];
    const redisService = districtService["redisService"];

    // Get all unique geohashes from active districts + itineraries
    const geohashes: { geohash: string }[] = await ds.query(
      `SELECT DISTINCT geohash FROM districts WHERE status = 'active'
       UNION
       SELECT DISTINCT substring(encode(digest(
         entry_latitude::text || ',' || entry_longitude::text, 'md5'), 'hex') from 1 for 4)
       FROM itineraries
       WHERE status = 'READY' AND entry_latitude IS NOT NULL AND deleted_at IS NULL`,
    );

    // Simpler approach: get unique geohashes from existing districts
    const districtGeohashes: { geohash: string }[] = await ds.query(
      `SELECT DISTINCT geohash FROM districts WHERE status = 'active' AND geohash IS NOT NULL`,
    );

    // Clear all debounce keys
    for (const { geohash } of districtGeohashes) {
      await redisService.delete(`district:debounce:${geohash}`);
    }

    // Archive all existing districts
    await ds.query(
      `UPDATE districts SET status = 'archived', updated_at = NOW() WHERE status = 'active'`,
    );

    // Re-cluster each region
    let clustered = 0;
    for (const { geohash } of districtGeohashes) {
      try {
        await districtService.clusterRegion(geohash);
        clustered++;
      } catch (err) {
        console.error(
          `[AdminDistricts] Failed to cluster region ${geohash}:`,
          err,
        );
      }
    }

    return c.json({
      success: true,
      regionsProcessed: clustered,
      totalRegions: districtGeohashes.length,
    });
  },
);

export const getClusteringConfigHandler: Handler<AppContext> = withErrorHandling(
  async (c) => {
    return c.json({
      epsilon: parseFloat(process.env.DBSCAN_EPSILON || "0.18"),
      minPoints: parseInt(process.env.DBSCAN_MIN_POINTS || "3"),
      centroidMatchThreshold: parseFloat(
        process.env.DISTRICT_MATCH_THRESHOLD || "0.85",
      ),
      seedPerCity: parseInt(process.env.SEED_ITINERARIES_PER_CITY || "30"),
    });
  },
);
