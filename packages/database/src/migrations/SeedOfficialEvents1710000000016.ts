import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeedOfficialEvents1710000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Admin user ID from the seed users migration
    const adminUserId = "550e8400-e29b-41d4-a716-446655440003";

    // Insert official events based on Frederick, CO events
    await queryRunner.query(`
      INSERT INTO events (
        id, emoji, emoji_description, title, description, event_date, end_date,
        location, address, location_notes, scan_count, save_count, view_count,
        confidence_score, status, is_private, is_official, creator_id, timezone,
        created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440101',
        '🎈',
        'Hot air balloon',
        'Frederick In Flight',
        'Join the Town of Frederick as we celebrate the many forms of flight in June with a hot air balloon lift, Balloon Bash party, and tons of fun for the whole family! The balloons lift at daybreak which is around 6 am!',
        '2025-06-20 06:00:00+00',
        '2025-06-22 18:00:00+00',
        ST_GeomFromText('POINT(-104.9372 40.0992)', 4326),
        'Frederick, CO',
        'Various locations throughout Frederick',
        0, 0, 0,
        0.95,
        'VERIFIED',
        false,
        true,
        '${adminUserId}',
        'America/Denver',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO events (
        id, emoji, emoji_description, title, description, event_date, end_date,
        location, address, location_notes, scan_count, save_count, view_count,
        confidence_score, status, is_private, is_official, creator_id, timezone,
        created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440102',
        '🪓',
        'Chainsaw carving',
        'Chainsaws & Chuckwagons',
        'Our annual chainsaw carving competition is a family-friendly activity and open to the public. For four days, carvers create masterpiece carvings for the public to vote for competition winners. These carvings become pieces of art placed throughout Frederick, so come and be a part of their creation!',
        '2025-07-16 09:00:00+00',
        '2025-07-19 18:00:00+00',
        ST_GeomFromText('POINT(-104.9372 40.0992)', 4326),
        'Frederick, CO',
        'Downtown Frederick',
        0, 0, 0,
        0.95,
        'VERIFIED',
        false,
        true,
        '${adminUserId}',
        'America/Denver',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO events (
        id, emoji, emoji_description, title, description, event_date, end_date,
        location, address, location_notes, scan_count, save_count, view_count,
        confidence_score, status, is_private, is_official, creator_id, timezone,
        created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440103',
        '⛏️',
        'Mining pickaxe',
        'Miners Day',
        'Miners Day is Frederick''s annual event that originated as a memorial celebration to honor and remember the mining heritage that created Frederick. Frederick''s mining heritage will come alive with a parade, burro race, vendor market, food trucks, community performances, bands on the main stage, and the best fireworks show in the Carbon Valley.',
        '2025-09-20 10:00:00+00',
        '2025-09-20 22:00:00+00',
        ST_GeomFromText('POINT(-104.9372 40.0992)', 4326),
        'Frederick, CO',
        'Downtown Frederick and Crist Park',
        0, 0, 0,
        0.95,
        'VERIFIED',
        false,
        true,
        '${adminUserId}',
        'America/Denver',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO events (
        id, emoji, emoji_description, title, description, event_date, end_date,
        location, address, location_notes, scan_count, save_count, view_count,
        confidence_score, status, is_private, is_official, creator_id, timezone,
        created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440104',
        '👻',
        'Ghost',
        'Tiny Terror Town',
        'Our annual Halloween event for the Town of Frederick. Discover the tiniest frights you''ll find on the Front Range including the world''s tiniest haunted house! This family-friendly event will be a safe place for kids and families to trick-or-treat at tiny abodes in Crist park with our businesses in downtown Frederick.',
        '2025-10-18 16:00:00+00',
        '2025-10-18 21:00:00+00',
        ST_GeomFromText('POINT(-104.9372 40.0992)', 4326),
        'Frederick, CO',
        'Crist Park and Downtown Frederick',
        0, 0, 0,
        0.95,
        'VERIFIED',
        false,
        true,
        '${adminUserId}',
        'America/Denver',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO events (
        id, emoji, emoji_description, title, description, event_date, end_date,
        location, address, location_notes, scan_count, save_count, view_count,
        confidence_score, status, is_private, is_official, creator_id, timezone,
        created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440105',
        '🎄',
        'Christmas tree',
        'Festival of Lights',
        'Kick off the holiday season by helping us count down to the tree lighting in Crist Park! In addition to the lighting of the trees, this event will be full of festive cheer including free horse-drawn carriage rides, a live ice-sculpture demonstration, selfies with Santa, and festive holiday performances, and a parade of lights.',
        '2025-12-06 16:00:00+00',
        '2025-12-06 21:00:00+00',
        ST_GeomFromText('POINT(-104.9372 40.0992)', 4326),
        'Frederick, CO',
        'Crist Park',
        0, 0, 0,
        0.95,
        'VERIFIED',
        false,
        true,
        '${adminUserId}',
        'America/Denver',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO events (
        id, emoji, emoji_description, title, description, event_date, end_date,
        location, address, location_notes, scan_count, save_count, view_count,
        confidence_score, status, is_private, is_official, creator_id, timezone,
        created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440106',
        '🗣️',
        'Speaking head',
        'Community Tour & Talk',
        'Meet your neighbors, the Board of Trustees, and town staff at a Community Tour & Talk this summer. Throughout the summer, we''ll be stopping by a different Frederick neighborhood with food and a kids activity to welcome you and your neighbors. We''d love to answer your questions about the town and share a plate of food.',
        '2025-07-15 17:00:00+00',
        '2025-07-15 20:00:00+00',
        ST_GeomFromText('POINT(-104.9372 40.0992)', 4326),
        'Frederick, CO',
        'Various neighborhoods throughout Frederick',
        0, 0, 0,
        0.95,
        'VERIFIED',
        false,
        true,
        '${adminUserId}',
        'America/Denver',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO events (
        id, emoji, emoji_description, title, description, event_date, end_date,
        location, address, location_notes, scan_count, save_count, view_count,
        confidence_score, status, is_private, is_official, creator_id, timezone,
        created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440107',
        '🇺🇸',
        'American flag',
        'Carbon Valley Memorial Day Ceremony',
        'Start your Memorial Day weekend by remembering and mourning those who have died while serving in the United States armed forces.',
        '2025-05-23 10:00:00+00',
        '2025-05-23 12:00:00+00',
        ST_GeomFromText('POINT(-104.9372 40.0992)', 4326),
        'Frederick, CO',
        'Carbon Valley Memorial Park',
        0, 0, 0,
        0.95,
        'VERIFIED',
        false,
        true,
        '${adminUserId}',
        'America/Denver',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the seeded official events
    await queryRunner.query(`
      DELETE FROM events 
      WHERE id IN (
        '550e8400-e29b-41d4-a716-446655440101',
        '550e8400-e29b-41d4-a716-446655440102',
        '550e8400-e29b-41d4-a716-446655440103',
        '550e8400-e29b-41d4-a716-446655440104',
        '550e8400-e29b-41d4-a716-446655440105',
        '550e8400-e29b-41d4-a716-446655440106',
        '550e8400-e29b-41d4-a716-446655440107'
      )
    `);
  }
}
