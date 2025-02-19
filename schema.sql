-- Enable PostGIS extension for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create markers table
CREATE TABLE markers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location GEOMETRY(Point, 4326) NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to notify on changes
CREATE OR REPLACE FUNCTION notify_marker_changes()
    RETURNS trigger AS
$$
BEGIN
    -- Convert the new row to JSON and publish to Redis
    PERFORM pg_notify(
        'marker_changes',
        json_build_object(
            'operation', TG_OP,
            'record', row_to_json(NEW)
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for real-time updates
CREATE TRIGGER markers_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON markers
    FOR EACH ROW
    EXECUTE FUNCTION notify_marker_changes();

-- Index for spatial queries
CREATE INDEX markers_location_idx ON markers USING GIST (location);