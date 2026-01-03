-- QR Menu SaaS - Complete SQL Schema and RLS Policies for Supabase
-- This file sets up the complete database schema with proper security policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create profiles table (matches auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create restaurants table
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    image_url TEXT,
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tables table
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    name TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (restaurant_id, table_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(available);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON public.tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_active ON public.tables(active);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for restaurants table
-- Restaurant owners can view their own restaurants
CREATE POLICY "Owners can view own restaurants" ON public.restaurants
    FOR SELECT USING (auth.uid() = owner_id);

-- Restaurant owners can create restaurants
CREATE POLICY "Owners can create restaurants" ON public.restaurants
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Restaurant owners can update their own restaurants
CREATE POLICY "Owners can update own restaurants" ON public.restaurants
    FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Restaurant owners can delete their own restaurants
CREATE POLICY "Owners can delete own restaurants" ON public.restaurants
    FOR DELETE USING (auth.uid() = owner_id);

-- Allow public to view restaurants (for menu access via slug)
CREATE POLICY "Public can view restaurants" ON public.restaurants
    FOR SELECT TO anon USING (true);

-- Allow authenticated users to view restaurants for public menu access
CREATE POLICY "Authenticated can view restaurants" ON public.restaurants
    FOR SELECT TO authenticated USING (true);

-- RLS Policies for menu_items table
-- Restaurant owners can manage menu items for their restaurants
CREATE POLICY "Owners can view own menu items" ON public.menu_items
    FOR SELECT USING (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

CREATE POLICY "Owners can create menu items" ON public.menu_items
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

CREATE POLICY "Owners can update own menu items" ON public.menu_items
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    ) WITH CHECK (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

CREATE POLICY "Owners can delete own menu items" ON public.menu_items
    FOR DELETE USING (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

-- Allow public to view available menu items (for menu display)
CREATE POLICY "Public can view available menu items" ON public.menu_items
    FOR SELECT TO anon USING (available = true);

-- Allow authenticated users to view available menu items for public menu access
CREATE POLICY "Authenticated can view available menu items" ON public.menu_items
    FOR SELECT TO authenticated USING (available = true);

-- RLS Policies for tables table
-- Restaurant owners can manage tables for their restaurants
CREATE POLICY "Owners can view own tables" ON public.tables
    FOR SELECT USING (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

CREATE POLICY "Owners can create tables" ON public.tables
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

CREATE POLICY "Owners can update own tables" ON public.tables
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    ) WITH CHECK (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

CREATE POLICY "Owners can delete own tables" ON public.tables
    FOR DELETE USING (
        auth.uid() IN (
            SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
        )
    );

-- Note: No public access to tables is allowed for security

-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create a profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to validate restaurant slug uniqueness and format
CREATE OR REPLACE FUNCTION public.validate_restaurant_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure slug is lowercase and contains only letters, numbers, and hyphens
    NEW.slug = LOWER(TRIM(NEW.slug));
    
    IF NEW.slug !~ '^[a-z0-9-]+$' THEN
        RAISE EXCEPTION 'Slug can only contain lowercase letters, numbers, and hyphens';
    END IF;
    
    IF LENGTH(NEW.slug) < 3 THEN
        RAISE EXCEPTION 'Slug must be at least 3 characters long';
    END IF;
    
    IF LENGTH(NEW.slug) > 50 THEN
        RAISE EXCEPTION 'Slug cannot be longer than 50 characters';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate restaurant slug
DROP TRIGGER IF EXISTS validate_slug ON public.restaurants;
CREATE TRIGGER validate_slug
    BEFORE INSERT OR UPDATE ON public.restaurants
    FOR EACH ROW EXECUTE PROCEDURE public.validate_restaurant_slug();

-- Function to validate menu item price
CREATE OR REPLACE FUNCTION public.validate_menu_item_price()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.price < 0 THEN
        RAISE EXCEPTION 'Price cannot be negative';
    END IF;
    
    IF NEW.price > 999999.99 THEN
        RAISE EXCEPTION 'Price cannot exceed 999999.99';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate menu item price
DROP TRIGGER IF EXISTS validate_price ON public.menu_items;
CREATE TRIGGER validate_price
    BEFORE INSERT OR UPDATE ON public.menu_items
    FOR EACH ROW EXECUTE PROCEDURE public.validate_menu_item_price();

-- Function to validate table number
CREATE OR REPLACE FUNCTION public.validate_table_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.table_number <= 0 THEN
        RAISE EXCEPTION 'Table number must be a positive integer';
    END IF;
    
    IF NEW.table_number > 9999 THEN
        RAISE EXCEPTION 'Table number cannot exceed 9999';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate table number
DROP TRIGGER IF EXISTS validate_table_number ON public.tables;
CREATE TRIGGER validate_table_number
    BEFORE INSERT OR UPDATE ON public.tables
    FOR EACH ROW EXECUTE PROCEDURE public.validate_table_number();

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant read permissions to anonymous users for public menu access
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.restaurants TO anon;
GRANT SELECT ON public.menu_items TO anon;

-- Create a view for public restaurant info (without sensitive data)
CREATE OR REPLACE VIEW public.public_restaurants AS
SELECT 
    id,
    name,
    slug,
    created_at
FROM public.restaurants;

-- Grant access to the public view
GRANT SELECT ON public.public_restaurants TO anon;
GRANT SELECT ON public.public_restaurants TO authenticated;

-- Create a view for public menu items with restaurant info
CREATE OR REPLACE VIEW public.public_menu_with_restaurant AS
SELECT 
    mi.id,
    mi.name,
    mi.description,
    mi.price,
    mi.image_url,
    mi.available,
    r.name AS restaurant_name,
    r.slug AS restaurant_slug
FROM public.menu_items mi
JOIN public.restaurants r ON mi.restaurant_id = r.id
WHERE mi.available = true;

-- Grant access to the public menu view
GRANT SELECT ON public.public_menu_with_restaurant TO anon;
GRANT SELECT ON public.public_menu_with_restaurant TO authenticated;

-- Function to get restaurant by slug (public access)
CREATE OR REPLACE FUNCTION public.get_restaurant_by_slug(restaurant_slug TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.name, r.slug, r.created_at
    FROM public.restaurants r
    WHERE r.slug = restaurant_slug;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_restaurant_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_by_slug(TEXT) TO authenticated;

-- Function to get menu items for a restaurant by slug (public access)
CREATE OR REPLACE FUNCTION public.get_menu_by_restaurant_slug(restaurant_slug TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    price NUMERIC,
    image_url TEXT,
    available BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT mi.id, mi.name, mi.description, mi.price, mi.image_url, mi.available
    FROM public.menu_items mi
    JOIN public.restaurants r ON mi.restaurant_id = r.id
    WHERE r.slug = restaurant_slug AND mi.available = true
    ORDER BY mi.name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_menu_by_restaurant_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_menu_by_restaurant_slug(TEXT) TO authenticated;

-- Insert initial data for testing (optional - remove for production)
-- This will only work after authentication is set up
/*
-- Example profile (will be created automatically via trigger)
-- Example restaurant
INSERT INTO public.restaurants (owner_id, name, slug) VALUES 
    ('00000000-0000-0000-0000-000000000000', 'Demo Restaurant', 'demo-restaurant')
ON CONFLICT (slug) DO NOTHING;

-- Example menu items
INSERT INTO public.menu_items (restaurant_id, name, description, price) VALUES 
    ((SELECT id FROM public.restaurants WHERE slug = 'demo-restaurant'), 'Classic Burger', 'Juicy beef patty with lettuce, tomato, and special sauce', 12.99),
    ((SELECT id FROM public.restaurants WHERE slug = 'demo-restaurant'), 'Caesar Salad', 'Fresh romaine lettuce with parmesan and croutons', 8.99),
    ((SELECT id FROM public.restaurants WHERE slug = 'demo-restaurant'), 'Fish & Chips', 'Beer-battered fish with crispy fries', 15.99)
ON CONFLICT DO NOTHING;
*/

-- Comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles linked to Supabase auth.users';
COMMENT ON TABLE public.restaurants IS 'Restaurant information with unique slugs for QR menu access';
COMMENT ON TABLE public.menu_items IS 'Individual menu items for each restaurant';
COMMENT ON TABLE public.tables IS 'Restaurant table management for QR code assignments';

COMMENT ON COLUMN public.restaurants.slug IS 'URL-friendly unique identifier for restaurant menus';
COMMENT ON COLUMN public.menu_items.available IS 'Whether the menu item is currently available for ordering';
COMMENT ON COLUMN public.menu_items.price IS 'Price in the restaurant''s local currency';
COMMENT ON COLUMN public.tables.table_number IS 'Unique numeric identifier for tables within a restaurant';
COMMENT ON COLUMN public.tables.name IS 'Optional descriptive name for the table (e.g., Window Table, VIP Table)';
COMMENT ON COLUMN public.tables.active IS 'Whether the table is currently active for QR code access';

-- Security note: All RLS policies ensure users can only access their own data
-- Public access is granted only for viewing restaurants and available menu items