import express from 'express';
import supabase from '../db.js';
import { requireAuth, requireAdmin } from '../auth-middleware.js';

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(requireAuth, requireAdmin);

/**
 * POST /api/admin/puzzles
 * Create new puzzle (admin only)
 */
router.post('/puzzles', async (req, res) => {
  try {
    const {
      title,
      description,
      hint,
      difficulty,
      board_state,
      solution,
      turn,
      week_number,
      tags
    } = req.body;

    // Validate required fields
    if (!title || !description || !board_state || !solution || !turn) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, board_state, solution, turn'
      });
    }

    const { data, error } = await supabase
      .from('puzzles')
      .insert({
        title,
        description,
        hint,
        difficulty: difficulty || 1,
        board_state,
        solution,
        turn,
        week_number,
        tags: tags || [],
        created_by: req.user.id,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      puzzle: data
    });
  } catch (error) {
    console.error('Error creating puzzle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/puzzles/:id
 * Update existing puzzle (admin only)
 */
router.put('/puzzles/:id', async (req, res) => {
  try {
    const puzzleId = parseInt(req.params.id);
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.created_by;

    const { data, error } = await supabase
      .from('puzzles')
      .update(updates)
      .eq('id', puzzleId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      puzzle: data
    });
  } catch (error) {
    console.error('Error updating puzzle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/puzzles/:id
 * Delete puzzle (soft delete by setting is_active = false)
 */
router.delete('/puzzles/:id', async (req, res) => {
  try {
    const puzzleId = parseInt(req.params.id);

    const { error } = await supabase
      .from('puzzles')
      .update({ is_active: false })
      .eq('id', puzzleId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Puzzle deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting puzzle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/puzzles/:id/schedule
 * Schedule puzzle for specific week (admin only)
 */
router.post('/puzzles/:id/schedule', async (req, res) => {
  try {
    const puzzleId = parseInt(req.params.id);
    const { week_date } = req.body;

    if (!week_date) {
      return res.status(400).json({ error: 'week_date is required (format: YYYY-MM-DD)' });
    }

    // Verify it's a Monday
    const date = new Date(week_date);
    if (date.getDay() !== 1) {
      return res.status(400).json({ error: 'week_date must be a Monday' });
    }

    const { data, error } = await supabase
      .from('weekly_puzzle_schedule')
      .insert({
        puzzle_id: puzzleId,
        scheduled_week: week_date
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'This puzzle or week is already scheduled' });
      }
      throw error;
    }

    res.json({
      success: true,
      schedule: data
    });
  } catch (error) {
    console.error('Error scheduling puzzle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/schedule
 * Get upcoming weekly puzzle schedule (admin only)
 */
router.get('/schedule', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('weekly_puzzle_schedule')
      .select(`
        id,
        scheduled_week,
        puzzle_id,
        puzzles (title, description, difficulty)
      `)
      .gte('scheduled_week', new Date().toISOString().split('T')[0])
      .order('scheduled_week', { ascending: true })
      .limit(20);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stats
 * Get platform statistics (admin only)
 */
router.get('/stats', async (req, res) => {
  try {
    // Get user count
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get active subscriptions count
    const { count: subscriptionCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get puzzle count
    const { count: puzzleCount } = await supabase
      .from('puzzles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get total puzzle attempts
    const { count: attemptCount } = await supabase
      .from('user_puzzle_attempts')
      .select('*', { count: 'exact', head: true });

    // Get solved puzzles count
    const { count: solvedCount } = await supabase
      .from('user_puzzle_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('solved', true);

    res.json({
      users: userCount || 0,
      active_subscriptions: subscriptionCount || 0,
      total_puzzles: puzzleCount || 0,
      total_attempts: attemptCount || 0,
      total_solved: solvedCount || 0,
      solve_rate: attemptCount > 0 ? ((solvedCount / attemptCount) * 100).toFixed(1) + '%' : '0%'
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
