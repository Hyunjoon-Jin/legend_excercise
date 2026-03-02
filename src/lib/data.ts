import { supabase } from './supabase';
import type { Profile, Season, WorkoutLog, WorkoutType, UserRole, Vote, MVPPr, ChatMessage, Post, PostComment, Announcement, Notification as AppNotification } from '@/types/database';

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

export const getAllSeasons = async () => {
    const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('start_date', { ascending: false });
    return { data, error };
};

export const createSeason = async (season: Omit<Season, 'id' | 'created_at' | 'is_active'>) => {
    const { data, error } = await supabase
        .from('seasons')
        .insert([{ ...season, is_active: false }])
        .select()
        .single();
    return { data, error };
};

export const toggleSeasonActive = async (seasonId: string) => {
    // 1. Deactivate all seasons
    await supabase.from('seasons').update({ is_active: false }).neq('id', seasonId);
    // 2. Activate the target season
    const { data, error } = await supabase
        .from('seasons')
        .update({ is_active: true })
        .eq('id', seasonId)
        .select()
        .single();
    return { data, error };
};

export const setVotingOpen = async (seasonId: string, open: boolean, votingEndsAt?: string) => {
    const updates: Record<string, any> = { voting_open: open };
    if (votingEndsAt !== undefined) updates.voting_ends_at = votingEndsAt;
    const { data, error } = await supabase
        .from('seasons')
        .update(updates)
        .eq('id', seasonId)
        .select()
        .single();
    return { data, error };
};

export const closeSeason = async (seasonId: string) => {
    // 1. Close season: deactivate + close voting + set closed_at
    const now = new Date().toISOString();
    const { data: seasonData, error: updateError } = await supabase
        .from('seasons')
        .update({ is_active: false, voting_open: false, closed_at: now })
        .eq('id', seasonId)
        .select()
        .single();
    if (updateError) return { data: null, error: updateError };

    // 2. Fetch all member profiles to broadcast notification
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id');

    if (profiles && profiles.length > 0) {
        const notifications = profiles.map((p: { id: string }) => ({
            user_id: p.id,
            title: '🏁 시즌이 종료되었습니다!',
            content: `MVP 투표가 마감되고 ${seasonData.name} 시즌이 공식 종료되었습니다. 시즌 결과 브리핑을 확인해 보세요!`,
            is_read: false,
            link: `/season-result/${seasonId}`,
        }));
        await supabase.from('notifications').insert(notifications);
    }

    return { data: seasonData, error: null };
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

export const getCertificationFeed = async (limit: number = 30) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .select('*, profiles(id, username, display_name, avatar_url, tier)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit);
    return { data: data as WorkoutLog[], error };
};

export const getPendingLogs = async (seasonId: string) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .select('*, profiles(username, display_name, avatar_url, tier)')
        .eq('season_id', seasonId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    return { data: data as WorkoutLog[], error };
};

export const notifyAdmins = async (memberName: string, logId: string) => {
    const { data: admins } = await supabase
        .from('profiles').select('id').eq('role', 'admin');
    if (!admins || admins.length === 0) return { error: null };
    const notifications = admins.map((admin: { id: string }) => ({
        user_id: admin.id,
        title: '새 운동 인증 신청',
        content: `${memberName} 님이 운동 인증을 신청했습니다. 확인 후 승인해 주세요.`,
        is_read: false,
        link: '/admin',
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    return { error };
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

export const deleteWorkoutLog = async (logId: string) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .delete()
        .eq('id', logId);
    return { data, error };
};

export const updateWorkoutLog = async (
    logId: string,
    updates: {
        workout_type?: string;
        duration_minutes?: number;
        comment?: string;
        proof_image_url?: string;
        workout_date?: string;
    }
) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .update(updates)
        .eq('id', logId)
        .select()
        .single();
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
    const userStats: Record<string, {
        userId: string;
        name: string;
        tier: string;
        weightedLogCount: number;
        rawVoteCount: number;
        logCount: number;
    }> = {};

    // Process Logs
    logs.forEach((log) => {
        const userId = log.user_id;
        if (!userStats[userId]) {
            userStats[userId] = {
                userId: userId,
                name: log.profiles.username,
                tier: log.profiles.tier,
                weightedLogCount: 0,
                rawVoteCount: 0,
                logCount: 0
            };
        }

        // Check for Burning Period
        let weight = 1;
        if (season?.burning_start_date && season?.burning_end_date) {
            const workDate = new Date(log.workout_date);
            const burnStart = new Date(season.burning_start_date);
            const burnEnd = new Date(season.burning_end_date);
            if (workDate >= burnStart && workDate <= burnEnd) {
                weight = 2; // Double weight during burning period
            }
        }

        userStats[userId].weightedLogCount += weight;
        userStats[userId].logCount += 1;
    });

    // Process Votes
    const totalVotes = votes?.length || 0;
    if (votes) {
        votes.forEach((vote) => {
            const candidateId = vote.candidate_id;
            if (userStats[candidateId]) {
                userStats[candidateId].rawVoteCount += 1;
            }
        });
    }

    // 3. Final Score Calculation (Regulation 21)
    // Find Max Weighted Log Count for 70% normalization
    const maxWeightedLogCount = Math.max(0, ...Object.values(userStats).map(u => u.weightedLogCount));

    const rankings = Object.values(userStats).map(stats => {
        // Certification Score (70%)
        const workoutPoints = maxWeightedLogCount > 0
            ? (stats.weightedLogCount / maxWeightedLogCount) * 70
            : 0;

        // MVP Score (30%)
        const mvpPoints = totalVotes > 0
            ? (stats.rawVoteCount / totalVotes) * 30
            : 0;

        return {
            userId: stats.userId,
            name: stats.name,
            tier: stats.tier,
            workoutPoints: Number(workoutPoints.toFixed(2)),
            mvpPoints: Number(mvpPoints.toFixed(2)),
            totalScore: Number((workoutPoints + mvpPoints).toFixed(2)),
            logCount: stats.logCount,
            voteCount: stats.rawVoteCount
        };
    });

    return {
        data: rankings.sort((a, b) => b.totalScore - a.totalScore),
        error: null
    };
};

export const castVote = async (seasonId: string, voterId: string, candidateId: string) => {
    // Check if voter already cast 2 votes
    const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('season_id', seasonId)
        .eq('voter_id', voterId);

    if (count !== null && count >= 2) {
        return { data: null, error: new Error("인당 최대 2표까지만 추천 가능합니다.") };
    }

    const { data, error } = await supabase
        .from('votes')
        .insert([{ season_id: seasonId, voter_id: voterId, candidate_id: candidateId }])
        .select()
        .single();
    return { data, error };
};

export const getVotes = async (seasonId: string, voterId: string) => {
    const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('season_id', seasonId)
        .eq('voter_id', voterId);
    return { data: data as Vote[], error };
};

export const removeVote = async (seasonId: string, voterId: string, candidateId: string) => {
    const { data, error } = await supabase
        .from('votes')
        .delete()
        .eq('season_id', seasonId)
        .eq('voter_id', voterId)
        .eq('candidate_id', candidateId);
    return { data, error };
};

export const hasVoted = async (seasonId: string, voterId: string) => {
    const { data, error } = await getVotes(seasonId, voterId);
    return { data: (data && data.length >= 2), error };
};

// --- MVP PRs ---
export const getMVPPrs = async (seasonId: string) => {
    const { data, error } = await supabase
        .from('mvp_prs')
        .select('*')
        .eq('season_id', seasonId);
    return { data: data as MVPPr[], error };
};

export const submitMVPPr = async (pr: Omit<MVPPr, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
        .from('mvp_prs')
        .upsert([pr], { onConflict: 'season_id,user_id' })
        .select()
        .single();
    return { data, error };
};

export const uploadMVPImage = async (file: File, userId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `mvp-prs/${fileName}`;

    const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file);

    if (error) return { data: null, error };

    const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

    return { data: publicUrl, error: null };
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

export const createNotification = async (notif: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>) => {
    const { data, error } = await supabase
        .from('notifications')
        .insert([notif]);
    return { data, error };
};

export const broadcastAnnouncement = async (title: string, content: string, link?: string) => {
    const { data: profiles } = await supabase.from('profiles').select('id');
    if (!profiles || profiles.length === 0) return { error: new Error('회원이 없습니다.') };
    const notifications = profiles.map((p: { id: string }) => ({
        user_id: p.id,
        title,
        content,
        is_read: false,
        link: link || null,
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    return { error };
};

// announcements 테이블에 저장 + 전체 알림 발송
export const sendAnnouncement = async (title: string, content: string, adminId: string) => {
    // 1. Insert announcement record
    const { data: ann, error: annError } = await supabase
        .from('announcements')
        .insert([{ title, content, created_by: adminId }])
        .select()
        .single();
    if (annError) return { data: null, error: annError };

    // 2. Notify all members
    const { data: profiles } = await supabase.from('profiles').select('id');
    if (profiles && profiles.length > 0) {
        const notifications = profiles.map((p: { id: string }) => ({
            user_id: p.id,
            title: `📢 ${title}`,
            content,
            is_read: false,
            link: '/community',
        }));
        await supabase.from('notifications').insert(notifications);
    }
    return { data: ann as Announcement, error: null };
};

export const getAnnouncements = async () => {
    const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles(username, display_name)')
        .order('created_at', { ascending: false });
    return { data: data as Announcement[] | null, error };
};

export const getLatestAnnouncement = async () => {
    const { data, error } = await supabase
        .from('announcements')
        .select('id, title, content, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return { data: data as Pick<Announcement, 'id' | 'title' | 'content' | 'created_at'> | null, error };
};

export const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    return { error };
};

// --- Chat ---
export const getChatMessages = async () => {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*, profiles(id, username, display_name, avatar_url)')
        .order('created_at', { ascending: true })
        .limit(100);
    return { data: data as ChatMessage[], error };
};

export const sendChatMessage = async (userId: string, content: string) => {
    const { data, error } = await supabase
        .from('chat_messages')
        .insert([{ user_id: userId, content }])
        .select('*, profiles(id, username, display_name, avatar_url)')
        .single();
    return { data: data as ChatMessage, error };
};

// --- Posts ---
export const getPosts = async () => {
    const { data, error } = await supabase
        .from('posts')
        .select(`
            *,
            profiles(id, username, display_name, avatar_url),
            post_comments(count)
        `)
        .order('created_at', { ascending: false });

    if (error) return { data: null, error };

    const posts = (data || []).map((p: any) => ({
        ...p,
        comment_count: p.post_comments?.[0]?.count ?? 0,
    })) as Post[];

    return { data: posts, error: null };
};

export const getPost = async (postId: string) => {
    const [postRes, commentsRes] = await Promise.all([
        supabase
            .from('posts')
            .select('*, profiles(id, username, display_name, avatar_url)')
            .eq('id', postId)
            .single(),
        supabase
            .from('post_comments')
            .select('*, profiles(id, username, display_name, avatar_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true }),
    ]);
    return {
        data: postRes.data as Post | null,
        comments: commentsRes.data as PostComment[],
        error: postRes.error || commentsRes.error,
    };
};

export const uploadPostMedia = async (file: File, userId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `post-media/${fileName}`;

    const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file);

    if (error) return { data: null, error };

    const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

    return { data: publicUrl, error: null };
};

export const createPost = async (userId: string, title: string, content: string, mediaUrls?: string[]) => {
    const { data, error } = await supabase
        .from('posts')
        .insert([{ user_id: userId, title, content, media_urls: mediaUrls || [] }])
        .select()
        .single();
    return { data: data as Post, error };
};

export const deletePost = async (postId: string, userId: string) => {
    const { data, error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId);
    return { data, error };
};

export const createComment = async (postId: string, userId: string, content: string) => {
    const { data, error } = await supabase
        .from('post_comments')
        .insert([{ post_id: postId, user_id: userId, content }])
        .select('*, profiles(id, username, display_name, avatar_url)')
        .single();
    return { data: data as PostComment, error };
};

export const deleteComment = async (commentId: string, userId: string) => {
    const { data, error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);
    return { data, error };
};

export const getMyLike = async (postId: string, userId: string) => {
    const { data, error } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
    return { data, error };
};

export const toggleLike = async (postId: string, userId: string) => {
    const { data: existing } = await getMyLike(postId, userId);
    if (existing) {
        // Unlike
        await supabase.from('post_likes').delete().eq('id', existing.id);
        const { data, error } = await supabase
            .from('posts')
            .update({ like_count: supabase.rpc('decrement', { x: 1 }) as any })
            .eq('id', postId)
            .select('like_count')
            .single();
        // Simpler: just re-count
        const { count } = await supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        await supabase.from('posts').update({ like_count: count ?? 0 }).eq('id', postId);
        return { liked: false, error: null };
    } else {
        // Like
        await supabase.from('post_likes').insert([{ post_id: postId, user_id: userId }]);
        const { count } = await supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        await supabase.from('posts').update({ like_count: count ?? 0 }).eq('id', postId);
        return { liked: true, error: null };
    }
};

// --- Reactions ---
export const getReactionsForTargets = async (
    targetType: 'chat' | 'post' | 'comment',
    targetIds: string[]
) => {
    if (targetIds.length === 0) return { data: [] as { target_id: string; user_id: string; emoji: string }[], error: null };
    const { data, error } = await supabase
        .from('reactions')
        .select('target_id, user_id, emoji')
        .eq('target_type', targetType)
        .in('target_id', targetIds);
    return { data: data as { target_id: string; user_id: string; emoji: string }[] | null, error };
};

export const toggleReaction = async (
    targetType: 'chat' | 'post' | 'comment',
    targetId: string,
    userId: string,
    emoji: string
) => {
    const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();
    if (existing) {
        await supabase.from('reactions').delete().eq('id', existing.id);
        return { added: false };
    }
    await supabase.from('reactions').insert([{ target_type: targetType, target_id: targetId, user_id: userId, emoji }]);
    return { added: true };
};

// --- Trophy Stats ---
export interface TrophyRawStats {
    logs: { workout_date: string }[];
    totalVotesReceived: number;
    mvpWinCount: number;
}

export const getUserTrophyStats = async (userId: string): Promise<{ data: TrophyRawStats | null; error: any }> => {
    const [{ data: logs }, { data: myVotes }] = await Promise.all([
        supabase.from('workout_logs').select('workout_date').eq('user_id', userId).eq('status', 'approved'),
        supabase.from('votes').select('season_id').eq('candidate_id', userId),
    ]);

    // 시즌별 득표 수 집계
    const seasonVotes: Record<string, number> = {};
    (myVotes || []).forEach(v => { seasonVotes[v.season_id] = (seasonVotes[v.season_id] || 0) + 1; });

    // 시즌별 최다 득표자 확인 → MVP 선정 횟수
    let mvpWinCount = 0;
    await Promise.all(Object.entries(seasonVotes).map(async ([seasonId, myCount]) => {
        const { data: allVotes } = await supabase.from('votes').select('candidate_id').eq('season_id', seasonId);
        if (!allVotes || allVotes.length === 0) return;
        const counts: Record<string, number> = {};
        allVotes.forEach(v => { counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1; });
        const maxCount = Math.max(0, ...Object.values(counts));
        if (myCount >= maxCount && maxCount > 0) mvpWinCount++;
    }));

    return {
        data: {
            logs: (logs || []) as { workout_date: string }[],
            totalVotesReceived: (myVotes || []).length,
            mvpWinCount,
        },
        error: null,
    };
};

// --- Season History ---
export interface SeasonStat {
    season: Season;
    rank: number | null;
    totalParticipants: number;
    logCount: number;
    totalScore: number;
    workoutPoints: number;
    mvpPoints: number;
}

export const getSeasonStatsForUser = async (userId: string): Promise<{ data: SeasonStat[] | null; error: any }> => {
    const { data: seasons, error } = await getAllSeasons();
    if (error || !seasons) return { data: null, error };

    const results = await Promise.all(
        seasons.map(async (season): Promise<SeasonStat> => {
            const { data: rankings } = await getRankings(season.id);
            const myIdx = rankings ? rankings.findIndex((r: any) => r.userId === userId) : -1;
            const myEntry = myIdx >= 0 ? rankings![myIdx] : null;
            return {
                season,
                rank: myIdx >= 0 ? myIdx + 1 : null,
                totalParticipants: rankings?.length ?? 0,
                logCount: myEntry?.logCount ?? 0,
                totalScore: myEntry?.totalScore ?? 0,
                workoutPoints: myEntry?.workoutPoints ?? 0,
                mvpPoints: myEntry?.mvpPoints ?? 0,
            };
        })
    );

    return { data: results, error: null };
};
