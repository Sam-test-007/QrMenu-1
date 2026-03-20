import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from 'jsonwebtoken';
import { supabase } from '../shared/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes for QR menu system

// Generate QR token for a table
app.post('/api/tables/:tableId/generate-token', async (req, res) => {
  try {
    const { tableId } = req.params;
    const expiresIn = '1h'; // fixed to 1 hour


    // Verify table exists
    const { data: table, error } = await supabase
      .from('tables')
      .select('*, restaurants(owner_id)')
      .eq('id', tableId)
      .single();

    if (error || !table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 3600;
    

    const token = jwt.sign(
      {
        restaurant_id: table.restaurant_id,
        table_id: tableId,
        issued_at: issuedAt,
        expires_at: expiresAt
      },
      JWT_SECRET
    );

    // Create session in DB
    const { data: session, error: sessionError } = await supabase
      .rpc('create_table_session', {
        p_table_id: tableId,
        p_token: token,
        p_expires_at: new Date(expiresAt * 1000).toISOString()
      });

    if (sessionError) {
      return res.status(500).json({ error: 'Failed to create session' });
    }

    res.json({
      token,
      session_id: session,
      expires_in: 3600
      
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  // Validate QR token and get menu
  app.post('/api/validate-token', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }

      // Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check if session is valid
      const { data: sessionData, error } = await supabase
        .rpc('validate_table_session', { p_token: token });

      if (error || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
        return res.status(401).json({ error: 'Session expired or invalid' });
      }

      const session = sessionData[0];

      // Get restaurant and menu
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .select('id, name, slug, image_url')
        .eq('id', session.restaurant_id)
        .single();

      if (restError || !restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      // Get table info
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('table_number, name')
        .eq('id', session.table_id)
        .single();

      if (tableError || !table) {
        return res.status(404).json({ error: 'Table not found' });
      }

      const { data: menu, error: menuError } = await supabase
        .rpc('get_menu_by_restaurant_slug', { restaurant_slug: restaurant.slug });

      if (menuError) {
        return res.status(500).json({ error: 'Failed to load menu' });
      }

      // Update last activity
      await supabase
        .from('table_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', session.session_id);

      res.json({
        session_id: session.session_id,
        restaurant,
        menu,
        table_number: table.table_number,
        table_name: table.name
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Place order
  app.post('/api/orders', async (req, res) => {
    try {
      const { session_id, items, suggestion } = req.body;

      if (!session_id || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid order data' });
      }

      // Validate session and get restaurant_id
      const { data: sessionData, error: sessionError } = await supabase
        .from('table_sessions')
        .select('id, active, expires_at, table_id')
        .eq('id', session_id)
        .single();

      if (sessionError || !sessionData || !sessionData.active || new Date(sessionData.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Get restaurant_id from tables
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select('restaurant_id')
        .eq('id', sessionData.table_id)
        .single();

      if (tableError || !tableData) {
        return res.status(500).json({ error: 'Failed to get restaurant info' });
      }

      const restaurantId = tableData.restaurant_id;

      // Rate limiting: check recent orders from this session
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentOrders, error: rateError } = await supabase
        .from('orders')
        .select('id')
        .eq('session_id', session_id)
        .gte('created_at', fiveMinutesAgo);

      if (rateError) {
        return res.status(500).json({ error: 'Rate limit check failed' });
      }

      if (recentOrders && recentOrders.length >= 5) {
        return res.status(429).json({ error: 'Too many orders, please wait' });
      }

      // Calculate total and validate items
      let total = 0;
      const orderItems = [];

      for (const item of items) {
        const { data: menuItem, error } = await supabase
          .from('menu_items')
          .select('id, price, available')
          .eq('id', item.menu_item_id)
          .single();

        if (error || !menuItem || !menuItem.available) {
          return res.status(400).json({ error: `Invalid item: ${item.menu_item_id}` });
        }

        const quantityRaw = item.quantity ?? 1;
        const quantity = typeof quantityRaw === "string" ? Number(quantityRaw) : quantityRaw;
        if (!Number.isInteger(quantity) || quantity < 1) {
          return res.status(400).json({ error: `Invalid quantity for item: ${item.menu_item_id}` });
        }
        const price = menuItem.price;
        total += price * quantity;

        orderItems.push({
          menu_item_id: menuItem.id,
          quantity,
          price
        });
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          session_id,
          restaurant_id: restaurantId,
          items: orderItems, // Add items array
          suggestion: suggestion || null,
          total
        })
        .select()
        .single();

      if (orderError) {
        return res.status(500).json({ error: 'Failed to create order' });
      }

      // Add order items
      const itemsToInsert = orderItems.map(item => ({
        order_id: order.id,
        ...item
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback order if items fail
        await supabase.from('orders').delete().eq('id', order.id);
        return res.status(500).json({ error: 'Failed to add order items' });
      }

      // Update session activity
      await supabase
        .from('table_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', session_id);

      res.json({ order_id: order.id, total, status: 'pending' });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get active sessions for admin
  app.get('/api/restaurants/:restaurantId/sessions', async (req, res) => {
    try {
      const { restaurantId } = req.params;

      // In production, verify ownership
      const { data: sessions, error } = await supabase
        .rpc('get_active_sessions', { p_restaurant_id: restaurantId });

      if (error) {
        return res.status(500).json({ error: 'Failed to load sessions' });
      }

      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get orders for admin
  app.get('/api/restaurants/:restaurantId/orders', async (req, res) => {
    try {
      const { restaurantId } = req.params;

      // First get orders for this restaurant
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(menu_items(name), quantity, price)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Orders query error:', error);
        return res.status(500).json({ error: 'Failed to load orders' });
      }

      // Enrich orders with table information
      const enrichedOrders = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: session, error: sessionError } = await supabase
            .from('table_sessions')
            .select('table_id, tables(table_number, name)')
            .eq('id', order.session_id)
            .single();

          if (sessionError) {
            console.error('Session query error for order', order.id, sessionError);
            return {
              ...order,
              table_sessions: null
            };
          }

          return {
            ...order,
            table_sessions: session
          };
        })
      );

      res.json(enrichedOrders);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Close session
  app.post('/api/sessions/:sessionId/close', async (req, res) => {
    try {
      const { sessionId } = req.params;

      const { data, error } = await supabase
        .rpc('close_table_session', { p_session_id: sessionId });

      if (error || !data) {
        return res.status(500).json({ error: 'Failed to close session' });
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  

  return httpServer;
}
