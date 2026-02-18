"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Trophy, Medal, Star, Loader2, PlusCircle, Calendar, User as UserIcon } from "lucide-react";
import { getRankings, getActiveSeason } from "@/lib/data";
import { cn } from "@/lib/utils";

export default function RankingsPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [rankings, setRankings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        const fetchRankings = async () => {
            setIsLoading(true);
            const { data: season } = await getActiveSeason();
            if (season) {
                const { data } = await getRankings(season.id);
                if (data) setRankings(data);
            }
            setIsLoading(false);
        };

        fetchRankings();
    }, [isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft size={24} />
                </Button>
                <h1 className="text-xl font-bold text-primary">실시간 랭킹</h1>
            </header>

            <main className="p-6 space-y-6">
                <div className="space-y-3">
                    {rankings.length > 0 ? (
                        rankings.map((rank, index) => (
                            <Card key={index} className={cn(
                                "border-none shadow-sm transition-all active:scale-[0.98]",
                                index === 0 ? "bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400" : "bg-white"
                            )}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                            index === 0 ? "bg-amber-400 text-white" :
                                                index === 1 ? "bg-slate-300 text-white" :
                                                    index === 2 ? "bg-amber-600/60 text-white" : "bg-slate-100 text-slate-400"
                                        )}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-primary text-sm flex items-center gap-2">
                                                {rank.name}
                                                {index === 0 && <Trophy size={14} className="text-amber-500" />}
                                                {rank.name === user?.username && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full">MY</span>}
                                            </p>
                                            <p className="text-[11px] text-slate-400">{rank.tier} 티어</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-primary">{rank.count}<span className="text-[10px] font-normal ml-0.5 text-slate-400 font-bold">회 인증</span></p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                            <p className="text-sm text-slate-400">이번 시즌 랭킹 데이터가 아직 없습니다.</p>
                        </div>
                    )}
                </div>
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
                    className="flex flex-col items-center gap-1 text-primary"
                >
                    <Trophy size={22} className="text-accent" />
                    <span className="text-[10px] font-bold">랭킹</span>
                </button>
                <button
                    onClick={() => router.push("/profile")}
                    className="flex flex-col items-center gap-1 text-slate-400 opacity-60"
                >
                    <UserIcon size={22} />
                    <span className="text-[10px]">내정보</span>
                </button>
            </nav>
        </div>
    );
}
