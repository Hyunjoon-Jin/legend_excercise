import { supabase } from './supabase';
import type { Profile, Season, WorkoutLog, WorkoutType } from '@/types/database';

// --- Profiles ---
export const getProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
};

export const updateProfile = async (userId: string, updates: Partial<Profile>) => {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
    return { data, error };
};

// --- Seasons ---
export const getActiveSeason = async () => {
    const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .single();
    return { data, error };
};

// --- Workout Logs ---
export const getWorkoutLogs = async (seasonId: string) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .select(`
      *,
      profiles (
        username,
        display_name,
        avatar_url,
        tier
      )
    `)
        .eq('season_id', seasonId)
        .order('created_at', { ascending: false });
    return { data: data as WorkoutLog[], error };
};

export const submitWorkoutLog = async (log: Omit<WorkoutLog, 'id' | 'created_at' | 'status' | 'admin_note'>) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .insert([log])
        .select()
        .single();
    return { data, error };
};

export const updateLogStatus = async (logId: string, status: 'approved' | 'rejected', adminNote?: string) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .update({ status, admin_note: adminNote })
        .eq('id', logId);
    return { data, error };
};

// --- Rankings ---
export const getRankings = async (seasonId: string) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .select('user_id, profiles(username, tier)')
        .eq('season_id', seasonId)
        .eq('status', 'approved');

    if (error) return { data: null, error };

    // Aggregate by user
    const rankingMap: Record<string, { name: string; tier: string; count: number }> = {};
    data.forEach((log: any) => {
        const userId = log.user_id;
        if (!rankingMap[userId]) {
            rankingMap[userId] = {
                name: log.profiles.username,
                tier: log.profiles.tier,
                count: 0
            };
        }
        rankingMap[userId].count++;
    });

    return {
        data: Object.values(rankingMap).sort((a, b) => b.count - a.count),
        error: null
    };
};

// --- MVP Voting ---
export const castVote = async (seasonId: string, voterId: string, candidateId: string) => {
    const { data, error } = await supabase
        .from('votes')
        .insert([{ season_id: seasonId, voter_id: voterId, candidate_id: candidateId }])
        .select()
        .single();
    return { data, error };
};

export const hasVoted = async (seasonId: string, voterId: string) => {
    const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('season_id', seasonId)
        .eq('voter_id', voterId)
        .single();
    return { data: !!data, error };
};

// --- Notifications ---
export const getNotifications = async (userId: string) => {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return { data, error };
};

export const markNotificationAsRead = async (notificationId: string) => {
    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    return { data, error };
};

export const createNotification = async (notif: Omit<Notification, 'id' | 'created_at' | 'is_read'>) => {
    const { data, error } = await supabase
        .from('notifications')
        .insert([notif]);
    return { data, error };
};
