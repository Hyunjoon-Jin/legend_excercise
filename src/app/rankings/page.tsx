"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Trophy, Medal, Star, Loader2, PlusCircle, Calendar, User as UserIcon } from "lucide-react";
import { getRankings, getActiveSeason } from "@/lib/data";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/layout/bottom-nav";

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
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-400 font-medium">{rank.tier} 티어</span>
                                                <span className="text-[10px] text-slate-300">|</span>
                                                <span className="text-[10px] text-slate-400 font-medium italic">인증 {rank.workoutPoints}점</span>
                                                <span className="text-[10px] text-slate-300">|</span>
                                                <span className="text-[10px] text-amber-600 font-bold">MVP {rank.mvpPoints}점</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-primary leading-none">{rank.totalScore}<span className="text-[10px] font-bold ml-0.5 text-slate-400">점</span></p>
                                        <p className="text-[9px] text-slate-400 mt-1">{rank.logCount}회 인증</p>
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

            <BottomNav />
        </div>
    );
}
