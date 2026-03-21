import express from 'express';
import supabase from '../db.js';
import { requireAuth } from '../auth-middleware.js';

const router = express.Router();

/**
 * POST /api/subscriptions
 * Subscribe to weekly puzzles (requires auth)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        email_notifications: true,
        is_active: true,
        subscribed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      subscription: data,
      message: 'Successfully subscribed to weekly puzzles!'
    });
  } catch (error) {
    console.error('Error subscribing user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/subscriptions/status
 * Get subscription status (requires auth)
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }

    if (!data) {
      return res.json({
        subscribed: false,
        email_notifications: false,
        is_active: false
      });
    }

    res.json({
      subscribed: data.is_active,
      email_notifications: data.email_notifications,
      is_active: data.is_active,
      subscribed_at: data.subscribed_at
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/subscriptions
 * Update subscription preferences (requires auth)
 */
router.put('/', requireAuth, async (req, res) => {
  try {
    const { email_notifications } = req.body;

    if (typeof email_notifications !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request - email_notifications must be boolean' });
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update({ email_notifications })
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      subscription: data
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/subscriptions
 * Unsubscribe from weekly puzzles (requires auth)
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Successfully unsubscribed from weekly puzzles'
    });
  } catch (error) {
    console.error('Error unsubscribing user:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
