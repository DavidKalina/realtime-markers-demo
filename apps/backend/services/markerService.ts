// services/MarkerService.ts
import { Repository, DataSource } from "typeorm";
import { Marker } from "../entities/Marker";
import { type Point } from "geojson";

export class MarkerService {
  private markerRepository: Repository<Marker>;

  constructor(private dataSource: DataSource) {
    this.markerRepository = dataSource.getRepository(Marker);
  }

  async getMarkers(): Promise<Marker[]> {
    return this.markerRepository.find({
      order: {
        createdAt: "DESC",
      },
    });
  }

  async createMarker(lat: number, lng: number, emoji: string, color: string): Promise<Marker> {
    const point: Point = {
      type: "Point",
      coordinates: [lng, lat],
    };

    const marker = this.markerRepository.create({
      location: point,
      emoji,
      color,
    });

    return this.markerRepository.save(marker);
  }

  async getMarkersInBounds(
    swLng: number,
    swLat: number,
    neLng: number,
    neLat: number
  ): Promise<Marker[]> {
    return this.markerRepository
      .createQueryBuilder("marker")
      .where(
        "ST_Within(location::geometry, ST_MakeEnvelope(:swLng, :swLat, :neLng, :neLat, 4326))",
        { swLng, swLat, neLng, neLat }
      )
      .getMany();
  }

  async getMarkerById(id: string): Promise<Marker | null> {
    return this.markerRepository.findOneBy({ id });
  }

  async updateMarker(id: string, data: Partial<Marker>): Promise<Marker | null> {
    await this.markerRepository.update(id, data);
    return this.getMarkerById(id);
  }

  async deleteMarker(id: string): Promise<void> {
    await this.markerRepository.delete(id);
  }

  async getNearbyMarkers(lat: number, lng: number, radiusMeters: number = 1000): Promise<Marker[]> {
    return this.markerRepository
      .createQueryBuilder("marker")
      .select()
      .addSelect(
        "ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)",
        "distance" // Remove the extra 'as distance' - just use one alias
      )
      .where(
        "ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
        { lng, lat, radius: radiusMeters }
      )
      .orderBy("distance", "ASC")
      .getMany();
  }
}
