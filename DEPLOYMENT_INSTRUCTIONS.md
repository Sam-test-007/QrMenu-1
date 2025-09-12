# Supabase Schema Deployment Instructions

## Step 1: Fix Database Connection URL

The current DATABASE_URL format is incorrect for Drizzle + Supabase. You need the **pooler connection string**:

### Get the Correct URL:
1. Go to your Supabase dashboard: https://supabase.com/dashboard/projects
2. Navigate to **Settings > Database**
3. Under "Connection string", select **"Connection pooling"** 
4. Copy the URI that looks like:
   ```
   postgresql://postgres.[PROJECT-ID]:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:6543/postgres
   ```

### Key Format Requirements:
- Protocol: `postgresql://` (not `postgres://`)
- Username: `postgres.weaagxmuxldokklqzhov` (includes your project ID)
- Host: `aws-*-pooler.supabase.com` (pooler URL)
- Port: `6543` (pooler port, not 5432)
- URL-encode special characters in password (# → %23, @ → %40, etc.)

## Step 2: Update Environment Variable

Replace the current DATABASE_URL with the pooler connection string from Step 1.

## Step 3: Deploy Schema

### Option A: Using Drizzle (Recommended)
```bash
npm run db:push
```

### Option B: Manual SQL (if Drizzle still fails)
1. Open Supabase dashboard → SQL Editor
2. Copy and paste the contents of `supabase_schema.sql`
3. Execute the SQL

## Step 4: Verify Deployment

After successful deployment, your database will have:
- ✅ Tables: profiles, restaurants, menu_items
- ✅ Row Level Security policies for multi-tenant access
- ✅ Auto-profile creation for new users
- ✅ Data validation triggers
- ✅ Public functions for menu access
- ✅ Proper indexes for performance

## Security Features Included

- **Multi-tenant RLS**: Users can only access their own data
- **Public menu access**: Anonymous users can view restaurant menus via slug
- **Ownership protection**: Users cannot transfer ownership of restaurants/menu items
- **Data validation**: Automatic slug formatting and price validation
- **Auto-profiles**: User profiles created automatically on signup

Your QR Menu SaaS is now ready with comprehensive database security!