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
import { ChevronLeft, UserPlus, Save, Loader2, Calendar as CalendarIcon, Users, CalendarDays, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveSeason, submitWorkoutLog, createMember } from "@/lib/data";
import { Profile, Season } from "@/types/database";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function AdminPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    // Navigation & Tabs
    const [activeTab, setActiveTab] = useState<'by-date' | 'by-member' | 'manage'>('by-date');

    // Common State
    const [activeSeason, setActiveSeason] = useState<Season | null>(null);
    const [members, setMembers] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Workflow 1: By Date
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [dateLogForm, setDateLogForm] = useState({
        userId: "",
        type: "gym" as any,
        duration: "60",
        comment: ""
    });

    // Workflow 2: By Member
    const [selectedMemberId, setSelectedMemberId] = useState<string>("");
    const [memberSelectedDate, setMemberSelectedDate] = useState<Date | undefined>(new Date());
    const [memberLogForm, setMemberLogForm] = useState({
        type: "gym" as any,
        duration: "60",
        comment: ""
    });

    // New Member State
    const [newMemberName, setNewMemberName] = useState<string>("");
    const [isCreatingMember, setIsCreatingMember] = useState(false);

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

    const handleRegisterByDate = async () => {
        if (!dateLogForm.userId || !activeSeason) {
            alert("회원을 선택해 주세요.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await submitWorkoutLog({
                user_id: dateLogForm.userId,
                season_id: activeSeason.id,
                workout_date: format(selectedDate, 'yyyy-MM-dd'),
                workout_type: dateLogForm.type,
                duration_minutes: parseInt(dateLogForm.duration),
                proof_image_url: "admin-registered",
                comment: dateLogForm.comment || `${format(selectedDate, 'MM/dd')} 일자별 직접 등록`,
            });

            if (error) throw error;
            alert("운동 기록이 등록되었습니다.");
            setDateLogForm(prev => ({ ...prev, userId: "" }));
        } catch (err: any) {
            alert("등록 중 오류: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegisterByMember = async () => {
        if (!selectedMemberId || !memberSelectedDate || !activeSeason) {
            alert("회원과 날짜를 선택해 주세요.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await submitWorkoutLog({
                user_id: selectedMemberId,
                season_id: activeSeason.id,
                workout_date: format(memberSelectedDate, 'yyyy-MM-dd'),
                workout_type: memberLogForm.type,
                duration_minutes: parseInt(memberLogForm.duration),
                proof_image_url: "admin-registered",
                comment: memberLogForm.comment || "회원별 캘린더 직접 등록",
            });

            if (error) throw error;
            alert("운동 기록이 등록되었습니다.");
            setMemberSelectedDate(undefined);
        } catch (err: any) {
            alert("등록 중 오류: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateMember = async () => {
        if (!newMemberName) {
            alert("회원 이름을 입력해 주세요.");
            return;
        }

        setIsCreatingMember(true);
        try {
            const { error } = await createMember(newMemberName);
            if (error) throw error;

            alert(`신규 회원 [${newMemberName}]님이 등록되었습니다.`);
            setNewMemberName("");

            const { data } = await supabase.from('profiles').select('*').order('username');
            if (data) setMembers(data);
        } catch (err: any) {
            alert("회원 등록 오류: " + err.message);
        } finally {
            setIsCreatingMember(false);
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
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ChevronLeft size={20} />
                    </Button>
                    <h1 className="text-lg font-bold text-primary">관리자 메뉴</h1>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('by-date')}
                        className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeTab === 'by-date' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                    >
                        일자별
                    </button>
                    <button
                        onClick={() => setActiveTab('by-member')}
                        className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeTab === 'by-member' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                    >
                        회원별
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeTab === 'manage' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                    >
                        회원관리
                    </button>
                </div>
            </header>

            <main className="p-5 space-y-6">
                {/* Workflow 1: By Date */}
                {activeTab === 'by-date' && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <CalendarDays size={20} className="text-slate-400" />
                            <h2 className="text-md font-bold">일자별 일괄 등록</h2>
                        </div>
                        <Card className="border-none shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="h-9 gap-2 px-3 border-none bg-white font-bold">
                                                {format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })}
                                                <CalendarIcon size={14} className="text-accent" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={selectedDate}
                                                onSelect={(date) => date && setSelectedDate(date)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <span className="text-slate-400">운동 기록 추가</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 space-y-5 bg-white">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500">회원 선택</Label>
                                    <Select onValueChange={(v) => setDateLogForm({ ...dateLogForm, userId: v })} value={dateLogForm.userId}>
                                        <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none">
                                            <SelectValue placeholder="누구가 운동했나요?" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {members.map((m) => (
                                                <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="hidden">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500">운동 종류</Label>
                                        <Select onValueChange={(v) => setDateLogForm({ ...dateLogForm, type: v as any })} value={dateLogForm.type}>
                                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none">
                                                <SelectValue />
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
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500">시간 (분)</Label>
                                        <Input
                                            type="number"
                                            value={dateLogForm.duration}
                                            onChange={(e) => setDateLogForm({ ...dateLogForm, duration: e.target.value })}
                                            className="h-12 rounded-xl bg-slate-50 border-none"
                                        />
                                    </div>
                                </div>
                                <div className="text-center py-1">
                                    <p className="text-[10px] text-slate-400">기본값(헬스/60분)으로 자동 등록됩니다.</p>
                                </div>
                                <Button
                                    onClick={handleRegisterByDate}
                                    className="w-full h-12 rounded-xl font-bold gap-2 text-sm shadow-md"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                                    운동 기록 저장
                                </Button>
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* Workflow 2: By Member */}
                {activeTab === 'by-member' && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Users size={20} className="text-slate-400" />
                            <h2 className="text-md font-bold">회원별 지정 등록</h2>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-500 px-1">대상 회원 선택</Label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {members.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMemberId(m.id)}
                                        className={cn(
                                            "flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all border",
                                            selectedMemberId === m.id
                                                ? "bg-primary text-white border-primary shadow-md"
                                                : "bg-white text-slate-600 border-slate-100"
                                        )}
                                    >
                                        {m.username}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedMemberId && (
                            <Card className="border-none shadow-sm overflow-hidden bg-white">
                                <CardHeader className="py-4 border-b border-slate-50">
                                    <CardTitle className="text-sm font-bold text-slate-700">
                                        날짜를 클릭하여 등록하세요
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="flex justify-center p-2">
                                        <Calendar
                                            mode="single"
                                            selected={memberSelectedDate}
                                            onSelect={setMemberSelectedDate}
                                            className="rounded-md border-none"
                                        />
                                    </div>

                                    {memberSelectedDate && (
                                        <div className="p-5 border-t border-slate-50 bg-slate-50/50 space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <CheckCircle2 size={16} className="text-success" />
                                                <span className="text-sm font-bold text-primary">
                                                    {format(memberSelectedDate, "MM월 dd일")} 기록 설정
                                                </span>
                                            </div>
                                            <div className="hidden">
                                                <Select onValueChange={(v) => setMemberLogForm({ ...memberLogForm, type: v as any })} value={memberLogForm.type}>
                                                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-100">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="running">러닝</SelectItem>
                                                        <SelectItem value="gym">헬스/홈트</SelectItem>
                                                        <SelectItem value="walking">걷기/산책</SelectItem>
                                                        <SelectItem value="yoga">요가/필라테스</SelectItem>
                                                        <SelectItem value="sports">기타 스포츠</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    type="number"
                                                    value={memberLogForm.duration}
                                                    onChange={(e) => setMemberLogForm({ ...memberLogForm, duration: e.target.value })}
                                                    className="h-11 rounded-xl bg-white border-slate-100"
                                                />
                                            </div>
                                            <div className="text-center py-1">
                                                <p className="text-[10px] text-slate-400">기본값(헬스/60분)으로 자동 등록됩니다.</p>
                                            </div>
                                            <Button
                                                onClick={handleRegisterByMember}
                                                className="w-full h-11 rounded-xl bg-slate-800 text-sm font-bold"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "선택 일자에 저장"}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </section>
                )}

                {/* Workflow 3: Member Management */}
                {activeTab === 'manage' && (
                    <div className="space-y-6">
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <UserPlus size={20} className="text-accent" />
                                <h2 className="text-md font-bold">신규 회원 추가</h2>
                            </div>
                            <Card className="border-none shadow-sm bg-white">
                                <CardContent className="p-6">
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500">회원 이름 (로그인 이름)</Label>
                                            <Input
                                                placeholder="이름 입력"
                                                value={newMemberName}
                                                onChange={(e) => setNewMemberName(e.target.value)}
                                                className="h-12 rounded-xl bg-slate-50 border-none"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400">
                                            ※ 초기 비밀번호는 <span className="text-primary font-bold">1234</span>로 자동 설정됩니다.
                                        </p>
                                        <Button
                                            onClick={handleCreateMember}
                                            className="w-full h-12 rounded-xl text-sm font-bold bg-slate-800"
                                            disabled={isCreatingMember}
                                        >
                                            {isCreatingMember ? <Loader2 className="w-5 h-5 animate-spin" /> : "회원 등록하기"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-md font-bold text-primary">전체 회원 목록 ({members.length})</h2>
                            <div className="grid grid-cols-1 gap-3">
                                {members.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50 transition-all active:scale-[0.98]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-bold text-slate-300 border border-slate-100">
                                                {m.username[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-primary">{m.username}</p>
                                                <p className="text-[10px] text-slate-400">{m.role === 'admin' ? '관리자' : '일반회원'} · {m.tier}</p>
                                            </div>
                                        </div>
                                        <button className="text-[10px] text-slate-400 font-bold hover:text-primary transition-colors">
                                            상세정보
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}
