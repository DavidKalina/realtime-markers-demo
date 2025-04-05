import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes1710000000001 implements MigrationInterface {
    name = 'AddIndexes1710000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Spatial index for PostGIS
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS events_location_gist_idx 
            ON events USING GIST (location);
        `);

        // Text search indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS events_title_trgm_idx 
            ON events USING gin (title gin_trgm_ops);

            CREATE INDEX IF NOT EXISTS events_description_trgm_idx 
            ON events USING gin (description gin_trgm_ops);
        `);

        // Check if embedding column exists and is of type vector
        const embeddingColumn = await queryRunner.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'events' 
            AND column_name = 'embedding';
        `);

        const columnType = embeddingColumn[0]?.data_type;

        if (columnType === 'vector') {
            await queryRunner.query(`
                DROP INDEX IF EXISTS events_embedding_idx;
                CREATE INDEX events_embedding_idx 
                ON events 
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS events_location_gist_idx;
            DROP INDEX IF EXISTS events_title_trgm_idx;
            DROP INDEX IF EXISTS events_description_trgm_idx;
            DROP INDEX IF EXISTS events_embedding_idx;
        `);
    }
} 