"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { supabase } from "@/lib/supabase";
import { getRankings, getAllSeasons } from "@/lib/data";
import { Season } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/layout/bottom-nav";
import { cn } from "@/lib/utils";
import { ChevronLeft, Gift, Users, Trophy, Loader2, Eye } from "lucide-react";
import { format, startOfWeek } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────
interface LotteryCandidate {
    userId: string;
    name: string;
    tier: string;
    totalScore: number;
    rank: number;
}

type LotteryPhase = 'idle' | 'ready' | 'drawing' | 'revealed' | 'complete';

interface SharedState {
    phase: LotteryPhase;
    seasonName: string;
    eligible: LotteryCandidate[];
    totalCount: number;
    winners: LotteryCandidate[];
    slotName: string;
    drawNumber: number;
}

// ── Constants ──────────────────────────────────────────────────────────────
const CHANNEL = 'lottery_live';
const FRAMES = [
    ...Array(22).fill(55),   // 빠른 구간 ~1.2s
    ...Array(8).fill(110),   // 중간 구간 ~0.9s
    200, 320, 500, 750, 1050, // 느려지다 멈춤 ~2.8s
];
const ANIM_MS = FRAMES.reduce((a, b) => a + b, 0); // ~4910ms

const INITIAL_SHARED: SharedState = {
    phase: 'idle',
    seasonName: '',
    eligible: [],
    totalCount: 1,
    winners: [],
    slotName: '',
    drawNumber: 0,
};

// ── Component ──────────────────────────────────────────────────────────────
export default function LotteryPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    // Shared state (broadcast-synced across all clients)
    const [shared, setShared] = useState<SharedState>(INITIAL_SHARED);
    const sharedRef = useRef<SharedState>(INITIAL_SHARED);

    // Local state
    const [displayName, setDisplayName] = useState('');
    const [viewerCount, setViewerCount] = useState(0);
    const [isDrawing, setIsDrawing] = useState(false);

    // Admin-only setup state
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [selSeason, setSelSeason] = useState('');
    const [drawCount, setDrawCount] = useState(1);
    const [loadingData, setLoadingData] = useState(false);

    // Refs
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const animRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep sharedRef in sync with shared state (must be defined before animation effect)
    useEffect(() => {
        sharedRef.current = shared;
    }, [shared]);

    // Auth guard
    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    // Load seasons for admin setup
    useEffect(() => {
        if (isAdmin) {
            getAllSeasons().then(({ data }) => {
                if (data) setSeasons(data);
            });
        }
    }, [isAdmin]);

    // ── Realtime Channel ────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        const ch = supabase.channel(CHANNEL, {
            config: { presence: { key: user.id } },
        });

        // Receive state broadcasts
        ch.on('broadcast', { event: 'state' }, ({ payload }: { payload: { state: SharedState } }) => {
            setShared(payload.state);
        });

        // Presence sync → viewer count + late-join state recovery for members
        ch.on('presence', { event: 'sync' }, () => {
            const presenceState = ch.presenceState<{ role: string; shared?: SharedState }>();
            const allPresences = Object.values(presenceState).flat();
            setViewerCount(allPresences.length);

            if (!isAdmin) {
                const adminPresence = allPresences.find(
                    (p: any) => p.role === 'admin' && p.shared
                );
                if (adminPresence?.shared) {
                    setShared(adminPresence.shared);
                }
            }
        });

        ch.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
                await ch.track({ role: isAdmin ? 'admin' : 'member' });
            }
        });

        channelRef.current = ch;

        return () => {
            ch.unsubscribe();
        };
    }, [user, isAdmin]);

    // ── Animation Effect ────────────────────────────────────────────────────
    // Runs when phase or drawNumber changes; uses sharedRef to avoid stale closure
    useEffect(() => {
        // Clear any running animation
        animRef.current.forEach(t => clearTimeout(t));
        animRef.current = [];

        const { phase, eligible, winners, slotName } = sharedRef.current;

        if (phase === 'drawing') {
            const pool = eligible.filter(c => !winners.some(w => w.userId === c.userId));
            if (pool.length === 0) return;

            let elapsed = 0;
            FRAMES.forEach((delay) => {
                const t = setTimeout(() => {
                    const rnd = pool[Math.floor(Math.random() * pool.length)];
                    setDisplayName(rnd.name);
                }, elapsed);
                animRef.current.push(t);
                elapsed += delay;
            });

            return () => {
                animRef.current.forEach(t => clearTimeout(t));
                animRef.current = [];
            };
        } else if (phase === 'revealed' || phase === 'complete') {
            setDisplayName(slotName);
        } else {
            setDisplayName('');
        }
        // Only re-run on phase change or new draw; eligible/winners read via sharedRef
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shared.phase, shared.drawNumber]);

    // ── Broadcast Helper ────────────────────────────────────────────────────
    const broadcastState = useCallback(async (next: SharedState) => {
        setShared(next);
        sharedRef.current = next;
        if (!channelRef.current) return;
        await channelRef.current.send({
            type: 'broadcast',
            event: 'state',
            payload: { state: next },
        });
        // Track for late joiners via presence sync
        await channelRef.current.track({ role: 'admin', shared: next });
    }, []);

    // ── Week Key Helper ─────────────────────────────────────────────────────
    const getWeekKey = (dateStr: string) => {
        const d = new Date(dateStr);
        const mon = startOfWeek(d, { weekStartsOn: 1 });
        return format(mon, 'yyyy-MM-dd');
    };

    // ── Handlers ────────────────────────────────────────────────────────────
    const handleLoad = async () => {
        if (!selSeason) { alert('시즌을 선택해 주세요.'); return; }
        const targetSeason = seasons.find(s => s.id === selSeason);
        if (!targetSeason) return;

        setLoadingData(true);
        try {
            const [rankingsRes, logsRes] = await Promise.all([
                getRankings(selSeason),
                supabase
                    .from('workout_logs')
                    .select('user_id, workout_date')
                    .eq('season_id', selSeason)
                    .eq('status', 'approved'),
            ]);

            const rankings = rankingsRes.data || [];
            const logs = (logsRes.data || []) as { user_id: string; workout_date: string }[];

            // Build week→log-count map per user
            const logMap: Record<string, Record<string, number>> = {};
            logs.forEach(l => {
                const wk = getWeekKey(l.workout_date);
                if (!logMap[l.user_id]) logMap[l.user_id] = {};
                logMap[l.user_id][wk] = (logMap[l.user_id][wk] || 0) + 1;
            });

            // Enumerate all weeks in the season (Monday-based)
            const seasonStart = new Date(targetSeason.start_date);
            const seasonEnd = new Date(targetSeason.end_date);
            const allWeeks: { key: string; isPartial: boolean }[] = [];
            let curr = startOfWeek(seasonStart, { weekStartsOn: 1 });
            while (curr <= seasonEnd) {
                const weekEnd = new Date(curr.getTime() + 6 * 24 * 60 * 60 * 1000);
                const isPartial = curr < seasonStart || weekEnd > seasonEnd;
                allWeeks.push({ key: format(curr, 'yyyy-MM-dd'), isPartial });
                curr = new Date(curr.getTime() + 7 * 24 * 60 * 60 * 1000);
            }

            // Filter: rank 4+ AND no failed weeks (§24)
            const eligible: LotteryCandidate[] = [];
            rankings.forEach((r: any, idx: number) => {
                if (idx < 3) return; // top 3 excluded
                const userWeeks = logMap[r.userId] || {};
                const hasFailed = allWeeks.some(({ key, isPartial }) => {
                    const count = userWeeks[key] || 0;
                    return count < (isPartial ? 1 : 2);
                });
                if (!hasFailed) {
                    eligible.push({
                        userId: r.userId,
                        name: r.name,
                        tier: r.tier,
                        totalScore: r.totalScore,
                        rank: idx + 1,
                    });
                }
            });

            const count = Math.min(drawCount, Math.max(eligible.length, 1));
            await broadcastState({
                phase: 'ready',
                seasonName: targetSeason.name,
                eligible,
                totalCount: count,
                winners: [],
                slotName: '',
                drawNumber: 0,
            });
        } catch (err: any) {
            alert('데이터 로드 오류: ' + err.message);
        } finally {
            setLoadingData(false);
        }
    };

    const weightedRandom = (pool: LotteryCandidate[]): LotteryCandidate => {
        const total = pool.reduce((sum, c) => sum + c.totalScore, 0);
        if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
        let rand = Math.random() * total;
        for (const c of pool) {
            rand -= c.totalScore;
            if (rand <= 0) return c;
        }
        return pool[pool.length - 1];
    };

    const handleDraw = async () => {
        if (isDrawing) return;
        const cur = sharedRef.current;
        const pool = cur.eligible.filter(c => !cur.winners.some(w => w.userId === c.userId));
        if (pool.length === 0) return;

        const winner = weightedRandom(pool);
        const newDrawNumber = cur.drawNumber + 1;
        setIsDrawing(true);

        // 1. Broadcast drawing → all clients start animation
        await broadcastState({ ...cur, phase: 'drawing', drawNumber: newDrawNumber });

        // 2. After animation + buffer, broadcast result
        const newWinners = [...cur.winners, winner];
        const isComplete = newWinners.length >= cur.totalCount;
        drawTimerRef.current = setTimeout(async () => {
            await broadcastState({
                ...sharedRef.current,
                phase: isComplete ? 'complete' : 'revealed',
                slotName: winner.name,
                winners: newWinners,
            });
            setIsDrawing(false);
        }, ANIM_MS + 400);
    };

    const handleReset = async () => {
        if (drawTimerRef.current) {
            clearTimeout(drawTimerRef.current);
            drawTimerRef.current = null;
        }
        animRef.current.forEach(t => clearTimeout(t));
        animRef.current = [];
        const cur = sharedRef.current;
        await broadcastState({
            ...cur,
            phase: 'ready',
            winners: [],
            slotName: '',
            drawNumber: 0,
        });
        setIsDrawing(false);
    };

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col min-h-screen bg-secondary pb-24">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100">
                <div className="px-4 pt-3 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="rounded-full"
                        >
                            <ChevronLeft size={20} />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Gift size={18} className="text-amber-500" />
                            <h1 className="text-lg font-bold text-primary">레전드 추첨</h1>
                            {shared.seasonName && (
                                <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                                    {shared.seasonName}
                                </span>
                            )}
                        </div>
                    </div>
                    {viewerCount > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                            <Eye size={13} />
                            <span>{viewerCount}명 시청 중</span>
                        </div>
                    )}
                </div>
            </header>

            <main className="p-5 space-y-5 max-w-[480px] w-full mx-auto">

                {/* Admin Setup Panel (visible when idle or ready) */}
                {isAdmin && (shared.phase === 'idle' || shared.phase === 'ready') && (
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 space-y-4 bg-white">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500">시즌 선택 (종료된 시즌)</Label>
                                <Select value={selSeason} onValueChange={setSelSeason}>
                                    <SelectTrigger className="border-none bg-slate-50 font-bold">
                                        <SelectValue placeholder="시즌을 선택하세요" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {seasons
                                            .filter(s => !s.is_active && s.closed_at)
                                            .map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500">추첨 인원 수</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={drawCount}
                                    onChange={e => setDrawCount(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="border-none bg-slate-50 font-bold"
                                />
                                <p className="text-[11px] text-slate-400">§24: 추첨 재원 ÷ 5,000원 = 추첨 인원수</p>
                            </div>

                            <Button
                                onClick={handleLoad}
                                disabled={!selSeason || loadingData}
                                className="w-full"
                            >
                                {loadingData
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />불러오는 중...</>
                                    : <><Gift size={15} className="mr-2" />대상자 불러오기</>
                                }
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Idle placeholder for members */}
                {shared.phase === 'idle' && !isAdmin && (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
                        <Gift size={52} className="text-slate-200" />
                        <p className="text-slate-400 font-medium">잠시 후 추첨이 시작됩니다</p>
                        <p className="text-xs text-slate-300">관리자가 추첨을 준비 중입니다</p>
                    </div>
                )}

                {/* Eligible candidates list */}
                {shared.phase !== 'idle' && shared.eligible.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-black text-slate-500 flex items-center gap-1.5 px-1">
                            <Users size={12} />
                            추첨 대상자 ({shared.eligible.length}명)
                            <span className="font-medium text-slate-400">· 4등 이하 + 인증 실패 0주</span>
                        </p>
                        <div className="space-y-1.5">
                            {shared.eligible.map(c => {
                                const isWon = shared.winners.some(w => w.userId === c.userId);
                                const remaining = shared.eligible.filter(
                                    e => !shared.winners.some(w => w.userId === e.userId)
                                );
                                const remScore = remaining.reduce((s, e) => s + e.totalScore, 0);
                                const prob = isWon ? 0
                                    : remScore > 0 ? c.totalScore / remScore * 100
                                    : 100 / Math.max(remaining.length, 1);
                                return (
                                    <div
                                        key={c.userId}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all",
                                            isWon
                                                ? "bg-emerald-50 border border-emerald-100"
                                                : "bg-white shadow-sm"
                                        )}
                                    >
                                        <span className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                                            isWon ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                                        )}>{c.rank}</span>
                                        <span className="flex-1 text-sm font-bold text-primary truncate">{c.name}</span>
                                        <span className="text-[11px] text-slate-400 font-medium shrink-0">{c.totalScore}점</span>
                                        <span className={cn(
                                            "text-[11px] font-black px-2 py-0.5 rounded-full shrink-0",
                                            isWon
                                                ? "bg-emerald-100 text-emerald-600"
                                                : "bg-amber-50 text-amber-600"
                                        )}>
                                            {isWon ? '🎉 당첨' : `${prob.toFixed(1)}%`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* No eligible candidates message */}
                {shared.phase !== 'idle' && shared.eligible.length === 0 && (
                    <div className="p-6 text-center bg-white rounded-2xl text-sm text-slate-400">
                        추첨 대상자가 없습니다.<br />
                        <span className="text-xs text-slate-300">
                            4등 이하 + 모든 주 2회 이상 인증 조건을 충족한 회원이 없어요.
                        </span>
                    </div>
                )}

                {/* Slot Machine Card */}
                {shared.phase !== 'idle'
                    && shared.eligible.length > 0
                    && shared.winners.length < shared.totalCount
                    && (
                    <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-3xl p-6 space-y-5 shadow-xl">
                        {/* Draw counter */}
                        <div className="text-center space-y-0.5">
                            <p className="text-[9px] font-black tracking-[0.2em] text-white/30 uppercase">Legend 추첨 행사</p>
                            <p className="text-sm font-black text-white/50">
                                제 {shared.winners.length + 1}차 추첨
                                <span className="text-white/25 font-medium"> / 총 {shared.totalCount}명</span>
                            </p>
                        </div>

                        {/* Slot display */}
                        <div className={cn(
                            "relative rounded-2xl py-10 px-6 text-center transition-all duration-300",
                            shared.phase === 'drawing'
                                ? "bg-amber-500/15 ring-2 ring-amber-400/40"
                                : shared.phase === 'revealed'
                                ? "bg-emerald-500/15 ring-2 ring-emerald-400/50"
                                : "bg-white/5"
                        )}>
                            {shared.phase === 'drawing' && (
                                <p className="text-4xl font-black text-white tracking-wide animate-pulse">
                                    {displayName || '···'}
                                </p>
                            )}
                            {shared.phase === 'revealed' && (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-black text-emerald-400 tracking-widest animate-bounce">
                                        🎉 당첨!
                                    </p>
                                    <p className="text-4xl font-black text-white">{displayName}</p>
                                    <p className="text-xs text-white/40 font-medium">
                                        {shared.eligible.find(c => c.name === shared.slotName)?.totalScore ?? ''}점
                                        · {shared.eligible.find(c => c.name === shared.slotName)?.rank ?? ''}위
                                    </p>
                                </div>
                            )}
                            {shared.phase === 'ready' && (
                                <p className="text-xl font-bold text-white/20">추첨 대기 중</p>
                            )}
                        </div>

                        {/* Draw button (admin) / waiting message (member) */}
                        {isAdmin ? (
                            <button
                                onClick={handleDraw}
                                disabled={isDrawing}
                                className={cn(
                                    "w-full h-14 rounded-2xl text-white font-black text-base transition-all active:scale-95",
                                    isDrawing
                                        ? "bg-slate-600 cursor-not-allowed"
                                        : shared.phase === 'revealed'
                                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-lg shadow-emerald-900/30"
                                        : "bg-gradient-to-r from-amber-500 to-amber-400 shadow-lg shadow-amber-900/30"
                                )}
                            >
                                {isDrawing
                                    ? <span className="flex items-center justify-center gap-2">
                                        <Loader2 size={18} className="animate-spin" />추첨 중...
                                      </span>
                                    : shared.phase === 'revealed'
                                    ? `다음 추첨하기 (${shared.winners.length + 1}/${shared.totalCount})`
                                    : '🎲 추첨 시작'
                                }
                            </button>
                        ) : (
                            <p className="text-center text-xs text-white/30 py-2">
                                관리자의 추첨 시작을 기다리고 있어요
                            </p>
                        )}
                    </div>
                )}

                {/* Complete Banner */}
                {shared.phase === 'complete' && (
                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-6 text-center space-y-3 shadow-lg">
                        <Trophy size={36} className="mx-auto text-white/80" />
                        <div>
                            <p className="text-xl font-black text-white">추첨 완료! 🎉</p>
                            <p className="text-sm text-white/60 mt-1">
                                총 {shared.totalCount}명 추첨이 완료되었습니다.
                            </p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={handleReset}
                                className="mt-1 px-5 py-2 bg-white/15 hover:bg-white/25 text-white text-sm font-bold rounded-full transition-colors"
                            >
                                다시 추첨하기
                            </button>
                        )}
                    </div>
                )}

                {/* Winners List */}
                {shared.winners.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-black text-slate-500 flex items-center gap-1.5 px-1">
                            <Trophy size={12} className="text-amber-500" />
                            당첨자 목록
                        </p>
                        <div className="space-y-2">
                            {shared.winners.map((w, i) => (
                                <div
                                    key={w.userId}
                                    className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 px-4 py-3 rounded-2xl shadow-sm"
                                >
                                    <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md shadow-amber-200">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-sm text-primary">{w.name}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            {w.tier} · {w.rank}위 · 총점 {w.totalScore}점
                                        </p>
                                    </div>
                                    <span className="text-2xl">🎉</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
