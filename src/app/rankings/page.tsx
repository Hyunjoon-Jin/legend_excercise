"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    ChevronLeft, Trophy, Loader2, TrendingUp,
    CalendarDays, ListOrdered, Lock,
} from "lucide-react";
import { getRankings, getAllSeasons, getWorkoutLogs } from "@/lib/data";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Season, WorkoutLog } from "@/types/database";

// ─── 상수 ────────────────────────────────────────────────────────────────────
const LINE_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ec4899", "#8b5cf6", "#f97316"];
type Tab = "total" | "weekly" | "trend";

// ─── 주 시작(월요일) ──────────────────────────────────────────────────────────
function getWeekMonday(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
}

// ─── 이번 주 랭킹 ─────────────────────────────────────────────────────────────
interface WeeklyEntry { userId: string; name: string; count: number }

function computeWeeklyRankings(logs: WorkoutLog[]): WeeklyEntry[] {
    const monday = getWeekMonday(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const byUser: Record<string, WeeklyEntry> = {};
    logs.forEach((l) => {
        const d = new Date(l.workout_date);
        if (d < monday || d > sunday) return;
        if (!byUser[l.user_id]) {
            const p = l.profiles as any;
            byUser[l.user_id] = { userId: l.user_id, name: p?.display_name || p?.username || "?", count: 0 };
        }
        byUser[l.user_id].count++;
    });
    return Object.values(byUser).sort((a, b) => b.count - a.count);
}

// ─── 추이 데이터 ──────────────────────────────────────────────────────────────
interface TrendSeries { userId: string; name: string; counts: number[]; color: string }
interface TrendData { dates: string[]; series: TrendSeries[]; maxCount: number }

function computeTrend(season: Season, logs: WorkoutLog[]): TrendData {
    const start = new Date(season.start_date);
    const rawEnd = new Date(season.end_date);
    rawEnd.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const end = rawEnd < today ? rawEnd : today;

    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
    }
    if (dates.length === 0 || logs.length === 0) return { dates: [], series: [], maxCount: 0 };

    const userNames: Record<string, string> = {};
    logs.forEach((l) => {
        const p = l.profiles as any;
        userNames[l.user_id] = p?.display_name || p?.username || "?";
    });

    const dailyCounts: Record<string, Record<string, number>> = {};
    logs.forEach((l) => {
        if (!dailyCounts[l.workout_date]) dailyCounts[l.workout_date] = {};
        dailyCounts[l.workout_date][l.user_id] = (dailyCounts[l.workout_date][l.user_id] || 0) + 1;
    });

    const allUserIds = Object.keys(userNames);
    const cumulative: Record<string, number> = {};
    allUserIds.forEach((uid) => { cumulative[uid] = 0; });

    const countsByUser: Record<string, number[]> = {};
    allUserIds.forEach((uid) => { countsByUser[uid] = []; });

    dates.forEach((dateStr) => {
        const day = dailyCounts[dateStr] || {};
        allUserIds.forEach((uid) => {
            cumulative[uid] += day[uid] || 0;
            countsByUser[uid].push(cumulative[uid]);
        });
    });

    const top6 = allUserIds
        .map((uid) => ({ uid, final: cumulative[uid] }))
        .sort((a, b) => b.final - a.final)
        .slice(0, 6);

    const maxCount = Math.max(1, ...top6.map((u) => u.final));
    const series: TrendSeries[] = top6.map((u, idx) => ({
        userId: u.uid,
        name: userNames[u.uid],
        counts: countsByUser[u.uid],
        color: LINE_COLORS[idx],
    }));

    return { dates, series, maxCount };
}

// ─── SVG 차트 ─────────────────────────────────────────────────────────────────
const SVG_W = 400, SVG_H = 210;
const PAD = { left: 30, right: 72, top: 16, bottom: 30 };
const CW = SVG_W - PAD.left - PAD.right;
const CH = SVG_H - PAD.top - PAD.bottom;

function TrendChart({ data, myUsername }: { data: TrendData; myUsername?: string }) {
    const { dates, series, maxCount } = data;
    if (dates.length === 0 || series.length === 0)
        return <p className="text-center text-slate-400 text-sm py-12">데이터가 없습니다.</p>;

    const n = dates.length;
    const xOf = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * CW : CW / 2);
    const yOf = (count: number) => PAD.top + (1 - count / maxCount) * CH;

    const xStep = Math.max(1, Math.ceil(n / 5));
    const xLabels: { i: number; label: string }[] = [];
    for (let i = 0; i < n; i += xStep)
        xLabels.push({ i, label: dates[i].slice(5).replace("-", "/") });
    if (xLabels[xLabels.length - 1]?.i !== n - 1)
        xLabels.push({ i: n - 1, label: dates[n - 1].slice(5).replace("-", "/") });

    const yTicks = Array.from(new Set([0, Math.round(maxCount / 2), maxCount]));

    const labelSlots = series.map((s) => ({
        color: s.color, name: s.name,
        isMine: s.name === myUsername,
        rawY: yOf(s.counts[s.counts.length - 1] ?? 0),
    }));
    labelSlots.sort((a, b) => a.rawY - b.rawY);
    const MIN_GAP = 12;
    for (let i = 1; i < labelSlots.length; i++) {
        if (labelSlots[i].rawY - labelSlots[i - 1].rawY < MIN_GAP)
            labelSlots[i].rawY = labelSlots[i - 1].rawY + MIN_GAP;
    }

    return (
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
            {yTicks.map((v) => (
                <line key={v} x1={PAD.left} y1={yOf(v)} x2={PAD.left + CW} y2={yOf(v)}
                    stroke="#f1f5f9" strokeWidth={1} />
            ))}
            {yTicks.map((v) => (
                <text key={v} x={PAD.left - 5} y={yOf(v) + 3.5}
                    textAnchor="end" fontSize={8.5} fill="#94a3b8">{v}회</text>
            ))}
            {xLabels.map(({ i, label }) => (
                <text key={i} x={xOf(i)} y={SVG_H - 6}
                    textAnchor="middle" fontSize={8} fill="#94a3b8">{label}</text>
            ))}
            {series.map((s) => (
                <polyline key={s.userId}
                    points={s.counts.map((c, i) => `${xOf(i)},${yOf(c)}`).join(" ")}
                    fill="none" stroke={s.color}
                    strokeWidth={s.name === myUsername ? 2.5 : 1.8}
                    strokeLinejoin="round" strokeLinecap="round"
                    opacity={s.name === myUsername ? 1 : 0.75}
                />
            ))}
            {series.map((s) => {
                const last = s.counts[s.counts.length - 1] ?? 0;
                return <circle key={s.userId} cx={xOf(n - 1)} cy={yOf(last)}
                    r={s.name === myUsername ? 3.5 : 2.5} fill={s.color} />;
            })}
            {labelSlots.map((slot) => (
                <text key={slot.name} x={PAD.left + CW + 5} y={slot.rawY + 3.5}
                    fontSize={9} fill={slot.color} fontWeight={slot.isMine ? "900" : "600"}>
                    {slot.name.length > 5 ? slot.name.slice(0, 5) + "…" : slot.name}
                </text>
            ))}
        </svg>
    );
}

// ─── 순위 배지 색 ──────────────────────────────────────────────────────────────
function rankBadgeClass(index: number) {
    if (index === 0) return "bg-amber-400 text-white";
    if (index === 1) return "bg-slate-300 text-white";
    if (index === 2) return "bg-amber-600/60 text-white";
    return "bg-slate-100 text-slate-400";
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function RankingsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    const [allSeasons, setAllSeasons] = useState<Season[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
    const [rankings, setRankings] = useState<any[]>([]);
    const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSeasonLoading, setIsSeasonLoading] = useState(false);
    const [tab, setTab] = useState<Tab>("total");

    // 시즌 데이터 로드
    const loadSeasonData = async (seasonId: string) => {
        const [{ data: ranks }, { data: logs }] = await Promise.all([
            getRankings(seasonId),
            getWorkoutLogs(seasonId),
        ]);
        if (ranks) setRankings(ranks);
        setAllLogs((logs?.filter((l) => l.status === "approved") ?? []) as WorkoutLog[]);
    };

    useEffect(() => {
        if (!isAuthenticated) { router.push("/login"); return; }
        let cancelled = false;
        (async () => {
            const { data: seasons } = await getAllSeasons();
            if (!seasons || cancelled) { setIsLoading(false); return; }
            setAllSeasons(seasons);
            const active = seasons.find((s) => s.is_active) ?? seasons[0];
            if (!active) { setIsLoading(false); return; }
            setSelectedSeason(active);
            await loadSeasonData(active.id);
            if (!cancelled) setIsLoading(false);
        })();
        return () => { cancelled = true; };
    }, [isAuthenticated, router]);

    const handleSeasonChange = async (season: Season) => {
        if (season.id === selectedSeason?.id) return;
        setSelectedSeason(season);
        setTab("total");
        setIsSeasonLoading(true);
        await loadSeasonData(season.id);
        setIsSeasonLoading(false);
    };

    const isAdmin = user?.role === 'admin';
    // 투표 진행 중이면 관리자 포함 전원 투표 점수 비공개
    const votingActive = !!(selectedSeason?.voting_open);

    // 투표 진행 중에는 workoutPoints 기준으로 재정렬
    const displayRankings = useMemo(() => {
        if (!votingActive) return rankings;
        return [...rankings].sort((a, b) => b.workoutPoints - a.workoutPoints);
    }, [rankings, votingActive]);

    const weeklyRankings = useMemo(() => computeWeeklyRankings(allLogs), [allLogs]);
    const trendData = useMemo(
        () => selectedSeason ? computeTrend(selectedSeason, allLogs) : { dates: [], series: [], maxCount: 0 },
        [selectedSeason, allLogs]
    );

    const monday = getWeekMonday(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekLabel = `${monday.getMonth() + 1}/${monday.getDate()} ~ ${sunday.getMonth() + 1}/${sunday.getDate()}`;

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // 활성 시즌일 때만 이번주 탭 노출
    const showWeeklyTab = selectedSeason?.is_active ?? false;
    const tabs = [
        { id: "total" as Tab, label: "전체", icon: ListOrdered },
        ...(showWeeklyTab ? [{ id: "weekly" as Tab, label: "이번 주", icon: CalendarDays }] : []),
        { id: "trend" as Tab, label: "순위 추이", icon: TrendingUp },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
            {/* ── 헤더 ── */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100">
                <div className="p-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft size={24} />
                    </Button>
                    <h1 className="text-xl font-bold text-primary">랭킹</h1>
                </div>

                {/* 시즌 선택 스크롤 */}
                {allSeasons.length > 1 && (
                    <div
                        className="flex gap-2 px-4 pb-3 overflow-x-auto"
                        style={{ scrollbarWidth: "none" }}
                    >
                        {allSeasons.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => handleSeasonChange(s)}
                                className={cn(
                                    "flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                                    selectedSeason?.id === s.id
                                        ? "bg-primary text-white"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                )}
                            >
                                {s.name}
                                {s.is_active && (
                                    <span className="bg-amber-400 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
                                        활성
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* 탭 바 */}
                <div className="flex px-4 gap-1">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors border-b-2",
                                tab === id
                                    ? "border-amber-400 text-amber-500"
                                    : "border-transparent text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            </header>

            {/* ── 시즌 정보 배너 (비활성 시즌) ── */}
            {selectedSeason && !selectedSeason.is_active && (
                <div className="mx-4 mt-4 bg-slate-100 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-600">{selectedSeason.name} — 종료된 시즌</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {selectedSeason.start_date} ~ {selectedSeason.end_date}
                        </p>
                    </div>
                    <span className="text-[10px] bg-slate-300 text-white px-2 py-1 rounded-full font-black">종료</span>
                </div>
            )}

            <main className="p-4 space-y-3 mt-2">
                {isSeasonLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        {/* ── 전체 순위 ── */}
                        {tab === "total" && (
                            <>
                                {/* 투표 집계 중 배너 */}
                                {votingActive && (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 flex items-center gap-3 mb-1">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                            <Lock size={14} className="text-indigo-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-indigo-700">🗳️ MVP 투표 집계 중</p>
                                            <p className="text-[10px] text-indigo-400 font-bold mt-0.5">투표 점수는 시즌 종료 후 공개됩니다. 현재는 운동 인증 기준 순위입니다.</p>
                                        </div>
                                    </div>
                                )}
                                {displayRankings.length > 0 ? displayRankings.map((rank, index) => (
                                    <Card key={index} className={cn(
                                        "border-none shadow-sm transition-all active:scale-[0.98]",
                                        index === 0 ? "bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400" : "bg-white"
                                    )}>
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm", rankBadgeClass(index))}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-primary text-sm flex items-center gap-2">
                                                        {rank.name}
                                                        {index === 0 && <Trophy size={14} className="text-amber-500" />}
                                                        {rank.name === user?.username && (
                                                            <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full">MY</span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-slate-400">{rank.tier} 티어</span>
                                                        <span className="text-[10px] text-slate-300">|</span>
                                                        <span className="text-[10px] text-slate-400 italic">인증 {Number(rank.workoutPoints).toFixed(2)}점</span>
                                                        {!votingActive && (
                                                            <>
                                                                <span className="text-[10px] text-slate-300">|</span>
                                                                <span className="text-[10px] text-amber-600 font-bold">MVP {Number(rank.mvpPoints).toFixed(2)}점</span>
                                                            </>
                                                        )}
                                                        {votingActive && (
                                                            <>
                                                                <span className="text-[10px] text-slate-300">|</span>
                                                                <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-0.5">
                                                                    <Lock size={8} />집계 중
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {votingActive ? (
                                                    <>
                                                        <p className="text-lg font-black text-primary leading-none">
                                                            {Number(rank.workoutPoints).toFixed(2)}
                                                            <span className="text-[10px] font-bold ml-0.5 text-slate-400">점</span>
                                                        </p>
                                                        <p className="text-[9px] text-indigo-400 mt-1 font-bold">인증 기준</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-lg font-black text-primary leading-none">
                                                            {Number(rank.totalScore).toFixed(2)}
                                                            <span className="text-[10px] font-bold ml-0.5 text-slate-400">점</span>
                                                        </p>
                                                        <p className="text-[9px] text-slate-400 mt-1">{rank.logCount}회 인증</p>
                                                    </>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )) : (
                                    <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                        <p className="text-sm text-slate-400">이 시즌의 랭킹 데이터가 없습니다.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── 이번 주 순위 ── */}
                        {tab === "weekly" && (
                            <>
                                <div className="px-1 mb-1">
                                    <p className="text-xs text-slate-400 font-bold">이번 주 인증 횟수 기준 ({weekLabel})</p>
                                </div>
                                {weeklyRankings.length > 0 ? weeklyRankings.map((entry, index) => (
                                    <Card key={entry.userId} className={cn(
                                        "border-none shadow-sm",
                                        index === 0 ? "bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400" : "bg-white"
                                    )}>
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm", rankBadgeClass(index))}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-primary text-sm flex items-center gap-2">
                                                        {entry.name}
                                                        {index === 0 && <Trophy size={14} className="text-amber-500" />}
                                                        {entry.name === user?.username && (
                                                            <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full">MY</span>
                                                        )}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">이번 주 인증 횟수</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-primary leading-none">
                                                    {entry.count}
                                                    <span className="text-[10px] font-bold ml-0.5 text-slate-400">회</span>
                                                </p>
                                                <span className={cn(
                                                    "text-[9px] font-black px-1.5 py-0.5 rounded-full",
                                                    entry.count >= 2 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-400"
                                                )}>
                                                    {entry.count >= 2 ? "달성" : "미달"}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )) : (
                                    <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                        <p className="text-sm text-slate-400">이번 주 인증 내역이 없습니다.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── 순위 추이 ── */}
                        {tab === "trend" && (
                            <div className="space-y-3">
                                <div className="bg-white rounded-2xl shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">누적 인증 횟수 추이</p>
                                        <p className="text-[10px] text-slate-400">상위 {trendData.series.length}명 표시</p>
                                    </div>
                                    <TrendChart data={trendData} myUsername={user?.username} />
                                </div>
                                {trendData.series.length > 0 && (
                                    <div className="bg-white rounded-2xl shadow-sm p-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">범례</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {trendData.series.map((s) => {
                                                const last = s.counts[s.counts.length - 1] ?? 0;
                                                const isMine = s.name === user?.username;
                                                return (
                                                    <div key={s.userId} className={cn(
                                                        "flex items-center gap-2 p-2 rounded-xl",
                                                        isMine ? "bg-amber-50 border border-amber-200" : "bg-slate-50"
                                                    )}>
                                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 truncate">
                                                                {s.name} {isMine && <span className="text-[9px] bg-primary text-white px-1 rounded-full">MY</span>}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">{last}회 누적</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {trendData.series.length === 0 && (
                                    <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                                        <p className="text-sm text-slate-400">추이 데이터가 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
