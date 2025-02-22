import { DataSource, Repository, type DeepPartial } from "typeorm";
import { Event, EventStatus } from "../entities/Event";
import { type Point } from "geojson";
import { Category } from "../entities/Category";
import { FlyerImage } from "../entities/FlyerImage";
import { ThirdSpace } from "../entities/ThirdSpace";

interface CreateEventInput {
  title: string;
  description?: string;
  eventDate: Date;
  location: Point;
  categoryIds?: string[];
  sourceFlyerId?: string;
  thirdSpaceId?: string;
}

export class EventService {
  private eventRepository: Repository<Event>;
  private categoryRepository: Repository<Category>;
  private flyerRepository: Repository<FlyerImage>;
  private thirdSpaceRepository: Repository<ThirdSpace>;

  constructor(private dataSource: DataSource) {
    this.eventRepository = dataSource.getRepository(Event);
    this.categoryRepository = dataSource.getRepository(Category);
    this.flyerRepository = dataSource.getRepository(FlyerImage);
    this.thirdSpaceRepository = dataSource.getRepository(ThirdSpace);
  }

  async getEvents(): Promise<Event[]> {
    return this.eventRepository.find({
      relations: ["categories", "sourceFlyer", "thirdSpace"],
    });
  }

  async getEventById(id: string): Promise<Event | null> {
    return this.eventRepository.findOne({
      where: { id },
      relations: ["categories", "sourceFlyer", "thirdSpace"],
    });
  }

  async getNearbyEvents(
    lat: number,
    lng: number,
    radius: number = 5000, // Default 5km radius
    startDate?: Date,
    endDate?: Date
  ): Promise<Event[]> {
    const query = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.categories", "category")
      .leftJoinAndSelect("event.sourceFlyer", "flyer")
      .leftJoinAndSelect("event.thirdSpace", "space")
      .where(
        "ST_DWithin(event.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)",
        { lat, lng, radius }
      );

    if (startDate) {
      query.andWhere("event.eventDate >= :startDate", { startDate });
    }
    if (endDate) {
      query.andWhere("event.eventDate <= :endDate", { endDate });
    }

    return query.getMany();
  }

  async createEvent(input: CreateEventInput): Promise<Event> {
    const eventData: DeepPartial<Event> = {
      title: input.title,
      description: input.description,
      eventDate: input.eventDate,
      location: input.location,
      status: EventStatus.PENDING,
    };

    // Handle categories if provided
    if (input.categoryIds?.length) {
      const categories = await this.categoryRepository.findByIds(input.categoryIds);
      eventData.categories = categories;
    }

    // Handle sourceFlyer if provided
    if (input.sourceFlyerId) {
      const flyer = await this.flyerRepository.findOneBy({ id: input.sourceFlyerId });
      if (flyer) {
        eventData.sourceFlyer = flyer;
      }
    }

    // Handle thirdSpace if provided
    if (input.thirdSpaceId) {
      const space = await this.thirdSpaceRepository.findOneBy({ id: input.thirdSpaceId });
      if (space) {
        eventData.thirdSpace = space;
      }
    }

    const event = this.eventRepository.create(eventData);
    return this.eventRepository.save(event);
  }

  async updateEvent(id: string, eventData: Partial<CreateEventInput>): Promise<Event | null> {
    const event = await this.getEventById(id);
    if (!event) return null;

    // Handle basic fields
    if (eventData.title) event.title = eventData.title;
    if (eventData.description !== undefined) event.description = eventData.description;
    if (eventData.eventDate) event.eventDate = eventData.eventDate;
    if (eventData.location) event.location = eventData.location;

    // Handle categories if provided
    if (eventData.categoryIds) {
      const categories = await this.categoryRepository.findByIds(eventData.categoryIds);
      event.categories = categories;
    }

    // Handle sourceFlyer if provided
    if (eventData.sourceFlyerId) {
      const flyer = await this.flyerRepository.findOneBy({ id: eventData.sourceFlyerId });
      if (flyer) {
        event.sourceFlyer = flyer;
      }
    }

    // Handle thirdSpace if provided
    if (eventData.thirdSpaceId) {
      const space = await this.thirdSpaceRepository.findOneBy({ id: eventData.thirdSpaceId });
      if (space) {
        event.thirdSpace = space;
      }
    }

    return this.eventRepository.save(event);
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await this.eventRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async updateEventStatus(id: string, status: EventStatus): Promise<Event | null> {
    const event = await this.getEventById(id);
    if (!event) return null;

    event.status = status;
    return this.eventRepository.save(event);
  }
}
