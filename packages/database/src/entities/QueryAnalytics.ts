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
  @Column({ type: "text", name: "normalized_query" })
  normalizedQuery!: string;

  @Column({ type: "integer", default: 0, name: "total_searches" })
  totalSearches!: number;

  @Column({ type: "integer", default: 0, name: "total_hits" })
  totalHits!: number;

  @Column({ type: "integer", default: 0, name: "zero_result_searches" })
  zeroResultSearches!: number;

  @Column({ type: "float", default: 0, name: "average_results_per_search" })
  averageResultsPerSearch!: number;

  @Column({ type: "float", default: 0, name: "hit_rate" })
  hitRate!: number; // percentage of searches that returned results

  @Column({ type: "timestamp", nullable: true, name: "first_searched_at" })
  firstSearchedAt!: Date | null;

  @Column({ type: "timestamp", nullable: true, name: "last_searched_at" })
  lastSearchedAt!: Date | null;

  @Column({ type: "jsonb", nullable: true, name: "top_results" })
  topResults!: string[] | null; // Array of event IDs that were most commonly returned

  @Column({ type: "jsonb", nullable: true, name: "search_categories" })
  searchCategories!: string[] | null; // Categories that were most commonly searched with this query

  @Column({ type: "boolean", default: false, name: "is_popular" })
  isPopular!: boolean; // Flag for queries that are searched frequently

  @Column({ type: "boolean", default: false, name: "needs_attention" })
  needsAttention!: boolean; // Flag for queries with low hit rates that might need content

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
