"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, User as UserIcon, LogOut, Settings, Award, History, PlusCircle, Calendar, Trophy, ShieldCheck } from "lucide-react";
import { getProfile } from "@/lib/data";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
    const router = useRouter();
    const { user, isAuthenticated, logout } = useAuthStore();
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        const fetchProfile = async () => {
            if (user) {
                const { data } = await getProfile(user.id);
                if (data) setProfile(data);
            }
            setIsLoading(false);
        };

        fetchProfile();
    }, [isAuthenticated, router, user]);

    const handleLogout = () => {
        logout();
        router.push("/login");
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
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft size={24} />
                    </Button>
                    <h1 className="text-xl font-bold text-primary">내 정보</h1>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400">
                    <Settings size={20} />
                </Button>
            </header>

            <main className="p-6 space-y-6">
                {/* Profile Card */}
                <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <CardHeader className="bg-primary p-6 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white mb-3">
                            <UserIcon size={40} />
                        </div>
                        <h2 className="text-lg font-bold text-white">{profile?.username || user?.username} 님</h2>
                        <div className="flex gap-2 mt-1">
                            <span className="text-[10px] bg-accent text-primary px-2 py-0.5 rounded-full font-bold">{profile?.tier || 'Bronze'} Tier</span>
                            {profile?.role === 'admin' && (
                                <span className="text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <ShieldCheck size={8} /> 관리자
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-2 divide-x divide-slate-50 text-center">
                            <div className="py-4">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">참여 상태</p>
                                <p className="text-sm font-bold text-primary">활동 중</p>
                            </div>
                            <div className="py-4">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">인증 방식</p>
                                <p className="text-sm font-bold text-primary">자율 인증</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Menu List */}
                <section className="space-y-3">
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50">
                            <div className="flex items-center gap-4 text-primary">
                                <History size={20} className="text-slate-400" />
                                <span className="text-sm font-bold">운동 인증 히스토리</span>
                            </div>
                            <ChevronLeft size={16} className="rotate-180 text-slate-300" />
                        </button>
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50">
                            <div className="flex items-center gap-4 text-primary">
                                <Award size={20} className="text-slate-400" />
                                <span className="text-sm font-bold">내 트로피/배지</span>
                            </div>
                            <ChevronLeft size={16} className="rotate-180 text-slate-300" />
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 p-4 text-red-500 hover:bg-red-50 transition-colors"
                        >
                            <LogOut size={20} />
                            <span className="text-sm font-bold">로그아웃</span>
                        </button>
                    </div>
                </section>
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-40">
                <button
                    onClick={() => router.push("/")}
                    className="flex flex-col items-center gap-1 text-slate-400 opacity-60"
                >
                    <PlusCircle size={22} />
                    <span className="text-[10px] font-bold">인증</span>
                </button>
                <button
                    onClick={() => router.push("/calendar")}
                    className="flex flex-col items-center gap-1 text-slate-400 opacity-60"
                >
                    <Calendar size={22} />
                    <span className="text-[10px]">캘린더</span>
                </button>
                <button
                    onClick={() => router.push("/rankings")}
                    className="flex flex-col items-center gap-1 text-slate-400 opacity-60"
                >
                    <Trophy size={22} />
                    <span className="text-[10px]">랭킹</span>
                </button>
                <button
                    className="flex flex-col items-center gap-1 text-primary"
                >
                    <UserIcon size={22} className="text-accent" />
                    <span className="text-[10px] font-bold">내정보</span>
                </button>
            </nav>
        </div>
    );
}
