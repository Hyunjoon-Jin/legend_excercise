-- 1. Profiles (사용자 정보)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  avatar_url TEXT,
  tier TEXT DEFAULT 'Bronze',
  password TEXT DEFAULT '1234',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Seasons (시즌 정보)
CREATE TABLE IF NOT EXISTS seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  burning_start_date DATE,
  burning_end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Workout Logs (운동 인증 기록)
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  workout_date DATE DEFAULT CURRENT_DATE NOT NULL,
  workout_type TEXT NOT NULL CHECK (workout_type IN ('running', 'walking', 'gym', 'yoga', 'sports')),
  duration_minutes INTEGER NOT NULL,
  proof_image_url TEXT NOT NULL,
  comment TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Votes (MVP 투표: 1인 2표 가능, 동일인 중복 불가)
CREATE TABLE IF NOT EXISTS votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  voter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(season_id, voter_id, candidate_id)
);

-- 5. MVP PRs (자신 성과랑하기)
CREATE TABLE IF NOT EXISTS mvp_prs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(season_id, user_id)
);

-- 6. Notifications (알림 정보)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 비활성화 (커스텀 인증 시스템 사용으로 인한 조정)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE seasons DISABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE mvp_prs DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Policies (이미 존재할 수 있으므로 DO 블록 사용 추천 또는 수동 관리)
-- 여기서는 간결함을 위해 직접 작성하지만, 에러 발생 시 수동으로 삭제 후 재실행하거나 
-- 아래와 같은 형식을 사용할 수 있습니다.

-- Profiles Policies
DO $$ BEGIN
    CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seasons Policies
DO $$ BEGIN
    CREATE POLICY "Seasons are viewable by everyone" ON seasons FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Only admins can insert seasons" ON seasons FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Workout Logs Policies
DO $$ BEGIN
    CREATE POLICY "Workout logs are viewable by everyone" ON workout_logs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own logs" ON workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Only admins can update log status" ON workout_logs FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Votes Policies
DO $$ BEGIN
    CREATE POLICY "Votes are viewable by everyone" ON votes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can cast votes in active seasons" ON votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MVP PRs Policies
DO $$ BEGIN
    CREATE POLICY "MVP PRs are viewable by everyone" ON mvp_prs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can upsert own MVP PR" ON mvp_prs FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifications Policies
DO $$ BEGIN
    CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Only admins can insert notifications" ON notifications FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
