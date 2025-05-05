import type { MigrationInterface, QueryRunner } from "typeorm";
import emojiData from "emoji-data";

// Define the actual structure from emoji-data package
interface EmojiDataRaw {
  name: string;
  unified: string;
  non_qualified?: string;
  docomo?: string;
  au?: string;
  softbank?: string;
  google?: string;
  image: string;
  sheet_x: number;
  sheet_y: number;
  short_name: string;
  short_names: string[];
  text?: string;
  texts?: string[];
  category: string;
  subcategory: string;
  sort_order: number;
  added_in: string;
  has_img_apple: boolean;
  has_img_google: boolean;
  has_img_twitter: boolean;
  has_img_facebook: boolean;
  skin_variations?: Record<string, any>;
  obsoletes?: string;
  obsoleted_by?: string;
}

interface ProcessedEmoji {
  emoji: string;
  name: string;
  category_id: string | null;
  keywords: string[];
  rank: number;
}

export class SeedEmojis1710000000005 implements MigrationInterface {
  name = "SeedEmojis1710000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create temporary table for bulk insert
    await queryRunner.query(`
      CREATE TEMPORARY TABLE temp_emojis (
        emoji text,
        name text,
        category_id uuid,
        keywords text[],
        rank integer
      )
    `);

    // Prepare emoji data
    const emojis = (emojiData.all() as unknown as EmojiDataRaw[])
      .filter((emoji) => emoji.unified && emoji.unified !== "undefined")
      .map(
        (emoji, index): ProcessedEmoji => ({
          emoji: this.unicodeToEmoji(emoji.unified),
          name: emoji.short_name.toLowerCase().replace(/_/g, " "),
          category_id: this.getCategoryId(emoji.category),
          keywords: this.getKeywords(emoji),
          rank: emoji.sort_order || index + 1,
        })
      );

    // Insert data in chunks to avoid memory issues
    const chunkSize = 100;
    for (let i = 0; i < emojis.length; i += chunkSize) {
      const chunk = emojis.slice(i, i + chunkSize);
      const values = chunk
        .map(
          (e: ProcessedEmoji) => `(
        '${e.emoji}',
        '${e.name.replace(/'/g, "''")}',
        ${e.category_id ? `'${e.category_id}'::uuid` : "NULL"},
        ARRAY[${e.keywords.map((k: string) => `'${k.replace(/'/g, "''")}'`).join(", ")}],
        ${e.rank}
      )`
        )
        .join(",");

      await queryRunner.query(`
        INSERT INTO temp_emojis (emoji, name, category_id, keywords, rank)
        VALUES ${values}
      `);
    }

    // Copy from temporary table to main table
    await queryRunner.query(`
      INSERT INTO emoji (emoji, name, category_id, keywords, rank)
      SELECT emoji, name, category_id, keywords, rank
      FROM temp_emojis
    `);

    // Drop temporary table
    await queryRunner.query(`DROP TABLE temp_emojis`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM emoji`);
  }

  private unicodeToEmoji(unified: string): string {
    return unified
      .split("-")
      .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
      .join("");
  }

  private getCategoryId(category: string): string | null {
    const categoryMap: Record<string, string> = {
      "Smileys & Emotion": "00000000-0000-0000-0000-000000000001",
      "People & Body": "00000000-0000-0000-0000-000000000002",
      "Animals & Nature": "00000000-0000-0000-0000-000000000003",
      "Food & Drink": "00000000-0000-0000-0000-000000000004",
      "Travel & Places": "00000000-0000-0000-0000-000000000005",
      Activities: "00000000-0000-0000-0000-000000000006",
      Objects: "00000000-0000-0000-0000-000000000007",
      Symbols: "00000000-0000-0000-0000-000000000008",
      Flags: "00000000-0000-0000-0000-000000000009",
    };
    return categoryMap[category] || null;
  }

  private getKeywords(emoji: EmojiDataRaw): string[] {
    const keywords = new Set<string>();

    // Add short name as keyword
    keywords.add(emoji.short_name.toLowerCase().replace(/_/g, " "));

    // Add all short names as keywords
    if (emoji.short_names) {
      emoji.short_names.forEach((name: string) => {
        keywords.add(name.toLowerCase().replace(/_/g, " "));
      });
    }

    // Add category and subcategory as keywords
    if (emoji.category) {
      keywords.add(emoji.category.toLowerCase());
    }
    if (emoji.subcategory) {
      keywords.add(emoji.subcategory.toLowerCase());
    }

    return Array.from(keywords);
  }
}
