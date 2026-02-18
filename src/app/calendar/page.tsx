"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    eachDayOfInterval
} from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getWorkoutLogs, getActiveSeason } from "@/lib/data";
import { WorkoutLog } from "@/types/database";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function CalendarPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        const fetchLogs = async () => {
            setIsLoading(true);
            const { data: season } = await getActiveSeason();
            if (season) {
                const { data: logData } = await getWorkoutLogs(season.id);
                if (logData) {
                    // Filter logs for the current user
                    setLogs(logData.filter(l => l.user_id === user?.id && l.status === 'approved'));
                }
            }
            setIsLoading(false);
        };

        fetchLogs();
    }, [isAuthenticated, router, user]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth)),
        end: endOfWeek(endOfMonth(currentMonth)),
    });

    const selectedDayLogs = logs.filter(log =>
        isSameDay(new Date(log.workout_date), selectedDate)
    );

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-10">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft size={24} />
                    </Button>
                    <h1 className="text-xl font-bold text-primary">운동 캘린더</h1>
                </div>
            </header>

            <main className="p-6 space-y-6">
                {/* Calendar Card */}
                <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-0">
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-50">
                            <span className="text-lg font-bold text-primary">
                                {format(currentMonth, "yyyy년 M월", { locale: ko })}
                            </span>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                                    <ChevronLeft size={18} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                                    <ChevronRight size={18} />
                                </Button>
                            </div>
                        </div>

                        {/* Days of Week */}
                        <div className="grid grid-cols-7 border-b border-slate-50">
                            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                                <div key={day} className="py-3 text-center text-xs font-bold text-slate-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 bg-slate-50 gap-[1px]">
                            {days.map((day, i) => {
                                const hasLog = logs.some(log => isSameDay(new Date(log.workout_date), day));
                                const isSelected = isSameDay(day, selectedDate);
                                const isCurrentMonth = isSameMonth(day, currentMonth);

                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedDate(day)}
                                        className={cn(
                                            "aspect-square flex flex-col items-center justify-center bg-white p-1 relative transition-all",
                                            !isCurrentMonth && "text-slate-300",
                                            isSelected && "ring-2 ring-primary ring-inset z-10"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-sm font-medium mb-1",
                                            isSelected && "text-primary font-bold"
                                        )}>
                                            {format(day, "d")}
                                        </span>
                                        {hasLog && (
                                            <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Selected Day Details */}
                <section className="space-y-4">
                    <h3 className="font-bold text-primary">
                        {format(selectedDate, "M월 d일 (EEEE)", { locale: ko })}
                    </h3>

                    <div className="space-y-3">
                        {selectedDayLogs.length > 0 ? (
                            selectedDayLogs.map((log) => (
                                <div key={log.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-accent">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-primary">
                                                {log.workout_type === 'gym' ? '운동완료' :
                                                    log.workout_type === 'running' ? '러닝' :
                                                        log.workout_type === 'walking' ? '걷기' :
                                                            log.workout_type === 'yoga' ? '요가' : '스포츠'}
                                            </p>
                                            <p className="text-xs text-slate-400">{log.duration_minutes}분 완료</p>
                                        </div>
                                    </div>
                                    <Badge variant="success" className="bg-green-50 text-green-600 border-none">인증완료</Badge>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400">등록된 운동 기록이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>
            <BottomNav />
        </div>
    );
}
