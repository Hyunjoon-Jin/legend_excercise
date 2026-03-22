export const WORKOUT_TYPE_OPTIONS = [
    { value: 'running',    label: '🏃 러닝' },
    { value: 'walking',    label: '🚶 걷기/산책' },
    { value: 'gym',        label: '💪 운동완료' },
    { value: 'cycling',    label: '🚴 자전거/사이클링' },
    { value: 'swimming',   label: '🏊 수영' },
    { value: 'hiking',     label: '🏔️ 등산/하이킹' },
    { value: 'climbing',   label: '🧗 클라이밍' },
    { value: 'yoga',       label: '🧘 요가/필라테스' },
    { value: 'tennis',     label: '🎾 테니스' },
    { value: 'badminton',  label: '🏸 배드민턴' },
    { value: 'football',   label: '⚽ 축구' },
    { value: 'basketball', label: '🏀 농구' },
    { value: 'sports',     label: '🏆 기타 스포츠' },
] as const;

export type WorkoutTypeValue = typeof WORKOUT_TYPE_OPTIONS[number]['value'];

export function getWorkoutLabel(type: string): string {
    return WORKOUT_TYPE_OPTIONS.find(o => o.value === type)?.label ?? '🏋️ 운동';
}
