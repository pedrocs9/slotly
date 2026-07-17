ALTER TABLE tenants ADD COLUMN IF NOT EXISTS booking_page_status varchar(20) DEFAULT 'published' NOT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS brand_color varchar(7) DEFAULT '#5b6ee1' NOT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS post_booking_instructions text;

UPDATE tenants
SET booking_page_status = 'published'
WHERE booking_page_status NOT IN ('draft', 'published', 'paused');

UPDATE tenants
SET brand_color = '#5b6ee1'
WHERE brand_color IS NULL OR brand_color !~ '^#[0-9A-Fa-f]{6}$';
