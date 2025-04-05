import type { MigrationInterface, QueryRunner } from "typeorm";
import { OpenAIService } from "../services/shared/OpenAIService";

export class AddEmojiDescription1710000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add the emojiDescription column
        await queryRunner.query(`
            ALTER TABLE events 
            ADD COLUMN IF NOT EXISTS emoji_description VARCHAR;
        `);

        // Get all events that have an emoji but no description
        const events = await queryRunner.query(`
            SELECT id, emoji 
            FROM events 
            WHERE emoji IS NOT NULL 
            AND (emoji_description IS NULL OR emoji_description = '');
        `);

        // Process events in batches to avoid overwhelming the API
        const batchSize = 50;
        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize);

            // Process each event in the batch
            const updates = await Promise.all(batch.map(async (event: { id: string; emoji: string }) => {
                try {
                    // Get emoji description from OpenAI
                    const response = await OpenAIService.executeChatCompletion({
                        model: "gpt-4o-mini",
                        messages: [
                            {
                                role: "system",
                                content: "You are a helpful assistant that provides brief, accurate descriptions of emoji. Respond with ONLY the description, no additional text or punctuation."
                            },
                            {
                                role: "user",
                                content: `What is a brief description of this emoji: ${event.emoji}`
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 20
                    });

                    const emojiDescription = response.choices[0]?.message.content?.trim();

                    if (emojiDescription) {
                        return {
                            id: event.id,
                            description: emojiDescription
                        };
                    }
                } catch (error) {
                    console.error(`Error processing emoji for event ${event.id}:`, error);
                }
                return null;
            }));

            // Filter out failed updates and update the database
            const validUpdates = updates.filter(update => update !== null);
            if (validUpdates.length > 0) {
                const updateValues = validUpdates
                    .map(update => `('${update!.id}', '${update!.description.replace(/'/g, "''")}')`)
                    .join(',');

                await queryRunner.query(`
                    UPDATE events AS e
                    SET emoji_description = c.description
                    FROM (VALUES ${updateValues}) AS c(id, description)
                    WHERE e.id = c.id;
                `);
            }

            // Log progress
            console.log(`Processed ${Math.min((i + batchSize), events.length)} of ${events.length} events`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE events 
            DROP COLUMN IF EXISTS emoji_description;
        `);
    }
} 