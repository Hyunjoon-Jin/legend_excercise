import { supabase } from './supabase';
import type { Profile, Season, WorkoutLog, WorkoutType, UserRole } from '@/types/database';

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

export const createMember = async (username: string, displayName?: string, role: UserRole = 'member') => {
    const { data, error } = await supabase
        .from('profiles')
        .insert([{
            id: crypto.randomUUID(),
            username,
            display_name: displayName || username,
            role,
            tier: 'Bronze',
            password: '1234'
        }])
        .select()
        .single();
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
        .insert([{
            ...log,
            status: log.proof_image_url === 'admin-registered' ? 'approved' : 'pending'
        }])
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

export const deleteWorkoutLogs = async (userId: string, seasonId: string, dates: string[]) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .delete()
        .eq('user_id', userId)
        .eq('season_id', seasonId)
        .in('workout_date', dates);
    return { data, error };
};

// --- Rankings ---
export const getRankings = async (seasonId: string) => {
    // 1. Fetch Season, Logs, and Votes in parallel
    const [seasonRes, logsRes, votesRes] = await Promise.all([
        supabase.from('seasons').select('*').eq('id', seasonId).single(),
        supabase.from('workout_logs')
            .select('user_id, workout_date, profiles(username, tier)')
            .eq('season_id', seasonId)
            .eq('status', 'approved'),
        supabase.from('votes')
            .select('candidate_id')
            .eq('season_id', seasonId)
    ]);

    if (logsRes.error) return { data: null, error: logsRes.error };

    const season = seasonRes.data as Season;
    const logs = logsRes.data as any[];
    const votes = votesRes.data as any[];

    // 2. Aggregate data by user
    const rankingMap: Record<string, {
        name: string;
        tier: string;
        workoutPoints: number;
        mvpPoints: number;
        totalScore: number;
        logCount: number;
        voteCount: number;
    }> = {};

    // Process Logs
    logs.forEach((log) => {
        const userId = log.user_id;
        if (!rankingMap[userId]) {
            rankingMap[userId] = {
                name: log.profiles.username,
                tier: log.profiles.tier,
                workoutPoints: 0,
                mvpPoints: 0,
                totalScore: 0,
                logCount: 0,
                voteCount: 0
            };
        }

        // Check for Burning Period
        let points = 1;
        if (season?.burning_start_date && season?.burning_end_date) {
            const workDate = new Date(log.workout_date);
            const burnStart = new Date(season.burning_start_date);
            const burnEnd = new Date(season.burning_end_date);
            if (workDate >= burnStart && workDate <= burnEnd) {
                points = 2; // Double points during burning period
            }
        }

        rankingMap[userId].workoutPoints += points;
        rankingMap[userId].logCount += 1;
    });

    // Process Votes
    if (votes) {
        votes.forEach((vote) => {
            const candidateId = vote.candidate_id;
            if (rankingMap[candidateId]) {
                rankingMap[candidateId].mvpPoints += 2; // 2 points per vote
                rankingMap[candidateId].voteCount += 1;
            }
        });
    }

    // Calculate Total Score
    Object.values(rankingMap).forEach(item => {
        item.totalScore = item.workoutPoints + item.mvpPoints;
    });

    return {
        data: Object.values(rankingMap).sort((a, b) => b.totalScore - a.totalScore),
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
