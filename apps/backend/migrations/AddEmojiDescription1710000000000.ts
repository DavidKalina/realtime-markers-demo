import type { MigrationInterface, QueryRunner } from "typeorm";
import { OpenAIService } from "../services/shared/OpenAIService";

export class AddEmojiDescription1710000000000 implements MigrationInterface {
    name = 'AddEmojiDescription1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log("Starting AddEmojiDescription migration...");

        // First add the column
        console.log("Adding emoji_description column...");
        await queryRunner.query(`
            ALTER TABLE events 
            ADD COLUMN IF NOT EXISTS emoji_description VARCHAR;
        `);

        // Get all events that need emoji descriptions
        console.log("Fetching events that need emoji descriptions...");
        const events = await queryRunner.query(`
            SELECT id, emoji 
            FROM events 
            WHERE emoji IS NOT NULL 
            AND (emoji_description IS NULL OR emoji_description = '');
        `);

        console.log(`Found ${events.length} events that need emoji descriptions`);

        if (events.length === 0) {
            console.log("No events need updating. Migration complete.");
            return;
        }

        // Verify OpenAI configuration
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
        }

        // Process events in batches
        const batchSize = 50;
        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(events.length / batchSize)}`);
            console.log(`Batch size: ${batch.length} events`);

            for (const event of batch) {
                try {
                    console.log(`Processing event ${event.id} with emoji: ${event.emoji}`);

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

                    console.log("OpenAI Response:", JSON.stringify(response, null, 2));

                    const emojiDescription = response.choices[0]?.message.content?.trim();

                    if (emojiDescription) {
                        console.log(`Updating event ${event.id} with description: ${emojiDescription}`);
                        await queryRunner.query(`
                            UPDATE events 
                            SET emoji_description = $1 
                            WHERE id = $2
                        `, [emojiDescription, event.id]);
                    } else {
                        console.warn(`No description generated for event ${event.id} emoji: ${event.emoji}`);
                    }
                } catch (error) {
                    console.error(`Error processing emoji for event ${event.id}:`, error);
                    if (error instanceof Error) {
                        console.error("Error stack:", error.stack);
                    }
                }
            }

            console.log(`Completed batch ${Math.floor(i / batchSize) + 1}`);
        }

        console.log("Migration completed successfully");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log("Running down migration - removing emoji_description column");
        await queryRunner.query(`
            ALTER TABLE events 
            DROP COLUMN IF EXISTS emoji_description;
        `);
        console.log("Down migration completed");
    }
} 