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

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    content: string;
    is_read: boolean;
    link?: string;
    created_at: string;
}
