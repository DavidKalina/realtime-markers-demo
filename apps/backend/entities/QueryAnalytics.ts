import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("query_analytics")
export class QueryAnalytics {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "text" })
  query!: string;

  @Index()
  @Column({ type: "text" })
  normalizedQuery!: string;

  @Column({ type: "integer", default: 0 })
  totalSearches!: number;

  @Column({ type: "integer", default: 0 })
  totalHits!: number;

  @Column({ type: "integer", default: 0 })
  zeroResultSearches!: number;

  @Column({ type: "float", default: 0 })
  averageResultsPerSearch!: number;

  @Column({ type: "float", default: 0 })
  hitRate!: number; // percentage of searches that returned results

  @Column({ type: "timestamp", nullable: true })
  firstSearchedAt!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  lastSearchedAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  topResults!: string[] | null; // Array of event IDs that were most commonly returned

  @Column({ type: "jsonb", nullable: true })
  searchCategories!: string[] | null; // Categories that were most commonly searched with this query

  @Column({ type: "boolean", default: false })
  isPopular!: boolean; // Flag for queries that are searched frequently

  @Column({ type: "boolean", default: false })
  needsAttention!: boolean; // Flag for queries with low hit rates that might need content

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
