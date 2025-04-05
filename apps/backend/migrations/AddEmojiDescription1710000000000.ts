import type { MigrationInterface, QueryRunner } from "typeorm";
import { OpenAIService } from "../services/shared/OpenAIService";

export class AddEmojiDescription1710000000000 implements MigrationInterface {
    name = 'AddEmojiDescription1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First add the column
        await queryRunner.query(`
            ALTER TABLE events 
            ADD COLUMN IF NOT EXISTS emoji_description VARCHAR;
        `);

        // Get all events that need emoji descriptions
        const events = await queryRunner.query(`
            SELECT id, emoji 
            FROM events 
            WHERE emoji IS NOT NULL 
            AND (emoji_description IS NULL OR emoji_description = '');
        `);

        console.log(`Found ${events.length} events that need emoji descriptions`);

        // Process events in batches
        const batchSize = 50;
        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(events.length / batchSize)}`);

            for (const event of batch) {
                try {
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
                        await queryRunner.query(`
                            UPDATE events 
                            SET emoji_description = $1 
                            WHERE id = $2
                        `, [emojiDescription, event.id]);

                        console.log(`Updated emoji description for event ${event.id}: ${event.emoji} -> ${emojiDescription}`);
                    }
                } catch (error) {
                    console.error(`Error processing emoji for event ${event.id}:`, error);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE events 
            DROP COLUMN IF EXISTS emoji_description;
        `);
    }
} 