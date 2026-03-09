import React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface WeeklyStatsCardProps {
    startDate: Date;
    endDate: Date;
    stats: any[];
}

export const WeeklyStatsCard = React.forwardRef<HTMLDivElement, WeeklyStatsCardProps>(
    ({ startDate, endDate, stats }, ref) => {
        const topStats = stats.slice(0, 10);
        const maxCount = topStats.length > 0 ? topStats[0].count : 1;
        const totalCount = stats.reduce((acc, curr) => acc + curr.count, 0);

        return (
            <div ref={ref} className="bg-white" style={{ width: '800px', padding: '24px' }}>
                <Card className="border shadow-lg bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
                    <CardHeader className="text-center pb-2 border-b border-emerald-100/50 bg-white/50 backdrop-blur-sm">
                        <Badge variant="secondary" className="mx-auto mb-2 text-emerald-600 bg-emerald-100">
                            Weekly Top Members
                        </Badge>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-2">
                            <Trophy className="text-emerald-500" size={28} />
                            {format(startDate, "M월 d일", { locale: ko })} ~ {format(endDate, "M월 d일", { locale: ko })} 주간 우수 회원
                        </h2>
                        <p className="text-slate-500 font-medium mt-1">
                            주간 총 <span className="text-emerald-600 font-bold">{totalCount}</span>회 인증 달성!
                        </p>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="space-y-4">
                            {topStats.length > 0 ? topStats.map((stat: any, idx: number) => {
                                const name = stat.profile?.display_name || stat.profile?.username || '알 수 없음';
                                const widthPercent = (stat.count / maxCount) * 100;
                                return (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className="w-8 font-black text-slate-400 text-right">
                                            {idx + 1}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden relative flex-shrink-0">
                                            {stat.profile?.avatar_url ? (
                                                <img
                                                    src={stat.profile.avatar_url}
                                                    alt="Avatar"
                                                    className="object-cover w-full h-full"
                                                    crossOrigin="anonymous"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-sm">
                                                    {name[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 relative h-10 bg-slate-100 rounded-lg overflow-hidden flex items-center">
                                            <div
                                                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all rounded-r-lg"
                                                style={{ width: `${widthPercent}%` }}
                                            />
                                            <div className="relative z-10 px-3 flex justify-between w-full font-bold">
                                                <span className="text-slate-800 drop-shadow-sm">{name}</span>
                                                <span className="text-slate-800 drop-shadow-sm">{stat.count}회</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="py-10 text-center text-slate-400 font-medium">
                                    이번 주 인증 기록이 없습니다.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
);

WeeklyStatsCard.displayName = "WeeklyStatsCard";
