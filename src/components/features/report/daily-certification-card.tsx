import React from "react";
import Image from "next/image";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DailyReportCardProps {
    date: Date;
    logs: any[];
}

export const DailyCertificationCard = React.forwardRef<HTMLDivElement, DailyReportCardProps>(
    ({ date, logs }, ref) => {
        return (
            <div ref={ref} className="bg-white" style={{ width: '800px', padding: '24px' }}>
                <Card className="border shadow-lg bg-gradient-to-br from-indigo-50 to-white overflow-hidden">
                    <CardHeader className="text-center pb-2 border-b border-indigo-100/50 bg-white/50 backdrop-blur-sm">
                        <Badge variant="secondary" className="mx-auto mb-2 text-indigo-600 bg-indigo-100">
                            Daily Report
                        </Badge>
                        <h2 className="text-2xl font-black text-slate-800">
                            {format(date, "yyyy년 M월 d일 (EEEE) 인증 리포트", { locale: ko })}
                        </h2>
                        <p className="text-slate-500 font-medium mt-1">
                            총 <span className="text-indigo-600 font-bold">{logs.length}</span>명 인증 완료
                        </p>
                    </CardHeader>
                    <CardContent className="p-6">
                        {logs.length > 0 ? (
                            <div className="grid grid-cols-3 gap-4">
                                {logs.map((log) => (
                                    <div key={log.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                                        <div className="h-40 w-full relative bg-slate-100">
                                            {log.proof_image_url && log.proof_image_url !== 'admin-registered' ? (
                                                <Image
                                                    src={log.proof_image_url}
                                                    alt="Workout Proof"
                                                    fill
                                                    className="object-cover"
                                                    crossOrigin="anonymous"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                                    <span className="text-sm font-medium">사진 없음</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden relative flex-shrink-0">
                                                {log.profiles?.avatar_url ? (
                                                    <Image
                                                        src={log.profiles.avatar_url}
                                                        alt="Avatar"
                                                        fill
                                                        className="object-cover"
                                                        crossOrigin="anonymous"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-sm">
                                                        {log.profiles?.username?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                                                        {log.profiles?.tier || 'Bronze'}
                                                    </span>
                                                    <p className="font-bold text-slate-800 text-sm truncate">
                                                        {log.profiles?.display_name || log.profiles?.username}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                                                    {log.workout_type === 'gym' ? '헬스장' :
                                                        log.workout_type === 'running' ? '러닝' :
                                                            log.workout_type === 'walking' ? '걷기' :
                                                                log.workout_type === 'yoga' ? '요가/필라테스' : '스포츠'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <p className="text-slate-400 font-medium">이 날짜에 승인된 인증 기록이 없습니다.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }
);

DailyCertificationCard.displayName = "DailyCertificationCard";
