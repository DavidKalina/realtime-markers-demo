import "reflect-metadata";
import { DataSource } from "typeorm";
import { EmbeddingService } from "../services/shared/EmbeddingService";
import pgvector from "pgvector";

const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL
});

async function regenerateEmbeddings() {
    try {
        await dataSource.initialize();
        console.log("Database connection established");

        // Get all events
        const events = await dataSource.query(`
            SELECT id, title, description, emoji, emoji_description, address, location_notes,
                   array_agg(c.name) as category_names
            FROM events e
            LEFT JOIN event_categories ec ON e.id = ec.event_id
            LEFT JOIN categories c ON ec.category_id = c.id
            GROUP BY e.id
        `);

        console.log(`Found ${events.length} events to process`);

        // Process events in batches
        const batchSize = 50;
        const embeddingService = EmbeddingService.getInstance();

        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(events.length / batchSize)}`);

            for (const event of batch) {
                try {
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
                    await dataSource.query(
                        `UPDATE events SET embedding = $1 WHERE id = $2`,
                        [pgvector.toSql(embedding), event.id]
                    );

                    console.log(`Updated embedding for event ${event.id}: ${event.title}`);
                } catch (error) {
                    console.error(`Error processing event ${event.id}:`, error);
                }
            }

            // Add a small delay between batches to avoid overwhelming the API
            if (i + batchSize < events.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log("Finished regenerating embeddings");
        await dataSource.destroy();
    } catch (error) {
        console.error("Error during embedding regeneration:", error);
        process.exit(1);
    }
}

regenerateEmbeddings(); 