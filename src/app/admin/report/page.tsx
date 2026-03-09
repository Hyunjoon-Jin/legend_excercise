"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { getActiveSeason, getDailyReportData, getRankings, getWeeklyStats } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { DailyCertificationCard } from "@/components/features/report/daily-certification-card";
import { RankingCard } from "@/components/features/report/ranking-card";
import { WeeklyStatsCard } from "@/components/features/report/weekly-stats-card";
import { ReportShareButton } from "@/components/features/report/report-share-button";

function AdminReportContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isAuthenticated } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    // URL ?date=YYYY-MM-DD 파라미터 있으면 그 날짜로, 없으면 오늘
    const initialDate = (() => {
        const param = searchParams.get("date");
        if (param) {
            const parsed = parseISO(param);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
    })();
    const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

    // Data states
    const [dailyLogs, setDailyLogs] = useState<any[]>([]);
    const [rankings, setRankings] = useState<any[]>([]);
    const [weeklyStats, setWeeklyStats] = useState<any[]>([]);

    // Week bounds based on selected date
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }); // Sunday

    // Refs for image generation
    const dailyRef = useRef<HTMLDivElement>(null);
    const rankingRef = useRef<HTMLDivElement>(null);
    const weeklyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'admin') {
            alert("관리자 권한이 필요합니다.");
            router.push("/");
            return;
        }

        const fetchReportData = async () => {
            setIsLoading(true);
            const { data: season } = await getActiveSeason();
            if (season) {
                const dateStr = format(selectedDate, "yyyy-MM-dd");
                const weekStartStr = format(weekStart, "yyyy-MM-dd");

                // Fetch all required data in parallel
                const [dailyRes, rankingRes, weeklyRes] = await Promise.all([
                    getDailyReportData(season.id, dateStr),
                    getRankings(season.id, dateStr),
                    // Only fetch stats up to the selected date to prevent future data bleeding into past reports
                    getWeeklyStats(season.id, weekStartStr, dateStr)
                ]);

                if (dailyRes.data) setDailyLogs(dailyRes.data);
                if (rankingRes.data) setRankings(rankingRes.data);
                if (weeklyRes.data) setWeeklyStats(weeklyRes.data);
            }
            setIsLoading(false);
        };

        fetchReportData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user, selectedDate, router]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        if (!isNaN(newDate.getTime())) {
            setSelectedDate(newDate);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft size={24} />
                    </Button>
                    <h1 className="text-xl font-bold text-slate-800">리포트 관리 (Admin)</h1>
                </div>
            </header>

            <main className="p-4 space-y-6 max-w-md mx-auto w-full">

                {/* Controls */}
                <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">리포트 기준 일자</label>
                        <input
                            type="date"
                            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-primary text-slate-700 font-medium"
                            value={format(selectedDate, "yyyy-MM-dd")}
                            max={format(new Date(), "yyyy-MM-dd")}
                            onChange={handleDateChange}
                        />
                    </div>
                </div>

                {/* Share Action */}
                <div className="sticky top-[72px] z-20">
                    <ReportShareButton
                        dailyRef={dailyRef}
                        rankingRef={rankingRef}
                        weeklyRef={weeklyRef}
                        date={selectedDate}
                        disabled={isLoading}
                    />
                </div>

                <div className="text-xs text-center text-slate-400 font-medium my-4">
                    아래 미리보기의 컴포넌트가 3장의 개별 사진으로 저장/공유됩니다.
                </div>

                {/* Report Previews */}
                <div className="space-y-8 overflow-hidden">
                    <div className="w-full overflow-x-auto pb-4">
                        <div className="scale-[0.4] origin-top-left" style={{ width: '800px', height: 'auto', marginBottom: '-55%' }}>
                            <DailyCertificationCard ref={dailyRef} date={selectedDate} logs={dailyLogs} />
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto pb-4">
                        <div className="scale-[0.4] origin-top-left" style={{ width: '800px', height: 'auto', marginBottom: '-55%' }}>
                            <RankingCard ref={rankingRef} date={selectedDate} rankings={rankings} />
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto pb-4">
                        <div className="scale-[0.4] origin-top-left" style={{ width: '800px', height: 'auto', marginBottom: '-55%' }}>
                            <WeeklyStatsCard ref={weeklyRef} startDate={weekStart} endDate={selectedDate} stats={weeklyStats} />
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}

export default function AdminReportPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">로딩 중...</div>}>
            <AdminReportContent />
        </Suspense>
    );
}
