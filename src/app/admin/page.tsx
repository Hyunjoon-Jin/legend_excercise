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
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, UserPlus, Save, Loader2, Calendar as CalendarIcon, Users, CalendarDays, CheckCircle2, PlusCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getActiveSeason, submitWorkoutLog, createMember, createSeason, getAllSeasons, toggleSeasonActive } from "@/lib/data";
import { Profile, Season, WorkoutLog } from "@/types/database";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function AdminPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    // Navigation & Tabs
    const [activeTab, setActiveTab] = useState<'by-date' | 'by-member' | 'manage' | 'seasons' | 'cert-logs'>('by-date');

    // Common State
    const [activeSeason, setActiveSeason] = useState<Season | null>(null);
    const [members, setMembers] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Workflow 1: By Date
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [dateLogForm, setDateLogForm] = useState({
        userIds: [] as string[],
        type: "gym" as any,
        duration: "60",
        comment: ""
    });
    const [existingLogUserIds, setExistingLogUserIds] = useState<string[]>([]);

    // Workflow 2: By Member
    const [selectedMemberId, setSelectedMemberId] = useState<string>("");
    const [memberLogs, setMemberLogs] = useState<WorkoutLog[]>([]);
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [datesToAdd, setDatesToAdd] = useState<Date[]>([]);
    const [datesToDelete, setDatesToDelete] = useState<string[]>([]); // workout_date strings
    const [memberLogForm, setMemberLogForm] = useState({
        type: "gym" as any,
        duration: "60",
        comment: ""
    });

    // Workflow 4: Season Management
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [newSeasonForm, setNewSeasonForm] = useState({
        name: "",
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd')
    });
    const [isCreatingSeason, setIsCreatingSeason] = useState(false);

    // New Member State
    const [newMemberName, setNewMemberName] = useState<string>("");
    const [isCreatingMember, setIsCreatingMember] = useState(false);

    // Workflow 5: Certification Management
    const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
    const [expandedMemberLogs, setExpandedMemberLogs] = useState<WorkoutLog[]>([]);
    const [isFetchingMemberDetail, setIsFetchingMemberDetail] = useState(false);

    // Season Management State
    const [burningDates, setBurningDates] = useState({
        start: "",
        end: ""
    });

    useEffect(() => {
        if (activeSeason) {
            setBurningDates({
                start: activeSeason.burning_start_date || "",
                end: activeSeason.burning_end_date || ""
            });
        }
    }, [activeSeason]);

    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'admin') {
            alert("관리자 권한이 필요합니다.");
            router.push("/");
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            const [seasonRes, membersRes, allSeasonsRes] = await Promise.all([
                getActiveSeason(),
                supabase.from('profiles').select('*').order('username'),
                getAllSeasons()
            ]);

            if (seasonRes.data) setActiveSeason(seasonRes.data);
            if (membersRes.data) setMembers(membersRes.data);
            if (allSeasonsRes.data) setSeasons(allSeasonsRes.data);
            setIsLoading(false);
        };

        fetchData();
    }, [isAuthenticated, user, router]);

    // Fetch existing logs for selected date
    useEffect(() => {
        if (!activeSeason || activeTab !== 'by-date') return;

        const fetchExistingLogs = async () => {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const { data } = await supabase
                .from('workout_logs')
                .select('user_id')
                .eq('season_id', activeSeason.id)
                .eq('workout_date', dateStr)
                .eq('status', 'approved');

            if (data) {
                setExistingLogUserIds(data.map((log: any) => log.user_id));
            } else {
                setExistingLogUserIds([]);
            }
        };

        fetchExistingLogs();
    }, [selectedDate, activeSeason, activeTab]);

    // Fetch logs when selected member changes
    useEffect(() => {
        if (selectedMemberId && activeSeason) {
            const fetchMemberLogs = async () => {
                const { data } = await supabase
                    .from('workout_logs')
                    .select('*')
                    .eq('user_id', selectedMemberId)
                    .eq('season_id', activeSeason.id)
                    .eq('status', 'approved');
                if (data) setMemberLogs(data);
                setDatesToAdd([]);
                setDatesToDelete([]);
            };
            fetchMemberLogs();
        }
    }, [selectedMemberId, activeSeason]);

    const handleRegisterByDate = async () => {
        if (!activeSeason) {
            alert("활성화된 시즌이 없습니다. 시즌 설정 탭에서 시즌을 먼저 생성하고 활성화해 주세요.");
            return;
        }

        if (dateLogForm.userIds.length === 0) {
            alert("최소 한 명 이상의 회원을 선택해 주세요.");
            return;
        }

        setIsSubmitting(true);
        try {
            const logsToInsert = dateLogForm.userIds.map(uid => ({
                user_id: uid,
                season_id: activeSeason.id,
                workout_date: format(selectedDate, 'yyyy-MM-dd'),
                workout_type: dateLogForm.type,
                duration_minutes: parseInt(dateLogForm.duration),
                proof_image_url: "admin-registered",
                status: 'approved',
                comment: dateLogForm.comment || `${format(selectedDate, 'MM/dd')} 관리자 일괄 등록`,
            }));

            const { error } = await supabase.from('workout_logs').insert(logsToInsert);

            if (error) throw error;
            alert(`${dateLogForm.userIds.length}명의 회원이 등록되었습니다.`);
            setDateLogForm(prev => ({ ...prev, userIds: [] }));
        } catch (err: any) {
            alert("등록 중 오류: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Logic to ensure admin profile exists
    useEffect(() => {
        if (isAuthenticated && user?.username === "진현준") {
            const checkAdmin = async () => {
                const { data: profiles } = await supabase.from('profiles').select('id').eq('username', '진현준');
                if (profiles && profiles.length === 0) {
                    await createMember("진현준", "진현준", 'admin');
                    const { data } = await supabase.from('profiles').select('*').order('username');
                    if (data) setMembers(data);
                }
            };
            checkAdmin();
        }
    }, [isAuthenticated, user]);

    const handleBatchUpdate = async () => {
        if (!selectedMemberId || !activeSeason) return;
        if (datesToAdd.length === 0 && datesToDelete.length === 0) {
            alert("변경할 내용이 없습니다.");
            return;
        }

        const confirmMsg = `${datesToAdd.length}일 추가, ${datesToDelete.length}일 삭제하시겠습니까?`;
        if (!confirm(confirmMsg)) return;

        setIsSubmitting(true);
        try {
            // 1. Deletions
            if (datesToDelete.length > 0) {
                const { error } = await supabase
                    .from('workout_logs')
                    .delete()
                    .eq('user_id', selectedMemberId)
                    .eq('season_id', activeSeason.id)
                    .in('workout_date', datesToDelete);
                if (error) throw error;
            }

            // 2. Additions
            if (datesToAdd.length > 0) {
                const logsToInsert = datesToAdd.map(date => ({
                    user_id: selectedMemberId,
                    season_id: activeSeason.id,
                    workout_date: format(date, 'yyyy-MM-dd'),
                    workout_type: memberLogForm.type,
                    duration_minutes: parseInt(memberLogForm.duration),
                    proof_image_url: "admin-registered",
                    status: 'approved',
                    comment: memberLogForm.comment || "관리자 일괄 등록"
                }));

                const { error } = await supabase.from('workout_logs').insert(logsToInsert);
                if (error) throw error;
            }

            alert("기록이 성공적으로 반영되었습니다.");

            // Refresh logs
            const { data } = await supabase
                .from('workout_logs')
                .select('*')
                .eq('user_id', selectedMemberId)
                .eq('season_id', activeSeason.id)
                .eq('status', 'approved');
            if (data) setMemberLogs(data);

            setDatesToAdd([]);
            setDatesToDelete([]);
        } catch (err: any) {
            alert("저장 중 오류가 발생했습니다: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const hasLog = memberLogs.some(l => l.workout_date === dateStr);

        if (hasLog) {
            // Toggle for deletion
            setDatesToDelete(prev =>
                prev.includes(dateStr)
                    ? prev.filter(d => d !== dateStr)
                    : [...prev, dateStr]
            );
        } else {
            // Toggle for addition
            setDatesToAdd(prev =>
                prev.some(d => format(d, 'yyyy-MM-dd') === dateStr)
                    ? prev.filter(d => format(d, 'yyyy-MM-dd') !== dateStr)
                    : [...prev, date]
            );
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

    const handleUpdateSeason = async () => {
        if (!activeSeason) {
            alert("활성화된 시즌이 없습니다. 시즌을 먼저 생성해주세요.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('seasons')
                .update({
                    burning_start_date: burningDates.start || null,
                    burning_end_date: burningDates.end || null
                })
                .eq('id', activeSeason.id);

            if (error) throw error;
            alert(`🔥 버닝 기간 설정이 완료되었습니다!\n기간: ${burningDates.start} ~ ${burningDates.end}`);

            // Refresh season
            const { data } = await getActiveSeason();
            if (data) setActiveSeason(data);
        } catch (err: any) {
            alert("업데이트 중 오류: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateSeason = async () => {
        if (!newSeasonForm.name || !newSeasonForm.start_date || !newSeasonForm.end_date) {
            alert("모든 필드를 입력해 주세요.");
            return;
        }

        setIsCreatingSeason(true);
        try {
            const { data, error } = await createSeason(newSeasonForm);
            if (error) throw error;
            alert(`✅ 시즌 '${data.name}'이 생성되었습니다.`);
            setNewSeasonForm({
                name: "",
                start_date: format(new Date(), 'yyyy-MM-dd'),
                end_date: format(new Date(), 'yyyy-MM-dd')
            });
            // Refresh
            const { data: allSeasons } = await getAllSeasons();
            if (allSeasons) setSeasons(allSeasons);
        } catch (err: any) {
            alert("생성 중 오류: " + err.message);
        } finally {
            setIsCreatingSeason(false);
        }
    };

    const handleToggleSeason = async (id: string, name: string) => {
        if (!confirm(`'${name}' 시즌을 활성화하시겠습니까? 다른 시즌은 비활성화됩니다.`)) return;

        setIsSubmitting(true);
        try {
            const { error } = await toggleSeasonActive(id);
            if (error) throw error;
            alert(`🚀 '${name}' 시즌이 활성화되었습니다.`);
            // Refresh
            const [seasonRes, allSeasonsRes] = await Promise.all([
                getActiveSeason(),
                getAllSeasons()
            ]);
            if (seasonRes.data) setActiveSeason(seasonRes.data);
            if (allSeasonsRes.data) setSeasons(allSeasonsRes.data);
        } catch (err: any) {
            alert("전환 중 오류: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleMemberExpand = async (memberId: string) => {
        if (expandedMemberId === memberId) {
            setExpandedMemberId(null);
            return;
        }

        setExpandedMemberId(memberId);
        if (!activeSeason) return;

        setIsFetchingMemberDetail(true);
        try {
            const { data } = await supabase
                .from('workout_logs')
                .select('*')
                .eq('user_id', memberId)
                .eq('season_id', activeSeason.id)
                .order('workout_date', { ascending: false });

            if (data) setExpandedMemberLogs(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsFetchingMemberDetail(false);
        }
    };

    const handleDeleteRecord = async (logId: string) => {
        if (!confirm("이 운동 기록을 삭제하시겠습니까?")) return;

        try {
            const { error } = await supabase
                .from('workout_logs')
                .delete()
                .eq('id', logId);

            if (error) throw error;

            alert("기록이 삭제되었습니다.");
            // Refresh expanded logs
            if (expandedMemberId) {
                const { data } = await supabase
                    .from('workout_logs')
                    .select('*')
                    .eq('user_id', expandedMemberId)
                    .eq('season_id', activeSeason?.id)
                    .order('workout_date', { ascending: false });
                if (data) setExpandedMemberLogs(data);
            }
        } catch (err: any) {
            alert("삭제 오류: " + err.message);
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
                    <button
                        onClick={() => setActiveTab('cert-logs')}
                        className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeTab === 'cert-logs' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                    >
                        인증관리
                    </button>
                    <button
                        onClick={() => setActiveTab('seasons')}
                        className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeTab === 'seasons' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                    >
                        시즌관리
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
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <Label className="text-xs font-bold text-slate-500">회원 선택 (복수 선택 가능)</Label>
                                        <button
                                            onClick={() => {
                                                const allIds = members.map(m => m.id);
                                                setDateLogForm(prev => ({
                                                    ...prev,
                                                    userIds: prev.userIds.length === allIds.length ? [] : allIds
                                                }));
                                            }}
                                            className="text-[10px] font-bold text-accent hover:underline"
                                        >
                                            {dateLogForm.userIds.length === members.length ? "전체 해제" : "전체 선택"}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 scrollbar-hide">
                                        {members.map((m) => {
                                            const isSelected = dateLogForm.userIds.includes(m.id);
                                            const isAlreadyRegistered = existingLogUserIds.includes(m.id);
                                            return (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        setDateLogForm(prev => ({
                                                            ...prev,
                                                            userIds: isSelected
                                                                ? prev.userIds.filter(id => id !== m.id)
                                                                : [...prev.userIds, m.id]
                                                        }));
                                                    }}
                                                    className={cn(
                                                        "relative px-2 py-2 rounded-xl text-[11px] font-bold border transition-all truncate",
                                                        isSelected
                                                            ? "bg-primary text-white border-primary shadow-sm"
                                                            : isAlreadyRegistered
                                                                ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60"
                                                                : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                                                    )}
                                                >
                                                    {m.username}
                                                    {isAlreadyRegistered && !isSelected && (
                                                        <span className="absolute top-0 right-1 text-[7px] font-black text-slate-400 italic">DONE</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="hidden">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500">운동 종류</Label>
                                        <Select onValueChange={(v) => setDateLogForm(prev => ({ ...prev, type: v as any }))} value={dateLogForm.type}>
                                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="running">러닝</SelectItem>
                                                <SelectItem value="gym">운동완료</SelectItem>
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
                                            onChange={(e) => setDateLogForm(prev => ({ ...prev, duration: e.target.value }))}
                                            className="h-12 rounded-xl bg-slate-50 border-none"
                                        />
                                    </div>
                                </div>
                                <div className="text-center py-1">
                                    <p className="text-[10px] text-slate-400">기본값(운동완료/60분)으로 자동 등록됩니다.</p>
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
                                <CardHeader className="py-4 border-b border-slate-50 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-black text-slate-700">
                                        기록 관리 (클릭하여 추가/삭제)
                                    </CardTitle>
                                    <div className="flex gap-3 text-[10px] font-bold">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />기존</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" />추가</div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />삭제</div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="flex flex-col items-center p-2">
                                        <div className="flex justify-between w-full px-4 mb-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setCurrentMonth(new Date())}
                                                className="text-[10px] font-bold text-slate-400 h-7"
                                            >
                                                이번 달로
                                            </Button>
                                        </div>
                                        <Calendar
                                            mode="single"
                                            selected={undefined}
                                            month={currentMonth}
                                            onMonthChange={setCurrentMonth}
                                            onSelect={(date) => date && toggleDate(date)}
                                            className="rounded-md border-none"
                                            modifiers={{
                                                hasLog: memberLogs.map(l => new Date(l.workout_date)),
                                                toAdd: datesToAdd,
                                                toDelete: datesToDelete.map(d => new Date(d))
                                            }}
                                            modifiersClassNames={{
                                                hasLog: "bg-blue-50 text-blue-600 font-bold border border-blue-100",
                                                toAdd: "bg-amber-100 text-amber-700 font-bold !bg-amber-400 !text-white",
                                                toDelete: "bg-red-100 text-red-700 font-bold !bg-red-500 !text-white"
                                            }}
                                        />
                                    </div>

                                    {(datesToAdd.length > 0 || datesToDelete.length > 0) && (
                                        <div className="p-5 border-t border-slate-50 bg-slate-50/50 space-y-4">
                                            <div className="flex items-center justify-between transition-all">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-slate-500">대기 중인 변경사항</p>
                                                    <div className="flex gap-2">
                                                        {datesToAdd.length > 0 && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">+{datesToAdd.length}일 추가</span>}
                                                        {datesToDelete.length > 0 && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">-{datesToDelete.length}일 삭제</span>}
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={handleBatchUpdate}
                                                    className="rounded-xl bg-primary px-6 font-black italic shadow-lg"
                                                    disabled={isSubmitting}
                                                >
                                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장하기"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </section>
                )}

                {/* Workflow 5: Certification Management (Advanced) */}
                {activeTab === 'cert-logs' && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <CheckCircle2 size={20} className="text-slate-400" />
                            <h2 className="text-md font-bold">인증 기록 정밀 관리</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {members.map((m) => {
                                const isExpanded = expandedMemberId === m.id;
                                return (
                                    <div key={m.id} className="bg-white rounded-2xl shadow-sm border border-slate-50 overflow-hidden transition-all">
                                        <div
                                            onClick={() => toggleMemberExpand(m.id)}
                                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-300">
                                                    {m.username[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-primary">{m.username}</p>
                                                    <p className="text-[10px] text-slate-400">{m.tier} · 이번 시즌 인증 완료</p>
                                                </div>
                                            </div>
                                            <div className={cn("text-slate-300 transition-transform", isExpanded && "rotate-180")}>
                                                <ChevronLeft className="-rotate-90" size={18} />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-4 pb-4 border-t border-slate-50 bg-slate-50/30">
                                                {isFetchingMemberDetail ? (
                                                    <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
                                                ) : (
                                                    <div className="pt-4 space-y-3">
                                                        <div className="grid grid-cols-2 gap-2 mb-4">
                                                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                <p className="text-[9px] font-bold text-slate-400">이번 시즌 총 점수</p>
                                                                <p className="text-sm font-black text-primary">계산 중...</p>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                <p className="text-[9px] font-bold text-slate-400">인증 횟수</p>
                                                                <p className="text-sm font-black text-primary">{expandedMemberLogs.length}회</p>
                                                            </div>
                                                        </div>

                                                        <p className="text-[10px] font-bold text-slate-500 mb-2 px-1">기존 운동 기록 목록 ({expandedMemberLogs.length})</p>
                                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-hide">
                                                            {expandedMemberLogs.length === 0 ? (
                                                                <p className="text-center py-6 text-[10px] text-slate-400">등록된 기록이 없습니다.</p>
                                                            ) : (
                                                                expandedMemberLogs.map((log) => (
                                                                    <div key={log.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                                                                <CalendarIcon size={14} />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-bold text-slate-700">{format(new Date(log.workout_date), 'MM월 dd일')}</p>
                                                                                <p className="text-[9px] text-slate-400">{log.workout_type} · {log.duration_minutes}분</p>
                                                                            </div>
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleDeleteRecord(log.id)}
                                                                            className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                                        >
                                                                            <X size={14} />
                                                                        </Button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
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
                {/* Workflow 4: Season Management */}
                {activeTab === 'seasons' && (
                    <div className="space-y-6">
                        {/* 1. Create New Season */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <PlusCircle size={20} className="text-slate-400" />
                                <h2 className="text-md font-bold">새 시즌 생성</h2>
                            </div>
                            <Card className="border-none shadow-sm overflow-hidden">
                                <CardContent className="p-6 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 ml-1">시즌 이름</Label>
                                        <Input
                                            placeholder="예: 2024 머슬 시즌 1"
                                            value={newSeasonForm.name}
                                            onChange={(e) => setNewSeasonForm({ ...newSeasonForm, name: e.target.value })}
                                            className="h-11 rounded-xl bg-slate-50 border-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 ml-1">시즌 시작일</Label>
                                            <Input
                                                type="date"
                                                value={newSeasonForm.start_date}
                                                onChange={(e) => setNewSeasonForm({ ...newSeasonForm, start_date: e.target.value })}
                                                className="h-11 rounded-xl bg-slate-50 border-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-slate-500 ml-1">시즌 종료일</Label>
                                            <Input
                                                type="date"
                                                value={newSeasonForm.end_date}
                                                onChange={(e) => setNewSeasonForm({ ...newSeasonForm, end_date: e.target.value })}
                                                className="h-11 rounded-xl bg-slate-50 border-none"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleCreateSeason}
                                        className="w-full h-12 rounded-xl bg-primary text-sm font-black shadow-lg shadow-slate-200 mt-2"
                                        disabled={isCreatingSeason}
                                    >
                                        {isCreatingSeason ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle size={18} className="mr-2" />}
                                        시즌 생성하기
                                    </Button>
                                </CardContent>
                            </Card>
                        </section>

                        {/* 2. Burning Period for Active Season */}
                        {activeSeason && (
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <Save size={20} className="text-slate-400" />
                                    <h2 className="text-md font-bold">활성 시즌 설정 ({activeSeason.name})</h2>
                                </div>
                                <Card className="border-none shadow-sm overflow-hidden">
                                    <CardHeader className="bg-slate-50 border-b border-slate-100 py-3">
                                        <CardTitle className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            버닝 기간 설정
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                            <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                                💡 <strong>버닝 기간</strong>을 설정하면 해당 기간의 운동 점수가 <strong>2배(2점)</strong>로 자동 계산됩니다.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 ml-1">버닝 시작일</Label>
                                                <Input
                                                    type="date"
                                                    value={burningDates.start}
                                                    onChange={(e) => setBurningDates({ ...burningDates, start: e.target.value })}
                                                    className="h-11 rounded-xl bg-slate-50 border-none"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 ml-1">버닝 종료일</Label>
                                                <Input
                                                    type="date"
                                                    value={burningDates.end}
                                                    onChange={(e) => setBurningDates({ ...burningDates, end: e.target.value })}
                                                    className="h-11 rounded-xl bg-slate-50 border-none"
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            onClick={handleUpdateSeason}
                                            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-black shadow-lg shadow-emerald-100"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "버닝 설정 저장"}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </section>
                        )}

                        {/* 3. Season List & Activation */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <CalendarDays size={20} className="text-slate-400" />
                                <h2 className="text-md font-bold">시즌 목록 및 활성화</h2>
                            </div>
                            <div className="space-y-3">
                                {seasons.length === 0 && (
                                    <p className="text-center py-10 text-slate-400 text-xs">등록된 시즌이 없습니다.</p>
                                )}
                                {seasons.map((s) => (
                                    <Card key={s.id} className={cn("border-none shadow-sm transition-all", s.is_active ? "ring-2 ring-primary ring-offset-2" : "opacity-80")}>
                                        <CardContent className="p-5 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black", s.is_active ? "bg-primary" : "bg-slate-200 text-slate-400")}>
                                                    {s.is_active ? <CheckCircle2 size={24} /> : <CalendarDays size={24} />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-black text-sm text-primary">{s.name}</h3>
                                                        {s.is_active && <Badge variant="wait" className="bg-primary text-white text-[9px] px-1.5 py-0 border-none">활성</Badge>}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                        {format(new Date(s.start_date), 'yyyy.MM.dd')} ~ {format(new Date(s.end_date), 'yyyy.MM.dd')}
                                                    </p>
                                                </div>
                                            </div>
                                            {!s.is_active && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleToggleSeason(s.id, s.name)}
                                                    className="h-8 text-[11px] font-black rounded-lg border-primary text-primary hover:bg-primary hover:text-white"
                                                    disabled={isSubmitting}
                                                >
                                                    활성화하기
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
}
