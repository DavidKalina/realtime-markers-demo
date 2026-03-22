import {
  withErrorHandling,
  requireAuth,
  type Handler,
} from "../utils/handlerUtils";

export const browseDistrictsHandler: Handler = withErrorHandling(async (c) => {
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");

  if (!lat || !lng) {
    return c.json({ error: "lat and lng query parameters are required" }, 400);
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    return c.json({ error: "lat and lng must be valid numbers" }, 400);
  }

  const radius = parseFloat(c.req.query("radius") || "25");

  const districtService = c.get("districtService");
  const districts = await districtService.browseDistricts(latNum, lngNum, radius);

  return c.json({ data: districts });
});

export const districtDetailHandler: Handler = withErrorHandling(async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  if (!id) {
    return c.json({ error: "District ID is required" }, 400);
  }

  const sort = c.req.query("sort") || "popular";
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const cursor = c.req.query("cursor");

  const districtService = c.get("districtService");

  try {
    const result = await districtService.getDistrictDetail(
      id,
      sort,
      limit,
      cursor || undefined,
      user?.id,
    );
    return c.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "District not found") {
      return c.json({ error: "District not found" }, 404);
    }
    throw err;
  }
});

export const districtCoverageHandler: Handler = withErrorHandling(
  async (c) => {
    const user = requireAuth(c);
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");

    if (!lat || !lng) {
      return c.json(
        { error: "lat and lng query parameters are required" },
        400,
      );
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return c.json({ error: "lat and lng must be valid numbers" }, 400);
    }

    const radius = parseFloat(c.req.query("radius") || "25");

    const districtService = c.get("districtService");
    const coverage = await districtService.getPersonalCoverage(
      user.id,
      latNum,
      lngNum,
      radius,
    );

    return c.json(coverage);
  },
);
