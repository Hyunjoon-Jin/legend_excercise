export type UserRole = 'admin' | 'member';
export type WorkoutType = 'running' | 'walking' | 'gym' | 'yoga' | 'sports';
export type LogStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
    id: string;
    username: string;
    display_name?: string;
    role: UserRole;
    avatar_url?: string;
    tier: string;
    password?: string;
    created_at: string;
}

export interface Season {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    burning_start_date?: string;
    burning_end_date?: string;
    is_active: boolean;
    voting_open?: boolean;
    voting_ends_at?: string;
    closed_at?: string;
    created_at: string;
}

export interface WorkoutLog {
    id: string;
    user_id: string;
    season_id: string;
    workout_date: string;
    workout_type: WorkoutType;
    duration_minutes: number;
    proof_image_url: string;
    proof_media_urls?: string[];
    comment?: string;
    status: LogStatus;
    admin_note?: string;
    created_at: string;
    // Join data
    profiles?: Profile;
}

export interface Vote {
    id: string;
    season_id: string;
    voter_id: string;
    candidate_id: string;
    created_at: string;
}

export interface AppNotification {
    id: string;
    user_id: string;
    type: 'system' | 'mention' | 'reply' | 'reaction' | 'certification';
    title: string;
    content: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

export interface UserSubscription {
    id: string;
    user_id: string; // references profiles.id
    endpoint: string;
    p256dh: string;
    auth: string;
    created_at: string;
}

export interface MVPPr {
    id: string;
    season_id: string;
    user_id: string;
    content: string;
    image_url?: string;
    created_at: string;
}

export interface ChatMessage {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles?: Profile;
}

export interface Post {
    id: string;
    user_id: string;
    title: string;
    content: string;
    like_count: number;
    media_urls?: string[];
    created_at: string;
    updated_at: string;
    profiles?: Profile;
    comment_count?: number;
}

export interface PostComment {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles?: Profile;
}

export interface PostLike {
    id: string;
    post_id: string;
    user_id: string;
    created_at: string;
}

export interface Reaction {
    id: string;
    target_type: 'chat' | 'post' | 'comment';
    target_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
}

export interface ReactionGroup {
    emoji: string;
    count: number;
    hasMe: boolean;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    created_by: string | null;
    created_at: string;
    profiles?: { username: string; display_name?: string } | null;
}
