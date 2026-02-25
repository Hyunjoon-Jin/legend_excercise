"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trophy, Loader2, Lock } from "lucide-react";
import { MVPVoting } from "@/components/features/mvp-voting";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useEffect, useState } from "react";
import { getActiveSeason } from "@/lib/data";
import { Season } from "@/types/database";

export default function MVPPage() {
    const router = useRouter();
    const { isAuthenticated, user } = useAuthStore();
    const [activeSeason, setActiveSeason] = useState<Season | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        const fetchSeason = async () => {
            const { data } = await getActiveSeason();
            if (data) setActiveSeason(data);
            setIsLoading(false);
        };

        fetchSeason();
    }, [isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                    <ChevronLeft size={24} />
                </Button>
                <div className="flex items-center gap-2">
                    <Trophy size={20} className="text-secondary-foreground" />
                    <h1 className="text-lg font-bold text-primary">MVP 투표 및 성과 자랑</h1>
                </div>
            </header>

            <main className="p-5 flex-1">
                {activeSeason ? (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-primary to-slate-800 p-6 rounded-3xl text-white shadow-xl shadow-slate-200 mb-8 relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-xl font-black italic mb-2 tracking-tight">이번 시즌 주인공은 누구?</h2>
                                <p className="text-xs text-white/70 font-medium leading-relaxed">
                                    {activeSeason.name}의 MVP를 추천해 주세요!<br />
                                    성과를 등록하면 상위 랭커들의 자랑을 볼 수 있습니다.
                                </p>
                                {!activeSeason.voting_open && (
                                    <div className="mt-3 flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-2 w-fit">
                                        <Lock size={12} className="text-amber-300" />
                                        <span className="text-[11px] font-bold text-amber-200">투표 기간 전 · 자랑만 가능</span>
                                    </div>
                                )}
                            </div>
                            <Trophy size={100} className="absolute -right-4 -bottom-4 text-white/10 rotate-12" />
                        </div>

                        <MVPVoting
                            votingOpen={activeSeason.voting_open}
                            votingEndsAt={activeSeason.voting_ends_at}
                        />
                    </div>
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-center space-y-2">
                        <p className="text-sm font-bold text-slate-400">현재 진행 중인 시즌이 없습니다.</p>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
