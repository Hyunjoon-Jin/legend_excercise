import React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";

interface RankingCardProps {
    date: Date;
    rankings: any[];
}

export const RankingCard = React.forwardRef<HTMLDivElement, RankingCardProps>(
    ({ date, rankings }, ref) => {
        // Only show top 10 for the report image to keep it concise, or all if preferred
        const displayRankings = rankings.slice(0, 10);

        return (
            <div ref={ref} className="bg-white" style={{ width: '800px', padding: '24px' }}>
                <Card className="border shadow-lg bg-gradient-to-br from-amber-50 to-white overflow-hidden">
                    <CardHeader className="text-center pb-2 border-b border-amber-100/50 bg-white/50 backdrop-blur-sm">
                        <Badge variant="secondary" className="mx-auto mb-2 text-amber-600 bg-amber-100">
                            Season Ranking
                        </Badge>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-2">
                            <Trophy className="text-amber-500" size={28} />
                            {format(date, "M월 d일 기준 실시간 순위", { locale: ko })}
                        </h2>
                    </CardHeader>
                    <CardContent className="p-6">
                        {displayRankings.length > 0 ? (
                            <div className="space-y-3">
                                {displayRankings.map((user, idx) => {
                                    const isTop3 = idx < 3;
                                    return (
                                        <div key={user.userId} className={`flex items-center justify-between p-4 rounded-xl border ${isTop3 ? 'bg-gradient-to-r from-amber-50 to-white border-amber-200' : 'bg-white border-slate-100'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${idx === 0 ? 'bg-yellow-400 text-white shadow-md' :
                                                    idx === 1 ? 'bg-slate-300 text-white shadow-md' :
                                                        idx === 2 ? 'bg-amber-600 text-white shadow-md' :
                                                            'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800 text-lg">{user.name}</span>
                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-200 text-slate-500">
                                                            {user.tier}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        인증 {user.logCount}회 · 득표 {user.voteCount}표
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-black text-slate-800">
                                                    {user.totalScore.toFixed(1)}<span className="text-sm font-bold text-slate-400 ml-1">점</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 flex gap-2 justify-end mt-1">
                                                    <span>운동 {user.workoutPoints.toFixed(1)}</span>
                                                    <span>인기 {user.mvpPoints.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-20 text-center text-slate-400">
                                아직 랭킹 데이터가 없습니다.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }
);

RankingCard.displayName = "RankingCard";
