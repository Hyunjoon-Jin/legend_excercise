"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trophy, Medal, Star, Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getRankings, getAllSeasons } from "@/lib/data";
import { Season } from "@/types/database";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { BottomNav } from "@/components/layout/bottom-nav";

interface MemberResult {
    userId: string;
    name: string;
    tier: string;
    rank: number;
    logCount: number;
    workoutPoints: number;
    mvpPoints: number;
    totalScore: number;
    voteCount: number;
    weeklyStats: { week: string; count: number; passed: boolean }[];
    passedWeeks: number;
    failedWeeks: number;
}

function getWeekKey(dateStr: string) {
    const d = new Date(dateStr);
    const mon = startOfWeek(d, { weekStartsOn: 1 });
    return format(mon, 'yyyy-MM-dd');
}

function getRankIcon(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `${rank}위`;
}

export default function SeasonResultPage({ params }: { params: Promise<{ seasonId: string }> }) {
    const { seasonId } = use(params);
    const router = useRouter();
    const { isAuthenticated, user } = useAuthStore();

    const [season, setSeason] = useState<Season | null>(null);
    const [results, setResults] = useState<MemberResult[]>([]);
    const [mvpName, setMvpName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);

            // 1. Load season info
            const { data: allSeasons } = await getAllSeasons();
            const foundSeason = allSeasons?.find((s: Season) => s.id === seasonId);
            if (foundSeason) setSeason(foundSeason);

            // 2. Load rankings
            const { data: rankings } = await getRankings(seasonId);
            if (!rankings || rankings.length === 0) {
                setIsLoading(false);
                return;
            }

            // 3. Load all approved logs for this season
            const { data: logs } = await supabase
                .from('workout_logs')
                .select('user_id, workout_date')
                .eq('season_id', seasonId)
                .eq('status', 'approved');

            // 4. Build week pass/fail per member
            const logsByUser: Record<string, string[]> = {};
            (logs || []).forEach((l: any) => {
                if (!logsByUser[l.user_id]) logsByUser[l.user_id] = [];
                logsByUser[l.user_id].push(l.workout_date);
            });

            const memberResults: MemberResult[] = rankings.map((r: any, idx: number) => {
                const userLogs = logsByUser[r.userId] || [];
                const weekCounts: Record<string, number> = {};
                userLogs.forEach(d => {
                    const wk = getWeekKey(d);
                    weekCounts[wk] = (weekCounts[wk] || 0) + 1;
                });
                const weeklyStats = Object.entries(weekCounts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([week, count]) => ({ week, count, passed: count >= 2 }));
                const passedWeeks = weeklyStats.filter(w => w.passed).length;
                const failedWeeks = weeklyStats.filter(w => !w.passed).length;

                return {
                    userId: r.userId,
                    name: r.name,
                    tier: r.tier,
                    rank: idx + 1,
                    logCount: r.logCount,
                    workoutPoints: r.workoutPoints,
                    mvpPoints: r.mvpPoints,
                    totalScore: r.totalScore,
                    voteCount: r.voteCount,
                    weeklyStats,
                    passedWeeks,
                    failedWeeks,
                };
            });

            setResults(memberResults);

            // 5. Determine MVP (most votes)
            if (memberResults.length > 0) {
                const topVoted = [...memberResults].sort((a, b) => b.voteCount - a.voteCount)[0];
                if (topVoted.voteCount > 0) setMvpName(topVoted.name);
            }

            setIsLoading(false);
        };

        fetchData();
    }, [isAuthenticated, router, seasonId]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // 아직 종료되지 않은 시즌이면 접근 차단 (관리자 제외)
    if (season && season.is_active && !season.closed_at && user?.role !== 'admin') {
        return (
            <div className="flex flex-col min-h-screen bg-slate-50 items-center justify-center gap-4 px-8 text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Trophy size={32} className="text-indigo-400" />
                </div>
                <h2 className="text-lg font-black text-primary">시즌 진행 중</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                    시즌 결과는 투표 종료 후 공개됩니다.<br />
                    조금만 기다려 주세요!
                </p>
                <Button onClick={() => router.back()} variant="outline" className="rounded-full">
                    돌아가기
                </Button>
            </div>
        );
    }

    const myResult = results.find(r => r.userId === user?.id);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                    <ChevronLeft size={24} />
                </Button>
                <div className="flex-1">
                    <h1 className="text-base font-black text-primary">시즌 결과 브리핑</h1>
                    {season && <p className="text-[11px] text-slate-400 font-bold">{season.name}</p>}
                </div>
                <div className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded-full">종료</div>
            </header>

            <main className="p-5 space-y-6">
                {/* Hero Banner */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
                    <div className="relative z-10 space-y-3">
                        <div className="flex items-center gap-1.5">
                            <Star size={12} className="text-accent fill-accent" />
                            <span className="text-[10px] font-black italic tracking-widest text-white/60">FINAL RESULT</span>
                        </div>
                        <h2 className="text-2xl font-black italic leading-tight">
                            {season?.name || "시즌"}<br />
                            <span className="text-accent">최종 결과</span>
                        </h2>
                        {season?.closed_at && (
                            <p className="text-[11px] text-white/50 font-bold">
                                종료일: {format(new Date(season.closed_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                            </p>
                        )}
                        <div className="flex gap-3 mt-2">
                            <div className="bg-white/10 rounded-2xl px-4 py-2 text-center">
                                <p className="text-lg font-black text-accent">{results.length}</p>
                                <p className="text-[9px] text-white/50 font-bold">참가자</p>
                            </div>
                            {mvpName && (
                                <div className="bg-amber-500/20 border border-amber-400/30 rounded-2xl px-4 py-2 text-center">
                                    <p className="text-sm font-black text-amber-300">🏆 {mvpName}</p>
                                    <p className="text-[9px] text-white/50 font-bold">이번 시즌 MVP</p>
                                </div>
                            )}
                        </div>

                        {/* My Result Section */}
                        {myResult && (
                            <div className="mt-4 border-t border-white/10 pt-4">
                                <p className="text-[10px] font-black text-white/40 tracking-widest mb-2">나의 시즌 결과</p>
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 rounded-2xl px-3 py-2 text-center min-w-[48px]">
                                        <p className="text-lg font-black text-white">{myResult.rank}위</p>
                                        <p className="text-[9px] text-white/40 font-bold">순위</p>
                                    </div>
                                    <div className="bg-white/10 rounded-2xl px-3 py-2 text-center min-w-[48px]">
                                        <p className="text-lg font-black text-accent">{myResult.totalScore}</p>
                                        <p className="text-[9px] text-white/40 font-bold">총점</p>
                                    </div>
                                    <div className="bg-white/10 rounded-2xl px-3 py-2 text-center min-w-[48px]">
                                        <p className="text-lg font-black text-white">{myResult.logCount}</p>
                                        <p className="text-[9px] text-white/40 font-bold">인증횟수</p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            <CheckCircle2 size={10} className="text-emerald-400" />
                                            <span className="text-[10px] font-black text-emerald-400">{myResult.passedWeeks}주 성공</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <XCircle size={10} className="text-red-400" />
                                            <span className="text-[10px] font-black text-red-400">{myResult.failedWeeks}주 미달</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <Trophy size={120} className="absolute -right-6 -bottom-6 text-white/5" />
                </div>

                {/* Top 3 Podium */}
                {results.length >= 3 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-black text-primary flex items-center gap-2">
                            <Medal size={16} className="text-accent" />
                            TOP 3 수상자
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            {[results[1], results[0], results[2]].map((r, podiumIdx) => {
                                if (!r) return <div key={podiumIdx} />;
                                const height = podiumIdx === 1 ? "h-24" : "h-16";
                                const colors = podiumIdx === 1
                                    ? "bg-amber-400 text-white"
                                    : podiumIdx === 0
                                    ? "bg-slate-300 text-slate-700"
                                    : "bg-orange-300 text-white";
                                return (
                                    <div key={r.userId} className="flex flex-col items-center gap-1">
                                        <div className="text-lg">{getRankIcon(r.rank)}</div>
                                        <p className="text-[10px] font-black text-primary text-center leading-tight">{r.name}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">{r.totalScore}점</p>
                                        <div className={cn("w-full rounded-t-xl flex items-end justify-center pb-2 font-black text-xs", colors, height)}>
                                            {r.rank}위
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Full Rankings */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-primary flex items-center gap-2">
                        <Users size={16} className="text-slate-400" />
                        전체 최종 순위표
                    </h3>
                    <div className="space-y-2">
                        {results.map((r) => (
                            <div key={r.userId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                <div
                                    className="p-4 flex items-center gap-3 cursor-pointer"
                                    onClick={() => setExpandedUserId(expandedUserId === r.userId ? null : r.userId)}
                                >
                                    {/* Rank Badge */}
                                    <div className={cn(
                                        "w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0",
                                        r.rank === 1 ? "bg-amber-100 text-amber-600" :
                                        r.rank === 2 ? "bg-slate-100 text-slate-500" :
                                        r.rank === 3 ? "bg-orange-50 text-orange-500" :
                                        "bg-slate-50 text-slate-300"
                                    )}>
                                        {r.rank <= 3 ? getRankIcon(r.rank).replace('위', '') : r.rank}
                                    </div>

                                    {/* Name & Tier */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="font-bold text-sm text-primary truncate">{r.name}</p>
                                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded font-bold shrink-0">{r.tier}</span>
                                            {r.voteCount > 0 && r.rank === 1 && (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-black shrink-0">MVP</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-[10px] text-slate-400">인증 {r.logCount}회</span>
                                            <span className="text-[10px] text-slate-400">득표 {r.voteCount}표</span>
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-primary">{r.totalScore}점</p>
                                        <p className="text-[9px] text-slate-300 mt-0.5">탭하여 상세보기</p>
                                    </div>
                                </div>

                                {/* Expanded Detail */}
                                {expandedUserId === r.userId && (
                                    <div className="border-t border-slate-50 px-4 pb-4 pt-3 bg-slate-50/50 space-y-4">
                                        {/* Score Breakdown */}
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 mb-2">점수 내역</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center shadow-sm">
                                                    <p className="text-sm font-black text-primary">{r.totalScore}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">총점</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center shadow-sm">
                                                    <p className="text-sm font-black text-blue-600">{r.workoutPoints}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">운동(70%)</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-xl border border-slate-100 text-center shadow-sm">
                                                    <p className="text-sm font-black text-amber-600">{r.mvpPoints}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">MVP(30%)</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Weekly Pass/Fail */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-black text-slate-400">주차별 인증 현황</p>
                                                <div className="flex gap-2">
                                                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                                                        <CheckCircle2 size={10} /> {r.passedWeeks}주 성공
                                                    </span>
                                                    <span className="flex items-center gap-1 text-[9px] font-bold text-red-400">
                                                        <XCircle size={10} /> {r.failedWeeks}주 미달
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {r.weeklyStats.map((wk, i) => {
                                                    const weekDate = new Date(wk.week);
                                                    const label = format(weekDate, 'M/d', { locale: ko });
                                                    return (
                                                        <div
                                                            key={wk.week}
                                                            className={cn(
                                                                "flex flex-col items-center px-2 py-1.5 rounded-xl text-[9px] font-black min-w-[40px]",
                                                                wk.passed
                                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                                                    : "bg-red-50 text-red-500 border border-red-100"
                                                            )}
                                                        >
                                                            <span>{label}주</span>
                                                            <span className="text-[10px] font-black mt-0.5">{wk.count}회</span>
                                                        </div>
                                                    );
                                                })}
                                                {r.weeklyStats.length === 0 && (
                                                    <p className="text-[10px] text-slate-300">인증 기록 없음</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {results.length === 0 && (
                    <div className="h-40 flex flex-col items-center justify-center text-center space-y-2">
                        <p className="text-sm font-bold text-slate-400">이 시즌의 데이터가 없습니다.</p>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
