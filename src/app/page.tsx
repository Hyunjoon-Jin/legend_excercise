"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, UserIcon, PlusCircle, Calendar } from "lucide-react";
ChevronRight,
  LogOut,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CertificationModal } from "@/components/features/certification-modal";
import { NotificationList } from "@/components/features/notification-list";
import { MVPVoting } from "@/components/features/mvp-voting";
import { getActiveSeason, getRankings, getWorkoutLogs, getNotifications } from "@/lib/data";
import { Profile, Season, WorkoutLog, Notification } from "@/types/database";
import { BottomNav } from "@/components/layout/bottom-nav";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showNotifList, setShowNotifList] = useState(false);

  // Data States
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [rankings, setRankings] = useState<any[]>([]);
  const [myLogs, setMyLogs] = useState<WorkoutLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      const { data: season } = await getActiveSeason();

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
        setMyLogs(logsRes.data.filter((log: any) => log.user_id === user?.id));
      }
      setIsLoading(false);
    };

    fetchData();
  }, [isAuthenticated, router, user?.id]);

  if (!isMounted || !isAuthenticated || !user) {
    return null;
  }

  const approvedCount = myLogs.filter(l => l.status === 'approved').length;
  // 주간 카운트는 간단하게 최근 7일부터 계산하거나, 월요일 기준으로 계산
  // 여기서는 규정에 맞춰 월~일 주간 단위로 계산하는 로직이 필요하나 UI상으론 approvedCount 사용
  const weeklyApproved = approvedCount; // Placeholder

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
                관리자 고고
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
                <span className="text-primary">{Math.min(approvedCount, 2)}/2회</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((approvedCount / 2) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Buttons */}
        <div className="grid grid-cols-2 gap-4">
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

        {/* MVP Voting Section (Visible when season is active) */}
        {activeSeason && <MVPVoting />}

        {/* Real-time Ranking Board */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-bold text-primary flex items-center gap-2">
              <Trophy size={18} className="text-accent" />
              실시간 종합 랭킹 {activeSeason && <span className="text-xs font-normal text-slate-400">({activeSeason.name})</span>}
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
              rankings.slice(0, 5).map((item, idx) => (
                <div key={item.name} className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                    idx === 0 ? "bg-amber-100 text-amber-600" :
                      idx === 1 ? "bg-slate-100 text-slate-500" :
                        idx === 2 ? "bg-orange-50 text-orange-600" :
                          "bg-slate-50 text-slate-300"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary text-sm">{item.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md">{item.tier}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-black text-primary leading-none">{item.totalScore}점</p>
                        <p className="text-[8px] text-slate-400 mt-0.5">{item.logCount}회 인증</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-300" />
                    </div>
                  </div>
                </div>
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
