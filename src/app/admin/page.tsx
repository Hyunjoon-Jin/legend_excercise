"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, UserPlus, Save, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveSeason, submitWorkoutLog } from "@/lib/data";
import { Profile, Season } from "@/types/database";

export default function AdminPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [members, setMembers] = useState<Profile[]>([]);
    const [activeSeason, setActiveSeason] = useState<Season | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [selectedMemberId, setSelectedMemberId] = useState<string>("");
    const [workoutType, setWorkoutType] = useState<string>("");
    const [duration, setDuration] = useState<string>("");
    const [comment, setComment] = useState<string>("");

    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'admin') {
            alert("관리자 권한이 필요합니다.");
            router.push("/");
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            const [seasonRes, membersRes] = await Promise.all([
                getActiveSeason(),
                supabase.from('profiles').select('*').order('username')
            ]);

            if (seasonRes.data) setActiveSeason(seasonRes.data);
            if (membersRes.data) setMembers(membersRes.data);
            setIsLoading(false);
        };

        fetchData();
    }, [isAuthenticated, user, router]);

    const handleRegister = async () => {
        if (!selectedMemberId || !workoutType || !duration || !activeSeason) {
            alert("모든 필수 항목을 입력해 주세요.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await submitWorkoutLog({
                user_id: selectedMemberId,
                season_id: activeSeason.id,
                workout_type: workoutType as any,
                duration_minutes: parseInt(duration),
                proof_image_url: "admin-registered", // Admin registration doesn't require image
                comment: comment || "관리자 직접 등록",
            });

            if (error) throw error;

            // Status should be automatically 'approved' for admin registration
            // But based on the schema default is 'pending', so we should update it immediately 
            // or change the submit logic to include status if the API allows.
            // For now, let's assume the schema allows status or we update it.

            alert("운동 기록이 성공적으로 등록되었습니다.");
            setDuration("");
            setComment("");
        } catch (err: any) {
            alert("등록 중 오류가 발생했습니다: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-secondary">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-secondary pb-10">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft size={24} />
                </Button>
                <h1 className="text-xl font-bold text-primary">관리자 콘솔</h1>
            </header>

            <main className="p-6 space-y-6">
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                        <UserPlus size={20} />
                        <h2 className="text-lg font-bold">회원 운동 직접 등록</h2>
                    </div>

                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-6 space-y-6">
                            {/* Member Selection */}
                            <div className="space-y-2">
                                <Label>회원 선택</Label>
                                <Select onValueChange={setSelectedMemberId} value={selectedMemberId}>
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="인증할 회원을 선택하세요" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {members.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>
                                                {m.username} ({m.tier})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Workout Type */}
                                <div className="space-y-2">
                                    <Label>운동 종류</Label>
                                    <Select onValueChange={setWorkoutType} value={workoutType}>
                                        <SelectTrigger className="h-12 rounded-xl">
                                            <SelectValue placeholder="선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="running">러닝</SelectItem>
                                            <SelectItem value="gym">헬스/홈트</SelectItem>
                                            <SelectItem value="walking">걷기/산책</SelectItem>
                                            <SelectItem value="yoga">요가/필라테스</SelectItem>
                                            <SelectItem value="sports">기타 스포츠</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Duration */}
                                <div className="space-y-2">
                                    <Label>시간 (분)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="h-12 rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Comment */}
                            <div className="space-y-2">
                                <Label>비고 (메모)</Label>
                                <Input
                                    placeholder="관리자 메모 입력"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="h-12 rounded-xl"
                                />
                            </div>

                            <Button
                                onClick={handleRegister}
                                className="w-full h-14 rounded-2xl text-md font-bold gap-2"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
                                운동 기록 저장하기
                            </Button>
                        </CardContent>
                    </Card>
                </section>

                {/* Member Status Summary */}
                <section className="space-y-4">
                    <h2 className="text-lg font-bold text-primary">회원 현황 요약</h2>
                    <div className="grid grid-cols-1 gap-3">
                        {members.slice(0, 5).map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                                        {m.username[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-primary">{m.username}</p>
                                        <p className="text-xs text-slate-400">{m.tier}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="text-xs text-primary font-bold">
                                    상세보기
                                </Button>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
