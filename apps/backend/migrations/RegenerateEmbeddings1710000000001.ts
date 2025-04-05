import type { MigrationInterface, QueryRunner } from "typeorm";
import { EmbeddingService } from "../services/shared/EmbeddingService";
import pgvector from "pgvector";

export class RegenerateEmbeddings1710000000001 implements MigrationInterface {
    name = 'RegenerateEmbeddings1710000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log("Starting embedding regeneration...");

        // Get all events
        console.log("Fetching events...");
        const events = await queryRunner.query(`
            SELECT id, title, description, emoji, emoji_description, address, location_notes,
                   array_agg(c.name) as category_names
            FROM events e
            LEFT JOIN event_categories ec ON e.id = ec.event_id
            LEFT JOIN categories c ON ec.category_id = c.id
            GROUP BY e.id, e.title, e.description, e.emoji, e.emoji_description, e.address, e.location_notes
        `);

        console.log(`Found ${events.length} events to process`);

        if (events.length === 0) {
            console.log("No events to process. Migration complete.");
            return;
        }

        // Verify OpenAI configuration
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
        }

        // Process events in batches
        const batchSize = 10;
        const embeddingService = EmbeddingService.getInstance();

        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(events.length / batchSize)}`);
            console.log(`Batch size: ${batch.length} events`);

            for (const event of batch) {
                try {
                    console.log(`Processing event ${event.id}: ${event.title}`);

                    // Generate text for embedding using the same format as EventProcessingService
                    const textForEmbedding = `
                        TITLE: ${event.title} ${event.title} ${event.title}
                        EMOJI: ${event.emoji} - ${event.emoji_description || ""}
                        CATEGORIES: ${event.category_names?.filter(Boolean).join(", ") || ""}
                        DESCRIPTION: ${event.description || ""}
                        LOCATION: ${event.address || ""}
                        LOCATION_NOTES: ${event.location_notes || ""}
                    `.trim();

                    // Get embedding
                    const embedding = await embeddingService.getEmbedding(textForEmbedding);

                    // Update the event with new embedding
                    await queryRunner.query(
                        `UPDATE events SET embedding = $1 WHERE id = $2`,
                        [pgvector.toSql(embedding), event.id]
                    );

                    console.log(`✓ Updated embedding for ${event.emoji} ${event.title}`);
                } catch (error) {
                    console.error(`Error processing event ${event.id}:`, error);
                    if (error instanceof Error) {
                        console.error("Error stack:", error.stack);
                    }
                }

                // Add a small delay between events to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`Completed batch ${Math.floor(i / batchSize) + 1}`);
        }

        // Final verification
        const finalCheck = await queryRunner.query(`
            SELECT COUNT(*) as count 
            FROM events 
            WHERE embedding IS NOT NULL
        `);
        console.log("Final verification - Events with embeddings:", finalCheck);

        console.log("Migration completed successfully");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // In the down migration, we'll clear all embeddings
        console.log("Clearing all embeddings...");
        await queryRunner.query(`
            UPDATE events 
            SET embedding = NULL;
        `);
        console.log("Embeddings cleared");
    }
} 