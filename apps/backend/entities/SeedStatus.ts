import { Entity, Column, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity()
export class SeedStatus {
  @PrimaryColumn()
  seedName?: string;

  @Column()
  completed?: boolean;

  @CreateDateColumn()
  timestamp?: Date;
}
