import { type Point } from "geojson";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Event } from "./Event";

export enum FlyerProcessingStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  MANUAL = "MANUAL",
}

@Entity("flyer_images")
export class FlyerImage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "image_url", type: "varchar" })
  imageUrl!: string;

  @Column({ name: "ocr_text", type: "text", nullable: true })
  ocrText?: string;

  @Column({ name: "vision_data", type: "jsonb", nullable: true })
  visionData?: any;

  @Column({
    type: "enum",
    enum: FlyerProcessingStatus,
    default: FlyerProcessingStatus.PENDING,
  })
  status!: FlyerProcessingStatus;

  @OneToMany(() => Event, (event) => event.sourceFlyer)
  events!: Event[];

  @Column({
    name: "capture_location",
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: true,
  })
  captureLocation?: Point;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt?: Date;
}
