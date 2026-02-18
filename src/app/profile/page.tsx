"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, User as UserIcon, LogOut, Settings, Award, History, PlusCircle, Calendar, Trophy, ShieldCheck } from "lucide-react";
import { getProfile, getWorkoutLogs, getActiveSeason } from "@/lib/data";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WorkoutLog } from "@/types/database";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function ProfilePage() {
    const router = useRouter();
    const { user, isAuthenticated, logout } = useAuthStore();
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showTrophies, setShowTrophies] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        const fetchData = async () => {
            if (user) {
                const { data: prof } = await getProfile(user.id);
                if (prof) setProfile(prof);

                const { data: season } = await getActiveSeason();
                if (season) {
                    const { data: logData } = await getWorkoutLogs(season.id);
                    if (logData) {
                        setLogs(logData.filter(l => l.user_id === user.id && l.status === 'approved'));
                    }
                }
            }
            setIsLoading(false);
        };

        fetchData();
    }, [isAuthenticated, router, user]);

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const getTierColor = (tier: string) => {
        switch (tier?.toLowerCase()) {
            case 'diamond': return 'bg-blue-100 text-blue-700';
            case 'platinum': return 'bg-cyan-100 text-cyan-700';
            case 'gold': return 'bg-amber-100 text-amber-700';
            case 'silver': return 'bg-slate-200 text-slate-700';
            default: return 'bg-orange-100 text-orange-700';
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
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => (showHistory || showTrophies) ? (setShowHistory(false), setShowTrophies(false)) : router.back()}>
                        <ChevronLeft size={24} />
                    </Button>
                    <h1 className="text-xl font-bold text-primary">
                        {showHistory ? "인증 히스토리" : showTrophies ? "내 트로피" : "내 정보"}
                    </h1>
                </div>
            </header>

            <main className="p-6 space-y-6">
                {!showHistory && !showTrophies ? (
                    <>
                        {/* Profile Card */}
                        <Card className="border-none shadow-sm bg-white overflow-hidden rounded-[32px]">
                            <CardHeader className="bg-primary p-8 flex flex-col items-center">
                                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white mb-4 border-4 border-white/10">
                                    <UserIcon size={40} />
                                </div>
                                <h2 className="text-xl font-black text-white">{profile?.username || user?.username} 님</h2>
                                <div className="flex gap-2 mt-2">
                                    <span className={cn("text-xs px-3 py-1 rounded-full font-black italic", getTierColor(profile?.tier || 'Bronze'))}>
                                        {profile?.tier || 'Bronze'} Tier
                                    </span>
                                    {profile?.role === 'admin' && (
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

                        {/* Menu List */}
                        <section className="space-y-4">
                            <div className="bg-white rounded-[32px] shadow-sm overflow-hidden p-2">
                                <button
                                    onClick={() => setShowHistory(true)}
                                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors rounded-2xl group"
                                >
                                    <div className="flex items-center gap-4 text-primary">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary group-hover:text-white transition-all">
                                            <History size={20} />
                                        </div>
                                        <span className="text-md font-bold">운동 인증 히스토리</span>
                                    </div>
                                    <ChevronLeft size={18} className="rotate-180 text-slate-300" />
                                </button>
                                <button
                                    onClick={() => setShowTrophies(true)}
                                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors rounded-2xl group"
                                >
                                    <div className="flex items-center gap-4 text-primary">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all">
                                            <Award size={20} />
                                        </div>
                                        <span className="text-md font-bold">내 트로피/배지</span>
                                    </div>
                                    <ChevronLeft size={18} className="rotate-180 text-slate-300" />
                                </button>
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
                ) : showHistory ? (
                    <div className="space-y-4">
                        {logs.length > 0 ? (
                            logs.sort((a, b) => new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime()).map((log) => (
                                <Card key={log.id} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden border-l-4 border-accent">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-primary">
                                                <Calendar size={24} />
                                            </div>
                                            <div>
                                                <p className="font-black text-primary text-sm">
                                                    {log.workout_type === 'gym' ? '💪 운동완료' :
                                                        log.workout_type === 'running' ? '🏃 러닝' :
                                                            log.workout_type === 'walking' ? '🚶 걷기' : '🔥 스포츠'}
                                                </p>
                                                <p className="text-[11px] text-slate-400 font-bold">
                                                    {format(new Date(log.workout_date), "yyyy.MM.dd (EEE)", { locale: ko })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black text-accent">{log.duration_minutes}분</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="py-20 text-center">
                                <p className="text-slate-400 font-bold">아직 인증 내역이 없습니다.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { name: '초보 운동가', desc: '첫 인증 완료', icon: '🐣', min: 1 },
                            { name: '성실한 발걸음', desc: '인증 5회 달성', icon: '👣', min: 5 },
                            { name: '레전드 루키', desc: '인증 10회 달성', icon: '✨', min: 10 },
                            { name: '운동 매니아', desc: '인증 20회 달성', icon: '🔥', min: 20 },
                            { name: '철인 28호', desc: '인증 30회 달성', icon: '🤖', min: 30 },
                            { name: '진정한 레전드', desc: '인증 50회 달성', icon: '👑', min: 50 },
                        ].map((t) => (
                            <Card key={t.name} className={cn(
                                "border-none shadow-sm rounded-3xl p-6 flex flex-col items-center text-center gap-2",
                                logs.length >= t.min ? "bg-white" : "bg-slate-100 opacity-40 grayscale"
                            )}>
                                <span className="text-4xl mb-2">{t.icon}</span>
                                <p className="font-black text-sm text-primary">{t.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{t.desc}</p>
                                {logs.length >= t.min && (
                                    <div className="mt-2 text-[8px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-black">획득 완료</div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
