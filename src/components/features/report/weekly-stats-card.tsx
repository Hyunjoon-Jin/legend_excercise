import React from "react";
import { format, formatISO, parseISO, getDay } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";

interface WeeklyStatsCardProps {
    startDate: Date;
    endDate: Date;
    stats: Record<string, number>;
}

export const WeeklyStatsCard = React.forwardRef<HTMLDivElement, WeeklyStatsCardProps>(
    ({ startDate, endDate, stats }, ref) => {
        // Week days arrays
        const days = ["일", "월", "화", "수", "목", "금", "토"];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // 0=Sun, 1=Mon, ...
        let totalCount = 0;

        Object.entries(stats).forEach(([dateStr, count]) => {
            const date = parseISO(dateStr);
            const dayIdx = getDay(date);
            dayCounts[dayIdx] += count;
            totalCount += count;
        });

        const maxCount = Math.max(...dayCounts, 1);

        return (
            <div ref={ref} className="bg-white" style={{ width: '800px', padding: '24px' }}>
                <Card className="border shadow-lg bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
                    <CardHeader className="text-center pb-2 border-b border-emerald-100/50 bg-white/50 backdrop-blur-sm">
                        <Badge variant="secondary" className="mx-auto mb-2 text-emerald-600 bg-emerald-100">
                            Weekly Report
                        </Badge>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-2">
                            <BarChart3 className="text-emerald-500" size={28} />
                            {format(startDate, "M월 d일", { locale: ko })} ~ {format(endDate, "M월 d일", { locale: ko })} 주간 통계
                        </h2>
                        <p className="text-slate-500 font-medium mt-1">
                            이번 주 총 <span className="text-emerald-600 font-bold">{totalCount}</span>회 인증 달성!
                        </p>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="flex h-64 items-end justify-between gap-4 pt-10">
                            {/* Display starting from Monday to Sunday */}
                            {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                                const count = dayCounts[dayIdx];
                                const heightPercent = (count / maxCount) * 100;

                                return (
                                    <div key={dayIdx} className="flex-1 flex flex-col items-center gap-3">
                                        <div className="font-bold text-slate-600 mb-1">
                                            {count > 0 ? `${count}회` : ''}
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-t-lg relative flex-1 flex items-end overflow-hidden">
                                            <div
                                                className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg transition-all"
                                                style={{ height: `${heightPercent}%` }}
                                            />
                                        </div>
                                        <div className={`font-bold text-sm ${dayIdx === 0 ? 'text-red-500' : dayIdx === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                                            {days[dayIdx]}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
);

WeeklyStatsCard.displayName = "WeeklyStatsCard";
