"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  User as UserIcon,
  PlusCircle,
  Calendar,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Bell,
  BookOpen,
  Star,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CertificationModal } from "@/components/features/certification-modal";
import { NotificationList } from "@/components/features/notification-list";
import { getActiveSeason, getAllSeasons, getRankings, getWorkoutLogs, getNotifications, getVotes, getMVPPrs } from "@/lib/data";
import { Profile, Season, WorkoutLog, Notification, MVPPr } from "@/types/database";
import { BottomNav } from "@/components/layout/bottom-nav";
import { format, startOfWeek, endOfWeek, isWithinInterval, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showNotifList, setShowNotifList] = useState(false);

  // Data States
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [recentlyClosedSeason, setRecentlyClosedSeason] = useState<Season | null>(null);
  const [rankings, setRankings] = useState<any[]>([]);
  const [myLogs, setMyLogs] = useState<WorkoutLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myVoteCount, setMyVoteCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [votingMsLeftLive, setVotingMsLeftLive] = useState<number | null>(null);
  const [allLogs, setAllLogs] = useState<WorkoutLog[]>([]);
  const [memberDetail, setMemberDetail] = useState<{
    userId: string; name: string; tier: string;
    totalScore: number; workoutPoints: number; logCount: number;
  } | null>(null);
  const [memberPr, setMemberPr] = useState<MVPPr | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [modalMonth, setModalMonth] = useState(new Date());

  useEffect(() => {
    setIsMounted(true);
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      const [{ data: season }, { data: allSeasons }] = await Promise.all([
        getActiveSeason(),
        getAllSeasons(),
      ]);

      // Find recently closed season (within last 7 days)
      if (allSeasons) {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const closed = allSeasons.find((s: Season) => {
          if (!s.closed_at) return false;
          return new Date(s.closed_at) >= oneWeekAgo;
        });
        if (closed) setRecentlyClosedSeason(closed);
      }

      // 투표 종료 3시간 이내인지 확인 후 votes 조회
      if (season?.voting_open && season?.voting_ends_at) {
        const msLeft = new Date(season.voting_ends_at).getTime() - Date.now();
        if (msLeft > 0 && msLeft <= 3 * 60 * 60 * 1000) {
          const { data: votes } = await getVotes(season.id, user.id);
          setMyVoteCount(votes?.length ?? 0);
        }
      }

      const promises: any[] = [getNotifications(user.id)];
      if (season) {
        setActiveSeason(season);
        promises.push(getRankings(season.id));
        promises.push(getWorkoutLogs(season.id));
      }

      const results = await Promise.all(promises);
      const [notifRes, rankRes, logsRes] = results;

      if (notifRes?.data) {
        setUnreadCount(notifRes.data.filter((n: any) => !n.is_read).length);
      }
      if (rankRes?.data) setRankings(rankRes.data);
      if (logsRes?.data) {
        setAllLogs(logsRes.data);
        setMyLogs(logsRes.data.filter((log: any) => log.user_id === user?.id));
      }
      setIsLoading(false);
    };

    fetchData();
  }, [isAuthenticated, router, user?.id]);

  // 1초 단위 카운트다운 (투표 진행 중일 때만)
  useEffect(() => {
    if (!activeSeason?.voting_open || !activeSeason?.voting_ends_at) {
      setVotingMsLeftLive(null);
      return;
    }
    const endsAt = activeSeason.voting_ends_at;
    const update = () => setVotingMsLeftLive(new Date(endsAt).getTime() - Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeSeason?.voting_open, activeSeason?.voting_ends_at]);

  if (!isMounted || !isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user?.role === 'admin';
  // 투표 진행 중 → 투표 집계 비공개 (관리자 포함)
  const votingActive = !!(activeSeason?.voting_open);

  // 투표 긴급 공지: 종료 3시간 이내 + 미투표
  const votingMsLeft = activeSeason?.voting_ends_at
    ? new Date(activeSeason.voting_ends_at).getTime() - Date.now()
    : null;
  const isVotingUrgent = !isAdmin
    && votingActive
    && myVoteCount !== null
    && myVoteCount < 2
    && votingMsLeft !== null
    && votingMsLeft > 0
    && votingMsLeft <= 3 * 60 * 60 * 1000;

  function formatRemaining(ms: number) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  }

  const openMemberDetail = async (item: any) => {
    setMemberDetail({
      userId: item.userId,
      name: item.name,
      tier: item.tier,
      totalScore: item.totalScore,
      workoutPoints: item.workoutPoints,
      logCount: item.logCount,
    });
    setModalMonth(new Date());
    setMemberPr(null);
    if (activeSeason) {
      setIsLoadingModal(true);
      const { data: prs } = await getMVPPrs(activeSeason.id);
      setMemberPr(prs?.find(p => p.user_id === item.userId) ?? null);
      setIsLoadingModal(false);
    }
  };

  const approvedCount = myLogs.filter(l => l.status === 'approved').length;

  // 주간 카운트: 이번 주(월~일) 기간 내에 포함된 workout_date 기준
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // 월요일 시작
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // 일요일 종료

  const weeklyApproved = myLogs.filter(l => {
    if (l.status !== 'approved') return false;
    const workDate = new Date(l.workout_date);
    return isWithinInterval(workDate, { start: weekStart, end: weekEnd });
  }).length;

  const weeklyPending = myLogs.filter(l => {
    if (l.status !== 'pending') return false;
    const workDate = new Date(l.workout_date);
    return isWithinInterval(workDate, { start: weekStart, end: weekEnd });
  }).length;

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-secondary">
      {/* Header */}
      <header className="p-6 pb-2 bg-background">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-accent font-bold text-sm">
              L
            </div>
            <h1 className="text-xl font-bold text-primary">Legend</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotifList(true)}
              className="relative p-2 text-primary hover:bg-slate-100 rounded-full transition-colors"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-accent text-white text-[10px] flex items-center justify-center rounded-full font-bold border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground font-bold hover:bg-slate-100 rounded-full px-3">
              로그아웃
            </Button>
            {user.role === 'admin' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push("/admin")}
                className="bg-accent text-white hover:bg-accent/90 gap-1 font-bold h-8"
              >
                관리자 모드
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Notification Sheet Overlay */}
      {showNotifList && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowNotifList(false)} />
          <div className="relative w-full max-w-[400px] bg-white h-full animate-in slide-in-from-right duration-300 shadow-xl">
            <NotificationList onClose={() => setShowNotifList(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 px-6 space-y-6 overflow-y-auto">
        {/* Season Result Banner (visible for 1 week after close) */}
        {recentlyClosedSeason && (
          <div
            onClick={() => router.push(`/season-result/${recentlyClosedSeason.id}`)}
            className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-3xl text-white shadow-lg flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-1">
                <Trophy size={12} className="text-accent animate-pulse" />
                <span className="text-[10px] font-black italic tracking-widest text-white/60">SEASON ENDED</span>
              </div>
              <h3 className="text-base font-black leading-tight">
                🏁 {recentlyClosedSeason.name} 결과 확인하기
              </h3>
              <p className="text-[10px] text-white/50 font-bold mt-1">최종 순위 · 개인 성과 · MVP 결과 →</p>
            </div>
            <div className="relative z-10 bg-white/10 p-3 rounded-2xl">
              <Trophy size={28} className="text-accent" />
            </div>
            <div className="absolute top-[-30%] right-[-5%] w-28 h-28 bg-accent/10 rounded-full blur-2xl" />
          </div>
        )}
        {/* Urgent Voting Notice: < 3h remaining + not voted */}
        {isVotingUrgent && votingMsLeft !== null && (
          <div
            onClick={() => router.push("/mvp")}
            className="bg-red-600 rounded-3xl p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all shadow-lg shadow-red-200 animate-pulse"
          >
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Bell size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white leading-tight">
                ⏰ 투표 마감 {formatRemaining(votingMsLeft)} 전!
              </p>
              <p className="text-[11px] text-red-100 font-bold mt-0.5">
                아직 {2 - myVoteCount!}표가 남았어요. 지금 바로 투표해 주세요!
              </p>
            </div>
            <ChevronRight size={18} className="text-white/70 shrink-0" />
          </div>
        )}
        {/* Burning Period Notice */}
        {activeSeason?.burning_start_date && activeSeason?.burning_end_date && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const start = new Date(activeSeason.burning_start_date);
          const end = new Date(activeSeason.burning_end_date);

          const isUpcoming = today < start;
          const isActive = today >= start && today <= end;

          if (isActive) {
            return (
              <div className="bg-amber-100 border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-white shadow-inner">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <p className="text-amber-800 font-black text-sm">🔥 현재는 버닝 기간입니다!</p>
                    <p className="text-[10px] text-amber-700 font-bold">
                      기간: {format(start, 'MM/dd')} ~ {format(end, 'MM/dd')} (인증 점수 2배)
                    </p>
                  </div>
                </div>
                <div className="text-[10px] bg-amber-500 text-white px-3 py-1.5 rounded-full font-black">
                  진행 중
                </div>
              </div>
            );
          } else if (isUpcoming) {
            return (
              <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl flex items-center justify-between opacity-80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-slate-700 font-black text-sm">📅 차주 버닝 기간 예고</p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      기간: {format(start, 'MM/dd')} ~ {format(end, 'MM/dd')}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] bg-slate-400 text-white px-3 py-1.5 rounded-full font-black">
                  진행 예정
                </div>
              </div>
            );
          }
          return null;
        })()}
        {/* Profile Card */}
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-primary overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={32} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-primary">{user.username} 님</h2>
                  <Badge variant="wait" className="bg-amber-100 text-amber-700 border-none font-bold">
                    {user.tier || "Bronze"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">시즌 인증: <span className="text-primary font-bold">{approvedCount}회</span> 완료</p>
              </div>
            </div>

            {/* Week Progress Bar (Simplified for now) */}
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">이번 주 운동 현황</span>
                <div className="flex items-center gap-2">
                  {weeklyPending > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[10px] px-1.5 py-0.5 h-auto">
                      대기중 {weeklyPending}
                    </Badge>
                  )}
                  <span className="text-primary">{Math.min(weeklyApproved, 2)}/2회</span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((weeklyApproved / 2) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Buttons */}
        <div className="grid gap-4 grid-cols-2">
          <Button
            variant="default"
            className="h-auto flex-col gap-2 py-5 shadow-sm active:scale-95 transition-transform"
            size="lg"
            onClick={() => setShowCertModal(true)}
          >
            <PlusCircle size={24} className="text-accent" />
            <span className="font-bold">운동 인증하기</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-5 bg-white border-none shadow-sm active:scale-95 transition-transform"
            size="lg"
            onClick={() => router.push("/calendar")}
          >
            <Calendar size={24} className="text-primary" />
            <span className="font-bold">운동 캘린더</span>
          </Button>
        </div>

        {/* MVP Voting Banner */}
        {activeSeason && (
          <div
            onClick={() => router.push("/mvp")}
            className="bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-5 rounded-3xl text-white shadow-lg shadow-amber-100 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Star size={12} className="text-white fill-white animate-pulse" />
                  <span className="text-[10px] font-black italic tracking-widest text-white/80">COMMUNITY</span>
                </div>
                <h3 className="text-lg font-black italic leading-tight">
                  MVP 투표 / <br />내 성과 자랑하러 가기
                </h3>
                <p className="text-[10px] text-white/70 font-bold mt-1.5 flex items-center gap-1">
                  지금 1위 후보들의 비결 확인하기 <ChevronRight size={10} />
                </p>
              </div>
              <div className="relative z-10 bg-white/20 p-3 rounded-2xl backdrop-blur-sm group-hover:bg-white/30 transition-colors shrink-0">
                <Trophy size={32} className="text-white drop-shadow-md" />
              </div>
            </div>

            {/* 투표 종료 카운트다운 */}
            {activeSeason.voting_open && votingMsLeftLive !== null && votingMsLeftLive > 0 && (
              <div className="relative z-10 mt-4 pt-3 border-t border-white/25">
                <p className="text-[9px] font-black text-white/60 tracking-widest mb-2">투표 마감까지 남은 시간</p>
                <div className="flex items-end gap-1.5">
                  {(() => {
                    const totalSec = Math.max(0, Math.floor(votingMsLeftLive / 1000));
                    const d = Math.floor(totalSec / 86400);
                    const h = Math.floor((totalSec % 86400) / 3600);
                    const m = Math.floor((totalSec % 3600) / 60);
                    const s = totalSec % 60;
                    const units = d > 0
                      ? [{ v: d, label: '일' }, { v: h, label: '시' }, { v: m, label: '분' }]
                      : [{ v: h, label: '시' }, { v: m, label: '분' }, { v: s, label: '초' }];
                    return units.map((u, i) => (
                      <div key={i} className="flex items-end gap-1.5">
                        <div className="flex flex-col items-center">
                          <div className="bg-white/20 rounded-xl px-3 py-1.5 min-w-[44px] text-center">
                            <span className="text-xl font-black text-white tabular-nums leading-none">
                              {String(u.v).padStart(2, '0')}
                            </span>
                            <p className="text-[8px] font-bold text-white/60 mt-0.5">{u.label}</p>
                          </div>
                        </div>
                        {i < units.length - 1 && (
                          <span className="text-lg font-black text-white/30 pb-4">:</span>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          </div>
        )}

        {/* Real-time Ranking Board */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-bold text-primary flex items-center gap-2">
              <Trophy size={18} className="text-accent" />
              {votingActive ? "운동 인증 랭킹" : "실시간 종합 랭킹"}
              {activeSeason && <span className="text-xs font-normal text-slate-400">({activeSeason.name})</span>}
              {votingActive && (
                <span className="text-[10px] bg-indigo-100 text-indigo-500 font-black px-2 py-0.5 rounded-full">집계 중</span>
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-auto p-0 gap-1 hover:bg-transparent"
              onClick={() => router.push("/rankings")}
            >
              전체보기 <ChevronRight size={14} />
            </Button>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              [1, 2, 3].map(i => <div key={i} className="h-14 bg-white/50 animate-pulse rounded-xl" />)
            ) : rankings.length > 0 ? (
              (votingActive
                ? [...rankings].sort((a, b) => b.logCount - a.logCount)
                : rankings
              ).slice(0, 5).map((item, idx) => (
                <button
                  key={item.userId ?? item.name}
                  onClick={() => openMemberDetail(item)}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm active:scale-[0.98] transition-transform text-left"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                    idx === 0 ? "bg-amber-100 text-amber-600" :
                      idx === 1 ? "bg-slate-100 text-slate-500" :
                        idx === 2 ? "bg-orange-50 text-orange-600" :
                          "bg-slate-50 text-slate-300"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-primary text-sm truncate">{item.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md shrink-0">{item.tier}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {votingActive ? (
                          <>
                            <p className="text-xs font-black text-primary leading-none">{item.logCount}회</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">{item.workoutPoints}점</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-black text-primary leading-none">{item.totalScore}점</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">{item.logCount}회 인증</p>
                          </>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-slate-300" />
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl">
                <p className="text-sm text-muted-foreground">랭킹 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        </section>

        {/* Rulebook Quick Link */}
        <button
          onClick={() => router.push("/rulebook")}
          className="w-full text-left"
        >
          <Card className="border-none shadow-sm bg-primary text-white hover:bg-primary/95 transition-colors">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <BookOpen size={20} className="text-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">운동방 규정 확인</h4>
                  <p className="text-xs text-white/60">Ver 4.2 공식 규정집</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/40" />
            </CardContent>
          </Card>
        </button>

        {user.role === 'admin' && (
          <Button
            onClick={() => router.push("/admin")}
            variant="default"
            className="w-full h-12 rounded-xl bg-slate-800 text-white font-bold gap-2"
          >
            <LogOut size={16} className="rotate-180" />
            관리자 모드로 전환
          </Button>
        )}
      </main>

      {/* Member Detail Modal */}
      {memberDetail && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMemberDetail(null)} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none">
          <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl pointer-events-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-primary">{memberDetail.name}</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">{memberDetail.tier}</span>
              </div>
              <button onClick={() => setMemberDetail(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Stats */}
            <div className="px-6 pt-4 pb-2 flex gap-3">
              <div className="flex-1 bg-slate-50 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-primary">{memberDetail.logCount}회</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">인증 횟수</p>
              </div>
              <div className="flex-1 bg-amber-50 rounded-2xl p-3 text-center">
                <p className="text-xl font-black text-accent">
                  {votingActive ? memberDetail.workoutPoints : memberDetail.totalScore}점
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  {votingActive ? '인증 점수' : '종합 점수'}
                </p>
              </div>
            </div>

            {/* Calendar */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-primary text-sm">
                  {format(modalMonth, "yyyy년 M월", { locale: ko })}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setModalMonth(subMonths(modalMonth, 1))} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                    <ChevronLeft size={18} className="text-slate-500" />
                  </button>
                  <button onClick={() => setModalMonth(addMonths(modalMonth, 1))} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                    <ChevronRight size={18} className="text-slate-500" />
                  </button>
                </div>
              </div>
              {(() => {
                const memberLogsForCalendar = allLogs.filter(
                  l => l.user_id === memberDetail.userId && l.status === 'approved'
                );
                const calDays = eachDayOfInterval({
                  start: startOfWeek(startOfMonth(modalMonth)),
                  end: endOfWeek(endOfMonth(modalMonth)),
                });
                return (
                  <>
                    <div className="grid grid-cols-7 mb-1">
                      {["일","월","화","수","목","금","토"].map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-[1px] bg-slate-100 rounded-xl overflow-hidden">
                      {calDays.map((day, i) => {
                        const dayLogs = memberLogsForCalendar.filter(l => isSameDay(new Date(l.workout_date), day));
                        const inThisMonth = isSameMonth(day, modalMonth);
                        const hasWorkout = dayLogs.length > 0 && inThisMonth;
                        return (
                          <div key={i} className={cn(
                            "aspect-square flex flex-col items-center justify-center",
                            hasWorkout ? "bg-amber-50" : "bg-white"
                          )}>
                            <span className={cn(
                              "w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-medium",
                              hasWorkout ? "bg-accent text-white font-bold text-[10px]" :
                                !inThisMonth ? "text-slate-300" : "text-slate-700"
                            )}>
                              {format(day, "d")}
                            </span>
                            {hasWorkout && (
                              <span className="text-[8px] font-black text-accent leading-none mt-0.5">
                                {dayLogs.length > 1 ? `${dayLogs.length}회` : "✓"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* MVP PR (성과 자랑) */}
            <div className="px-6 pb-8">
              <h4 className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                <Star size={14} className="text-accent" />
                이번 시즌 성과 자랑
              </h4>
              {isLoadingModal ? (
                <div className="h-20 bg-slate-50 animate-pulse rounded-xl" />
              ) : memberPr ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
                  {(() => {
                    const getPrUrls = (imageUrl?: string): string[] => {
                      if (!imageUrl) return [];
                      try { const p = JSON.parse(imageUrl); if (Array.isArray(p)) return p; } catch {}
                      return [imageUrl];
                    };
                    const isVid = (url: string) => /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);
                    const urls = getPrUrls(memberPr.image_url);
                    return urls.length > 0 ? (
                      <div className={cn("grid gap-2 mb-3", urls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                        {urls.map((url, i) =>
                          isVid(url) ? (
                            <video key={i} src={url} controls className="w-full rounded-xl bg-black" />
                          ) : (
                            <img key={i} src={url} alt="" className="w-full rounded-xl object-contain bg-slate-100" />
                          )
                        )}
                      </div>
                    ) : null;
                  })()}
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{memberPr.content}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-xl">아직 성과 자랑을 작성하지 않았어요.</p>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      <BottomNav onPlusClick={() => setShowCertModal(true)} />

      <CertificationModal
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
        onSuccess={() => {
          // Re-fetch data or update UI
          window.location.reload();
        }}
      />
    </div>
  );
}
