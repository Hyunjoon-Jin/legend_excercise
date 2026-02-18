"use client";

import { useEffect, useState } from "react";
import {
    Trophy,
    User as UserIcon,
    Heart,
    Loader2,
    AlertCircle
} from "lucide-react";
import {
    getActiveSeason,
    getRankings,
    castVote,
    hasVoted
} from "@/lib/data";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Profile } from "@/types/database";
import { supabase } from "@/lib/supabase";

export function MVPVoting() {
    const { user } = useAuthStore();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [hasVotedToday, setHasVotedToday] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isVoting, setIsVoting] = useState<string | null>(null);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

    useEffect(() => {
        const fetchVotingData = async () => {
            if (!user) return;
            setIsLoading(true);

            const { data: season } = await getActiveSeason();
            if (season) {
                setActiveSeasonId(season.id);
                const [rankRes, voteRes] = await Promise.all([
                    getRankings(season.id),
                    hasVoted(season.id, user.id)
                ]);

                if (rankRes.data) {
                    // Candidates are other members from the rankings
                    setCandidates(rankRes.data.filter((c: any) => c.name !== user.username));
                }
                setHasVotedToday(voteRes.data);
            }
            setIsLoading(false);
        };

        fetchVotingData();
    }, [user]);

    const handleVote = async (candidateName: string) => {
        if (!user || !activeSeasonId || isVoting) return;

        // Find candidate ID by username (in real app, use IDs in data functions)
        const { data: prof } = await supabase.from('profiles').select('id').eq('username', candidateName).single();
        if (!prof) return;

        setIsVoting(candidateName);
        const { error } = await castVote(activeSeasonId, user.id, prof.id);

        if (error) {
            alert("이미 투표하셨거나 오류가 발생했습니다.");
        } else {
            setHasVotedToday(true);
            alert(`${candidateName} 님에게 소중한 한 표를 던졌습니다!`);
        }
        setIsVoting(null);
    };

    if (isLoading) return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    if (hasVotedToday) {
        return (
            <Card className="bg-amber-50 border-amber-100">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                    <Heart className="text-accent fill-accent" size={32} />
                    <div>
                        <h3 className="font-bold text-primary">이번 시즌 투표 완료!</h3>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                            소중한 한 표 감사합니다.<br />시즌 종료 후 MVP 결과가 공개됩니다.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
                <Trophy size={20} className="text-accent" />
                <h2 className="text-lg font-bold">이번 시즌 MVP 투표</h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {candidates.map((c) => (
                    <div key={c.name} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                <UserIcon size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-primary">{c.name}</p>
                                <p className="text-[10px] text-slate-400">{c.tier} / {c.count}회 인증완료</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 rounded-full border-accent text-accent font-bold hover:bg-accent hover:text-white transition-all"
                            onClick={() => handleVote(c.name)}
                            disabled={!!isVoting}
                        >
                            {isVoting === c.name ? <Loader2 className="animate-spin w-4 h-4" /> : "투표하기"}
                        </Button>
                    </div>
                ))}
                {candidates.length === 0 && (
                    <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                        <AlertCircle size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-sm text-slate-400">투표할 후보가 아직 없습니다.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
