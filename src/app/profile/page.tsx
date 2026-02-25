"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    ChevronLeft, User as UserIcon, LogOut, Settings, Award,
    History, Calendar, ShieldCheck, Loader2, BarChart2, Layers,
} from "lucide-react";
import {
    getProfile, getWorkoutLogs, getActiveSeason, updateProfile,
    getSeasonStatsForUser, SeasonStat,
    getUserTrophyStats, TrophyRawStats,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WorkoutLog, Season } from "@/types/database";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

// ─── 주차 계산 헬퍼 ──────────────────────────────────────────────────────────
function getWeekMonday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=일 1=월 … 6=토
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
}

interface WeekStat {
    num: number;
    start: Date;
    end: Date;
    count: number;
    /** 아직 진행 중인 주차(오늘 포함) */
    isOngoing: boolean;
}

function buildWeeks(season: Season, logs: WorkoutLog[]): WeekStat[] {
    const seasonStart = new Date(season.start_date);
    const seasonEnd = new Date(season.end_date);
    seasonEnd.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const effectiveEnd = seasonEnd < today ? seasonEnd : today;

    const weeks: WeekStat[] = [];
    let cursor = getWeekMonday(seasonStart);
    let num = 1;

    while (cursor <= effectiveEnd) {
        const wEnd = new Date(cursor);
        wEnd.setDate(wEnd.getDate() + 6);
        wEnd.setHours(23, 59, 59, 999);

        const count = logs.filter((l) => {
            const d = new Date(l.workout_date);
            return d >= cursor && d <= wEnd;
        }).length;

        const now = new Date();
        const isOngoing = now >= cursor && now <= wEnd;

        weeks.push({ num, start: new Date(cursor), end: new Date(wEnd), count, isOngoing });
        cursor.setDate(cursor.getDate() + 7);
        num++;
    }

    return weeks;
}

// ─── 주차별 통계 뷰 ──────────────────────────────────────────────────────────
function WeeklyStatsView({ season, logs }: { season: Season; logs: WorkoutLog[] }) {
    const weeks = buildWeeks(season, logs);
    const passed = weeks.filter((w) => !w.isOngoing && w.count >= 2).length;
    const failed = weeks.filter((w) => !w.isOngoing && w.count < 2).length;
    const ongoing = weeks.find((w) => w.isOngoing);

    return (
        <div className="space-y-4">
            {/* 요약 카드 */}
            <div className="bg-white rounded-[28px] shadow-sm p-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    {season.name} 주차별 인증 현황
                </p>
                <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                    <div>
                        <p className="text-2xl font-black text-primary">{weeks.length}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">전체 주차</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-emerald-500">{passed}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">달성</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-red-400">{failed}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">미달</p>
                    </div>
                </div>
                {failed > 0 && (
                    <div className="mt-4 bg-red-50 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                        <span className="text-red-400 text-sm">⚠️</span>
                        <p className="text-xs text-red-500 font-bold">
                            주 2회 인증을 달성하지 못한 주차가 {failed}개 있습니다.
                        </p>
                    </div>
                )}
                {failed === 0 && weeks.length > 0 && (
                    <div className="mt-4 bg-emerald-50 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                        <span className="text-sm">🎉</span>
                        <p className="text-xs text-emerald-600 font-bold">
                            모든 주차 2회 인증을 달성했습니다!
                        </p>
                    </div>
                )}
            </div>

            {/* 주차 목록 */}
            <div className="bg-white rounded-[28px] shadow-sm overflow-hidden">
                {weeks.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-10">데이터가 없습니다.</p>
                )}
                {weeks.map((w, i) => {
                    const isPass = w.count >= 2;
                    const isFail = !w.isOngoing && !isPass;

                    return (
                        <div
                            key={w.num}
                            className={cn(
                                "flex items-center justify-between px-5 py-4",
                                i !== 0 && "border-t border-slate-50",
                                isFail && "bg-red-50/60"
                            )}
                        >
                            {/* 왼쪽: 주차·날짜 */}
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0",
                                    w.isOngoing
                                        ? "bg-amber-400 text-white"
                                        : isPass
                                            ? "bg-emerald-100 text-emerald-600"
                                            : "bg-red-100 text-red-400"
                                )}>
                                    {w.num}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">
                                        {w.num}주차
                                        {w.isOngoing && (
                                            <span className="ml-1.5 text-[9px] bg-amber-400 text-white px-1.5 py-0.5 rounded-full font-black">진행 중</span>
                                        )}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        {format(w.start, "M/d", { locale: ko })} ~ {format(w.end, "M/d", { locale: ko })}
                                    </p>
                                </div>
                            </div>

                            {/* 오른쪽: 횟수·배지 */}
                            <div className="flex items-center gap-3">
                                {/* 막대 그래프 */}
                                <div className="flex items-end gap-0.5 h-6">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <div
                                            key={n}
                                            className={cn(
                                                "w-1.5 rounded-sm",
                                                n <= w.count
                                                    ? isPass
                                                        ? "bg-emerald-400"
                                                        : "bg-red-300"
                                                    : "bg-slate-100"
                                            )}
                                            style={{ height: `${(n / 5) * 24}px` }}
                                        />
                                    ))}
                                </div>
                                <span className={cn(
                                    "text-lg font-black w-6 text-right",
                                    w.isOngoing ? "text-amber-500" : isPass ? "text-emerald-500" : "text-red-400"
                                )}>
                                    {w.count}
                                </span>
                                <span className={cn(
                                    "text-[10px] font-black px-2 py-0.5 rounded-full min-w-[36px] text-center",
                                    w.isOngoing
                                        ? "bg-amber-100 text-amber-600"
                                        : isPass
                                            ? "bg-emerald-100 text-emerald-600"
                                            : "bg-red-100 text-red-500"
                                )}>
                                    {w.isOngoing ? "진행" : isPass ? "달성" : "미달"}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-center text-[11px] text-slate-400">
                * 주 2회 이상 인증 완료 시 달성으로 집계됩니다.
            </p>
        </div>
    );
}

// ─── 마일스톤 계산 ────────────────────────────────────────────────────────────
type MilestoneCategory = '인증 횟수' | '주간' | '월간' | '순위' | 'MVP';

interface MilestoneInfo {
    id: string;
    name: string;
    desc: string;
    icon: string;
    category: MilestoneCategory;
    achieved: boolean;
    progress: number;   // 0~1
    progressText: string;
}

function buildMilestones(stats: TrophyRawStats, seasonStats: SeasonStat[] | null): MilestoneInfo[] {
    const { logs, totalVotesReceived, mvpWinCount } = stats;
    const total = logs.length;

    // ── 주간 집계 ──
    const weekCounts: Record<string, number> = {};
    logs.forEach(l => {
        const key = getWeekMonday(new Date(l.workout_date)).toISOString().slice(0, 10);
        weekCounts[key] = (weekCounts[key] || 0) + 1;
    });
    const weekVals = Object.values(weekCounts);
    const weeksGte2 = weekVals.filter(c => c >= 2).length;
    const weeksGte3 = weekVals.filter(c => c >= 3).length;
    const weeksGte5 = weekVals.filter(c => c >= 5).length;

    // 연속 주간 (주 2회 이상)
    const qualWeeks = Object.entries(weekCounts)
        .filter(([, c]) => c >= 2)
        .map(([d]) => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());
    let maxConsec = qualWeeks.length > 0 ? 1 : 0;
    let curConsec = maxConsec;
    for (let i = 1; i < qualWeeks.length; i++) {
        const diff = Math.round((qualWeeks[i].getTime() - qualWeeks[i - 1].getTime()) / (86400000 * 7));
        if (diff === 1) { curConsec++; maxConsec = Math.max(maxConsec, curConsec); }
        else curConsec = 1;
    }

    // ── 월간 집계 ──
    const monthCounts: Record<string, number> = {};
    logs.forEach(l => {
        const key = l.workout_date.slice(0, 7);
        monthCounts[key] = (monthCounts[key] || 0) + 1;
    });
    const monthVals = Object.values(monthCounts);
    const monthsGte8  = monthVals.filter(c => c >= 8).length;
    const monthsGte12 = monthVals.filter(c => c >= 12).length;
    const monthsGte16 = monthVals.filter(c => c >= 16).length;

    // ── 순위 집계 ──
    const top1   = seasonStats ? seasonStats.filter(s => s.rank === 1).length : 0;
    const top3   = seasonStats ? seasonStats.filter(s => s.rank !== null && s.rank <= 3).length : 0;
    const topHalf = seasonStats
        ? seasonStats.filter(s => s.rank !== null && s.totalParticipants > 1 && s.rank <= Math.ceil(s.totalParticipants / 2)).length
        : 0;

    const p = (cur: number, max: number) => Math.min(1, max > 0 ? cur / max : 0);
    const clamp = (v: number, max: number) => Math.min(v, max);

    return [
        // ── 인증 횟수 ──
        { id: 'l1',   name: '초보 운동가',    desc: '첫 인증 완료',        icon: '🐣', category: '인증 횟수', achieved: total >= 1,   progress: p(total, 1),   progressText: `${clamp(total,1)}/1회` },
        { id: 'l5',   name: '성실한 발걸음',  desc: '누적 인증 5회',       icon: '👣', category: '인증 횟수', achieved: total >= 5,   progress: p(total, 5),   progressText: `${clamp(total,5)}/5회` },
        { id: 'l10',  name: '레전드 루키',    desc: '누적 인증 10회',      icon: '✨', category: '인증 횟수', achieved: total >= 10,  progress: p(total, 10),  progressText: `${clamp(total,10)}/10회` },
        { id: 'l20',  name: '운동 매니아',    desc: '누적 인증 20회',      icon: '🔥', category: '인증 횟수', achieved: total >= 20,  progress: p(total, 20),  progressText: `${clamp(total,20)}/20회` },
        { id: 'l30',  name: '철인 28호',     desc: '누적 인증 30회',      icon: '🤖', category: '인증 횟수', achieved: total >= 30,  progress: p(total, 30),  progressText: `${clamp(total,30)}/30회` },
        { id: 'l50',  name: '진정한 레전드',  desc: '누적 인증 50회',      icon: '👑', category: '인증 횟수', achieved: total >= 50,  progress: p(total, 50),  progressText: `${clamp(total,50)}/50회` },
        { id: 'l100', name: '백전노장',       desc: '누적 인증 100회',     icon: '💎', category: '인증 횟수', achieved: total >= 100, progress: p(total, 100), progressText: `${clamp(total,100)}/100회` },

        // ── 주간 ──
        { id: 'w1',   name: '첫 주간 달성',   desc: '주 2회 이상 인증 1주', icon: '📅', category: '주간', achieved: weeksGte2 >= 1, progress: p(weeksGte2, 1),  progressText: `${clamp(weeksGte2,1)}/1주` },
        { id: 'w4',   name: '한 달 완성',      desc: '주 2회 이상 4주 달성', icon: '💪', category: '주간', achieved: weeksGte2 >= 4, progress: p(weeksGte2, 4),  progressText: `${clamp(weeksGte2,4)}/4주` },
        { id: 'w8',   name: '두 달 완성',      desc: '주 2회 이상 8주 달성', icon: '🏋️', category: '주간', achieved: weeksGte2 >= 8, progress: p(weeksGte2, 8),  progressText: `${clamp(weeksGte2,8)}/8주` },
        { id: 'w3x',  name: '주 3회 클럽',    desc: '주 3회 이상 인증 1회', icon: '⚡', category: '주간', achieved: weeksGte3 >= 1, progress: p(weeksGte3, 1),  progressText: `${clamp(weeksGte3,1)}/1주` },
        { id: 'w5x',  name: '주 5일 개근',    desc: '주 5회 이상 인증 1회', icon: '🌟', category: '주간', achieved: weeksGte5 >= 1, progress: p(weeksGte5, 1),  progressText: `${clamp(weeksGte5,1)}/1주` },
        { id: 'wc4',  name: '4주 연속 달성',   desc: '주 2회 이상 4주 연속', icon: '🔗', category: '주간', achieved: maxConsec >= 4,  progress: p(maxConsec, 4),  progressText: `${clamp(maxConsec,4)}/4주` },
        { id: 'wc8',  name: '8주 연속 달성',   desc: '주 2회 이상 8주 연속', icon: '⛓️', category: '주간', achieved: maxConsec >= 8,  progress: p(maxConsec, 8),  progressText: `${clamp(maxConsec,8)}/8주` },

        // ── 월간 ──
        { id: 'm8',   name: '월간 성실가',    desc: '한 달 8회 이상 인증',  icon: '📆', category: '월간', achieved: monthsGte8  >= 1, progress: p(monthsGte8,1),  progressText: `${clamp(monthsGte8,1)}/1달` },
        { id: 'm12',  name: '월간 열정가',    desc: '한 달 12회 이상 인증', icon: '🌙', category: '월간', achieved: monthsGte12 >= 1, progress: p(monthsGte12,1), progressText: `${clamp(monthsGte12,1)}/1달` },
        { id: 'm12x2',name: '월간 챔피언',    desc: '12회 이상 달성 2달',   icon: '🗓️', category: '월간', achieved: monthsGte12 >= 2, progress: p(monthsGte12,2), progressText: `${clamp(monthsGte12,2)}/2달` },
        { id: 'm16',  name: '월간 레전드',    desc: '한 달 16회 이상 인증', icon: '🔮', category: '월간', achieved: monthsGte16 >= 1, progress: p(monthsGte16,1), progressText: `${clamp(monthsGte16,1)}/1달` },

        // ── 순위 ──
        { id: 'r50', name: '순위권 진입',   desc: '시즌 상위 50% 달성',    icon: '🎯', category: '순위', achieved: topHalf > 0, progress: p(topHalf,1), progressText: topHalf > 0 ? `${topHalf}회` : '미달성' },
        { id: 'r3',  name: 'TOP 3',        desc: '시즌 3위 이내 달성',    icon: '🏅', category: '순위', achieved: top3 > 0,    progress: p(top3,1),   progressText: top3 > 0   ? `${top3}회`   : '미달성' },
        { id: 'r1',  name: '시즌 챔피언',   desc: '시즌 최종 1위 달성',    icon: '🥇', category: '순위', achieved: top1 > 0,    progress: p(top1,1),   progressText: top1 > 0   ? `${top1}회`   : '미달성' },
        { id: 'r1x3',name: '3연패',         desc: '3시즌 연속 1위 달성',   icon: '🏆', category: '순위', achieved: (() => {
            if (!seasonStats || top1 < 3) return false;
            let streak = 0, best = 0;
            for (const s of [...seasonStats].reverse()) {
                if (s.rank === 1) { streak++; best = Math.max(best, streak); }
                else streak = 0;
            }
            return best >= 3;
        })(), progress: p(top1, 3), progressText: `${clamp(top1,3)}/3회` },

        // ── MVP ──
        { id: 'mv1',  name: '주목받는 선수',  desc: 'MVP 투표 1표 이상',      icon: '👍', category: 'MVP', achieved: totalVotesReceived >= 1, progress: p(totalVotesReceived,1), progressText: `${clamp(totalVotesReceived,1)}/1표` },
        { id: 'mv5',  name: '인기 스타',      desc: 'MVP 투표 5표 이상',      icon: '⭐', category: 'MVP', achieved: totalVotesReceived >= 5, progress: p(totalVotesReceived,5), progressText: `${clamp(totalVotesReceived,5)}/5표` },
        { id: 'mv10', name: '팬 부자',        desc: 'MVP 투표 10표 이상',     icon: '💫', category: 'MVP', achieved: totalVotesReceived >= 10, progress: p(totalVotesReceived,10), progressText: `${clamp(totalVotesReceived,10)}/10표` },
        { id: 'mvw',  name: 'MVP 선정',       desc: '시즌 MVP 1위로 선정',    icon: '🌟', category: 'MVP', achieved: mvpWinCount >= 1, progress: p(mvpWinCount,1), progressText: mvpWinCount > 0 ? `${mvpWinCount}회` : '미달성' },
        { id: 'mvw2', name: '레전드 MVP',     desc: '2시즌 이상 MVP 선정',    icon: '🎖️', category: 'MVP', achieved: mvpWinCount >= 2, progress: p(mvpWinCount,2), progressText: `${clamp(mvpWinCount,2)}/2회` },
    ];
}

const MILESTONE_CATEGORIES: { id: MilestoneCategory; label: string; emoji: string }[] = [
    { id: '인증 횟수', label: '인증 횟수', emoji: '🏅' },
    { id: '주간',     label: '주간 달성', emoji: '📅' },
    { id: '월간',     label: '월간 달성', emoji: '📆' },
    { id: '순위',     label: '순위',      emoji: '🏆' },
    { id: 'MVP',      label: 'MVP',       emoji: '⭐' },
];

// ─── 시즌 순위 아이콘 ─────────────────────────────────────────────────────────
function RankIcon({ rank }: { rank: number | null }) {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    if (rank !== null) return (
        <span className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-black text-slate-500">
            {rank}
        </span>
    );
    return <span className="text-2xl opacity-30">—</span>;
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
type View = "main" | "history" | "trophies" | "settings" | "weekly" | "seasons";

export default function ProfilePage() {
    const router = useRouter();
    const { user, isAuthenticated, logout } = useAuthStore();
    const [profile, setProfile] = useState<any>(null);
    const [season, setSeason] = useState<Season | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [view, setView] = useState<View>("main");

    // 시즌별 기록
    const [seasonStats, setSeasonStats] = useState<SeasonStat[] | null>(null);
    const [seasonStatsLoading, setSeasonStatsLoading] = useState(false);

    // 트로피 / 마일스톤
    const [trophyStats, setTrophyStats] = useState<TrophyRawStats | null>(null);
    const [trophyLoading, setTrophyLoading] = useState(false);

    // 계정 설정 폼
    const [displayName, setDisplayName] = useState("");
    const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [nameSaving, setNameSaving] = useState(false);
    const [curPw, setCurPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [pwSaving, setPwSaving] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) { router.push("/login"); return; }
        const fetchData = async () => {
            if (user) {
                const { data: prof } = await getProfile(user.id);
                if (prof) setProfile(prof);
                const { data: s } = await getActiveSeason();
                if (s) {
                    setSeason(s);
                    const { data: logData } = await getWorkoutLogs(s.id);
                    if (logData) setLogs(logData.filter(l => l.user_id === user.id && l.status === "approved"));
                }
            }
            setIsLoading(false);
        };
        fetchData();
    }, [isAuthenticated, router, user]);

    useEffect(() => {
        if (profile) setDisplayName(profile.display_name || profile.username || "");
    }, [profile]);

    const handleNameSave = async () => {
        const trimmed = displayName.trim();
        if (!trimmed) { setNameMsg({ ok: false, text: "이름을 입력해주세요." }); return; }
        setNameSaving(true); setNameMsg(null);
        const { error } = await updateProfile(user!.id, { display_name: trimmed });
        if (error) { setNameMsg({ ok: false, text: "저장에 실패했습니다." }); }
        else { setProfile((p: any) => ({ ...p, display_name: trimmed })); setNameMsg({ ok: true, text: "이름이 변경되었습니다." }); }
        setNameSaving(false);
    };

    const handlePwSave = async () => {
        setPwMsg(null);
        if (!curPw) { setPwMsg({ ok: false, text: "현재 비밀번호를 입력해주세요." }); return; }
        if (curPw !== profile?.password) { setPwMsg({ ok: false, text: "현재 비밀번호가 올바르지 않습니다." }); return; }
        if (!newPw) { setPwMsg({ ok: false, text: "새 비밀번호를 입력해주세요." }); return; }
        if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "새 비밀번호가 일치하지 않습니다." }); return; }
        setPwSaving(true);
        const { error } = await updateProfile(user!.id, { password: newPw });
        if (error) { setPwMsg({ ok: false, text: "저장에 실패했습니다." }); }
        else { setProfile((p: any) => ({ ...p, password: newPw })); setCurPw(""); setNewPw(""); setConfirmPw(""); setPwMsg({ ok: true, text: "비밀번호가 변경되었습니다." }); }
        setPwSaving(false);
    };

    const handleLogout = () => { logout(); router.push("/login"); };

    const goBack = () => {
        if (view !== "main") { setView("main"); setNameMsg(null); setPwMsg(null); }
        else router.back();
    };

    const viewTitle: Record<View, string> = {
        main: "내 정보",
        history: "인증 히스토리",
        trophies: "내 트로피",
        settings: "계정 설정",
        weekly: "주차별 인증 통계",
        seasons: "시즌별 역대 기록",
    };

    const enterSeasonsView = async () => {
        setView("seasons");
        if (seasonStats) return;
        setSeasonStatsLoading(true);
        const { data } = await getSeasonStatsForUser(user!.id);
        if (data) setSeasonStats(data);
        setSeasonStatsLoading(false);
    };

    const enterTrophiesView = async () => {
        setView("trophies");
        if (trophyStats !== null && seasonStats !== null) return;
        setTrophyLoading(true);
        await Promise.all([
            ...(trophyStats === null
                ? [getUserTrophyStats(user!.id).then(r => { if (r.data) setTrophyStats(r.data); })]
                : []),
            ...(seasonStats === null
                ? [getSeasonStatsForUser(user!.id).then(r => { if (r.data) setSeasonStats(r.data); })]
                : []),
        ]);
        setTrophyLoading(false);
    };

    const getTierColor = (tier: string) => {
        switch (tier?.toLowerCase()) {
            case "diamond": return "bg-blue-100 text-blue-700";
            case "platinum": return "bg-cyan-100 text-cyan-700";
            case "gold": return "bg-amber-100 text-amber-700";
            case "silver": return "bg-slate-200 text-slate-700";
            default: return "bg-orange-100 text-orange-700";
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={goBack}>
                    <ChevronLeft size={24} />
                </Button>
                <h1 className="text-xl font-bold text-primary">{viewTitle[view]}</h1>
            </header>

            <main className="p-6 space-y-6">
                {/* ── 메인 ── */}
                {view === "main" && (
                    <>
                        <Card className="border-none shadow-sm bg-white overflow-hidden rounded-[32px]">
                            <CardHeader className="bg-primary p-8 flex flex-col items-center">
                                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white mb-4 border-4 border-white/10">
                                    <UserIcon size={40} />
                                </div>
                                <h2 className="text-xl font-black text-white">{profile?.username || user?.username} 님</h2>
                                <div className="flex gap-2 mt-2">
                                    <span className={cn("text-xs px-3 py-1 rounded-full font-black italic", getTierColor(profile?.tier || "Bronze"))}>
                                        {profile?.tier || "Bronze"} Tier
                                    </span>
                                    {profile?.role === "admin" && (
                                        <span className="text-xs bg-slate-800 text-white px-3 py-1 rounded-full font-bold flex items-center gap-1">
                                            <ShieldCheck size={10} /> 관리자
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="grid grid-cols-2 divide-x divide-slate-50 text-center">
                                    <div className="py-6">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">총 인증 횟수</p>
                                        <p className="text-lg font-black text-primary italic">{logs.length}회</p>
                                    </div>
                                    <div className="py-6">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">참여 상태</p>
                                        <p className="text-lg font-black text-accent italic">활동 중</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <section className="space-y-4">
                            <div className="bg-white rounded-[32px] shadow-sm overflow-hidden p-2">
                                {[
                                    { id: "history" as View, label: "운동 인증 히스토리", icon: History, bg: "bg-slate-100", iconColor: "text-slate-500", hoverBg: "group-hover:bg-primary", hoverIcon: "group-hover:text-white", onClick: undefined },
                                    { id: "weekly" as View, label: "주차별 인증 통계", icon: BarChart2, bg: "bg-blue-50", iconColor: "text-blue-400", hoverBg: "group-hover:bg-blue-500", hoverIcon: "group-hover:text-white", onClick: undefined },
                                    { id: "seasons" as View, label: "시즌별 역대 기록", icon: Layers, bg: "bg-violet-50", iconColor: "text-violet-400", hoverBg: "group-hover:bg-violet-500", hoverIcon: "group-hover:text-white", onClick: enterSeasonsView },
                                    { id: "trophies" as View, label: "내 트로피/배지", icon: Award, bg: "bg-amber-50", iconColor: "text-amber-500", hoverBg: "group-hover:bg-amber-500", hoverIcon: "group-hover:text-white", onClick: enterTrophiesView },
                                    { id: "settings" as View, label: "계정 설정", icon: Settings, bg: "bg-slate-100", iconColor: "text-slate-500", hoverBg: "group-hover:bg-primary", hoverIcon: "group-hover:text-white", onClick: undefined },
                                ].map(({ id, label, icon: Icon, bg, iconColor, hoverBg, hoverIcon, onClick }) => (
                                    <button
                                        key={id}
                                        onClick={() => onClick ? onClick() : setView(id)}
                                        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors rounded-2xl group"
                                    >
                                        <div className="flex items-center gap-4 text-primary">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", bg, iconColor, hoverBg, hoverIcon)}>
                                                <Icon size={20} />
                                            </div>
                                            <span className="text-md font-bold">{label}</span>
                                        </div>
                                        <ChevronLeft size={18} className="rotate-180 text-slate-300" />
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-4 p-6 text-red-500 bg-red-50/50 hover:bg-red-50 transition-colors rounded-[32px] font-black italic shadow-sm shadow-red-100/50"
                            >
                                <LogOut size={20} />
                                <span>LOGOUT FROM SYSTEM</span>
                            </button>
                        </section>
                    </>
                )}

                {/* ── 인증 히스토리 ── */}
                {view === "history" && (
                    <div className="space-y-4">
                        {logs.length > 0 ? (
                            [...logs]
                                .sort((a, b) => new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime())
                                .map((log) => (
                                    <Card key={log.id} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden border-l-4 border-accent">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-primary">
                                                    <Calendar size={24} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-primary text-sm">
                                                        {log.workout_type === "gym" ? "💪 운동완료" :
                                                            log.workout_type === "running" ? "🏃 러닝" :
                                                                log.workout_type === "walking" ? "🚶 걷기" : "🔥 스포츠"}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 font-bold">
                                                        {format(new Date(log.workout_date), "yyyy.MM.dd (EEE)", { locale: ko })}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-accent">운동완료</span>
                                        </CardContent>
                                    </Card>
                                ))
                        ) : (
                            <div className="py-20 text-center">
                                <p className="text-slate-400 font-bold">아직 인증 내역이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 주차별 통계 ── */}
                {view === "weekly" && (
                    season
                        ? <WeeklyStatsView season={season} logs={logs} />
                        : <p className="text-center text-slate-400 text-sm py-20">활성 시즌이 없습니다.</p>
                )}

                {/* ── 시즌별 역대 기록 ── */}
                {view === "seasons" && (
                    <div className="space-y-3">
                        {seasonStatsLoading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 size={28} className="animate-spin text-primary" />
                            </div>
                        ) : !seasonStats || seasonStats.length === 0 ? (
                            <div className="py-20 text-center">
                                <p className="text-slate-400 font-bold">시즌 기록이 없습니다.</p>
                            </div>
                        ) : (
                            seasonStats.map(({ season: s, rank, totalParticipants, logCount, totalScore, workoutPoints, mvpPoints }) => (
                                <div key={s.id} className={cn(
                                    "bg-white rounded-[28px] shadow-sm overflow-hidden",
                                    s.is_active && "ring-2 ring-amber-400 ring-offset-1"
                                )}>
                                    {/* 시즌 헤더 */}
                                    <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-50">
                                        <div>
                                            <p className="font-black text-primary text-sm">{s.name}</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {s.start_date} ~ {s.end_date}
                                            </p>
                                        </div>
                                        {s.is_active ? (
                                            <span className="text-[10px] bg-amber-400 text-white px-2 py-1 rounded-full font-black">활성 시즌</span>
                                        ) : (
                                            <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-1 rounded-full font-bold">종료</span>
                                        )}
                                    </div>

                                    {/* 기록 */}
                                    {rank === null ? (
                                        <div className="px-5 py-4 text-sm text-slate-400 font-bold">
                                            미참여 (인증 기록 없음)
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 divide-x divide-slate-50 text-center py-1">
                                            <div className="py-4 flex flex-col items-center gap-1">
                                                <RankIcon rank={rank} />
                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                    {rank}위<span className="text-slate-300">/{totalParticipants}명</span>
                                                </p>
                                            </div>
                                            <div className="py-4">
                                                <p className="text-xl font-black text-primary">{logCount}</p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">인증 횟수</p>
                                            </div>
                                            <div className="py-4">
                                                <p className="text-sm font-black text-slate-600">{Number(workoutPoints).toFixed(1)}</p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">인증점수</p>
                                            </div>
                                            <div className="py-4">
                                                <p className="text-sm font-black text-amber-500">{Number(totalScore).toFixed(1)}</p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">총점</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── 계정 설정 ── */}
                {view === "settings" && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-[32px] shadow-sm p-6 space-y-3">
                            <p className="text-sm font-black text-primary uppercase tracking-wider">이름 변경</p>
                            <Input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setNameMsg(null); }} placeholder="표시 이름" className="text-sm" />
                            {nameMsg && <p className={cn("text-xs font-medium", nameMsg.ok ? "text-green-500" : "text-red-500")}>{nameMsg.text}</p>}
                            <Button onClick={handleNameSave} disabled={nameSaving} className="w-full bg-primary hover:bg-primary/90 text-white font-bold">
                                {nameSaving && <Loader2 size={16} className="animate-spin mr-2" />}저장
                            </Button>
                        </div>
                        <div className="bg-white rounded-[32px] shadow-sm p-6 space-y-3">
                            <p className="text-sm font-black text-primary uppercase tracking-wider">비밀번호 변경</p>
                            <Input type="password" value={curPw} onChange={(e) => { setCurPw(e.target.value); setPwMsg(null); }} placeholder="현재 비밀번호" className="text-sm" />
                            <Input type="password" value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwMsg(null); }} placeholder="새 비밀번호" className="text-sm" />
                            <Input type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwMsg(null); }} placeholder="새 비밀번호 확인" className="text-sm" />
                            {pwMsg && <p className={cn("text-xs font-medium", pwMsg.ok ? "text-green-500" : "text-red-500")}>{pwMsg.text}</p>}
                            <Button onClick={handlePwSave} disabled={pwSaving} className="w-full bg-primary hover:bg-primary/90 text-white font-bold">
                                {pwSaving && <Loader2 size={16} className="animate-spin mr-2" />}변경
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── 트로피 / 마일스톤 ── */}
                {view === "trophies" && (
                    trophyLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-primary" />
                        </div>
                    ) : trophyStats ? (() => {
                        const milestones = buildMilestones(trophyStats, seasonStats);
                        const achievedCount = milestones.filter(m => m.achieved).length;
                        return (
                            <div className="space-y-5">
                                {/* 달성 요약 */}
                                <div className="bg-white rounded-[28px] shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-black text-primary">마일스톤 달성 현황</p>
                                        <p className="text-sm font-black text-amber-500">{achievedCount} / {milestones.length}</p>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                            style={{ width: `${(achievedCount / milestones.length) * 100}%` }} />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 text-right">
                                        {Math.round((achievedCount / milestones.length) * 100)}% 달성
                                    </p>
                                </div>

                                {/* 카테고리별 목록 */}
                                {MILESTONE_CATEGORIES.map(cat => {
                                    const items = milestones.filter(m => m.category === cat.id);
                                    const catDone = items.filter(m => m.achieved).length;
                                    return (
                                        <div key={cat.id}>
                                            <div className="flex items-center justify-between mb-2.5 px-1">
                                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                                    {cat.emoji} {cat.label}
                                                </p>
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                    catDone === items.length ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                                                )}>
                                                    {catDone}/{items.length}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {items.map(m => (
                                                    <div key={m.id} className={cn(
                                                        "bg-white rounded-3xl shadow-sm p-4 flex flex-col gap-2 relative overflow-hidden transition-all",
                                                        !m.achieved && "opacity-45 grayscale"
                                                    )}>
                                                        {/* 달성 배지 */}
                                                        {m.achieved && (
                                                            <div className="absolute top-3 right-3">
                                                                <span className="text-[9px] bg-amber-400 text-white px-1.5 py-0.5 rounded-full font-black">달성</span>
                                                            </div>
                                                        )}
                                                        <span className="text-3xl leading-none">{m.icon}</span>
                                                        <p className="text-xs font-black text-primary leading-snug">{m.name}</p>
                                                        <p className="text-[10px] text-slate-400 leading-snug">{m.desc}</p>
                                                        {/* 진행 표시 */}
                                                        {!m.achieved ? (
                                                            <div className="mt-auto pt-1">
                                                                {m.progress > 0 && (
                                                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-1">
                                                                        <div className="h-full bg-amber-300 rounded-full"
                                                                            style={{ width: `${m.progress * 100}%` }} />
                                                                    </div>
                                                                )}
                                                                <p className="text-[9px] text-slate-400">{m.progressText}</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[9px] text-amber-600 font-bold mt-auto pt-1">{m.progressText}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })() : (
                        <p className="text-center text-slate-400 text-sm py-20">데이터를 불러올 수 없습니다.</p>
                    )
                )}
            </main>

            <BottomNav />
        </div>
    );
}
