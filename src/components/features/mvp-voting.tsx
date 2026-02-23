"use client";

import { useEffect, useState } from "react";
import {
    Trophy,
    User as UserIcon,
    Heart,
    Loader2,
    AlertCircle,
    Info,
    Image as ImageIcon,
    CheckCircle2,
    X,
    MessageSquare,
    ExternalLink
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    getActiveSeason,
    getRankings,
    castVote,
    removeVote,
    getVotes,
    hasVoted,
    getMVPPrs,
    submitMVPPr,
    uploadMVPImage
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
    const [myVotes, setMyVotes] = useState<any[]>([]);
    const [prs, setPrs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isVoting, setIsVoting] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState<string | null>(null);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

    // Self PR Form
    const [myPr, setMyPr] = useState<{ content: string; image_url: string }>({ content: "", image_url: "" });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmittingPr, setIsSubmittingPr] = useState(false);
    const [showPrForm, setShowPrForm] = useState(false);

    useEffect(() => {
        const fetchVotingData = async () => {
            if (!user) return;
            setIsLoading(true);

            const { data: season } = await getActiveSeason();
            if (season) {
                setActiveSeasonId(season.id);
                const [rankRes, voteRes, prsRes] = await Promise.all([
                    getRankings(season.id),
                    getVotes(season.id, user.id),
                    getMVPPrs(season.id)
                ]);

                if (rankRes.data) {
                    setCandidates(rankRes.data);
                }
                if (voteRes.data) {
                    setMyVotes(voteRes.data);
                }
                if (prsRes.data) {
                    setPrs(prsRes.data);
                    const userPr = prsRes.data.find(p => p.user_id === user.id);
                    if (userPr) {
                        setMyPr({ content: userPr.content, image_url: userPr.image_url || "" });
                        setShowPrForm(false);
                    } else {
                        setShowPrForm(true);
                    }
                }
            }
            setIsLoading(false);
        };

        fetchVotingData();
    }, [user]);

    const handleVote = async (targetUserId: string, targetName: string) => {
        if (!user || !activeSeasonId || isVoting || isCancelling) return;

        if (targetUserId === user.id) {
            alert("자기 자신에게는 투표할 수 없습니다.");
            return;
        }

        if (myVotes.some(v => v.candidate_id === targetUserId)) {
            alert("이미 이 분에게 투표하셨습니다.");
            return;
        }

        if (myVotes.length >= 2) {
            alert("인당 최대 2표까지만 추천 가능합니다.");
            return;
        }

        setIsVoting(targetName);
        const { error, data } = await castVote(activeSeasonId, user.id, targetUserId);

        if (error) {
            alert(error.message || "오류가 발생했습니다.");
        } else {
            setMyVotes(prev => [...prev, data]);
            alert(`${targetName} 님에게 소중한 한 표를 던졌습니다!`);
        }
        setIsVoting(null);
    };

    const handleCancelVote = async (targetUserId: string, targetName: string) => {
        if (!user || !activeSeasonId || isVoting || isCancelling) return;

        if (!confirm(`${targetName} 님에게 한 투표를 취소하시겠습니까?`)) return;

        setIsCancelling(targetName);
        const { error } = await removeVote(activeSeasonId, user.id, targetUserId);

        if (error) {
            alert(error.message || "오류가 발생했습니다.");
        } else {
            setMyVotes(prev => prev.filter(v => v.candidate_id !== targetUserId));
            alert("투표가 취소되었습니다.");
        }
        setIsCancelling(null);
    };

    const handlePrSubmit = async () => {
        if (!user || !activeSeasonId) return;
        if (!myPr.content.trim()) {
            alert("성과 내용을 입력해 주세요.");
            return;
        }

        setIsSubmittingPr(true);
        try {
            let uploadedUrl = myPr.image_url;

            // 1. Upload image if a new file is selected
            if (selectedFile) {
                const { data: publicUrl, error: uploadError } = await uploadMVPImage(selectedFile, user.id);
                if (uploadError) {
                    throw new Error("이미지 업로드 실패: " + uploadError.message);
                }
                uploadedUrl = publicUrl || "";
            }

            // 2. Submit PR
            const { error } = await submitMVPPr({
                season_id: activeSeasonId,
                user_id: user.id,
                content: myPr.content,
                image_url: uploadedUrl
            });

            if (error) throw error;

            alert("이번 시즌 성과 PR이 등록되었습니다!");
            setShowPrForm(false);
            setSelectedFile(null);

            // Refresh PRS
            const { data } = await getMVPPrs(activeSeasonId);
            if (data) setPrs(data);
        } catch (err: any) {
            alert("등록 중 오류: " + err.message);
        } finally {
            setIsSubmittingPr(false);
        }
    };

    if (isLoading) return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    if (!user) return null;

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                    <Trophy size={20} className="text-secondary-foreground" />
                    <h2 className="text-lg font-bold">이번 시즌 MVP 투표</h2>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary rounded-full border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400">내 투표 현황</span>
                    <span className="text-xs font-black text-primary">{myVotes.length}<span className="text-slate-300 mx-0.5">/</span>2</span>
                </div>
            </div>

            {/* Step 1: My PR Section */}
            <Card className={cn(
                "border-none shadow-sm overflow-hidden transition-all",
                showPrForm ? "bg-amber-50 ring-1 ring-amber-200" : "bg-white"
            )}>
                <CardContent className="p-5">
                    {showPrForm ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-amber-800">
                                <Info size={16} />
                                <p className="text-xs font-bold">이번 시즌 나의 성과를 자랑해 보세요!</p>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-slate-500 ml-1">성과 설명 (한 줄 추천)</Label>
                                    <Input
                                        placeholder="어떤 성과를 내셨나요? (예: 러닝 100km 달성!)"
                                        value={myPr.content}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMyPr({ ...myPr, content: e.target.value })}
                                        className="h-10 rounded-xl bg-white border-white shadow-inner text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-slate-500 ml-1">인증 사진 첨부 (선택)</Label>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 relative">
                                                <ImageIcon size={14} className="absolute left-3 top-3 text-slate-300" />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                    className="hidden"
                                                    id="mvp-image-upload"
                                                />
                                                <label
                                                    htmlFor="mvp-image-upload"
                                                    className="flex h-10 w-full rounded-xl bg-white border-white shadow-inner text-xs items-center pl-9 cursor-pointer text-slate-400 font-medium hover:bg-slate-50 transition-colors overflow-hidden truncate"
                                                >
                                                    {selectedFile ? selectedFile.name : (myPr.image_url ? "사진이 이미 등록되어 있습니다" : "사진 파일을 선택하세요")}
                                                </label>
                                            </div>
                                            {(selectedFile || myPr.image_url) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => { setSelectedFile(null); setMyPr({ ...myPr, image_url: "" }) }}
                                                    className="h-10 w-10 p-0 rounded-xl bg-white text-slate-400 hover:text-red-500"
                                                >
                                                    <X size={16} />
                                                </Button>
                                            )}
                                        </div>
                                        {(selectedFile || myPr.image_url) && (
                                            <div className="w-20 h-20 rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                                                <img
                                                    src={selectedFile ? URL.createObjectURL(selectedFile) : myPr.image_url}
                                                    className="w-full h-full object-cover"
                                                    alt="preview"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    onClick={handlePrSubmit}
                                    className="w-full h-11 rounded-xl bg-primary text-sm font-black italic shadow-lg"
                                    disabled={isSubmittingPr}
                                >
                                    {isSubmittingPr ? <Loader2 className="animate-spin w-4 h-4" /> : "내 성과 등록하고 투표하기"}
                                </Button>
                                <p className="text-[9px] text-slate-400 text-center">※ 성과를 등록해야 다른 회원들의 성과도 잘 보입니다!</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <UserIcon size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-400">나의 성과 자랑</p>
                                    <p className="text-sm font-bold text-primary truncate max-w-[200px]">{myPr.content}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowPrForm(true)}
                                className="text-[11px] font-bold text-slate-400 h-8"
                            >
                                수정하기
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Step 2: Candidates List */}
            <div className="grid grid-cols-1 gap-3">
                {candidates.map((c) => {
                    // In getRankings, we don't return ID, we need to find it by name or modify getRankings
                    // For now, let's assume rankingMap includes userId in more detail or we adjust data.ts
                    // Wait, currently c.name is the username.
                    const isSelf = c.name === user.username;
                    const cPr = prs.find(p => p.user_id === c.userId); // We need userId in ranking data
                    const alreadyVoted = myVotes.some(v => v.candidate_id === c.userId);

                    return (
                        <div key={c.name} className={cn(
                            "bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border transition-all",
                            isSelf ? "opacity-60 bg-slate-50 border-transparent" : "border-slate-50",
                            alreadyVoted && "border-primary bg-primary/5 ring-1 ring-primary/20"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-50">
                                        {cPr?.image_url ? (
                                            <img src={cPr.image_url} alt={c.name} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <UserIcon size={24} />
                                        )}
                                    </div>
                                    {alreadyVoted && (
                                        <div className="absolute -right-1 -bottom-1 bg-white rounded-full p-0.5 shadow-sm">
                                            <CheckCircle2 size={16} className="text-primary fill-primary text-white bg-white" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-sm text-primary">{c.name}</p>
                                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md font-bold">{c.tier}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {cPr ? (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <button className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition-all">
                                                        <MessageSquare size={10} /> 성과 보기
                                                    </button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-[340px] rounded-3xl border-none p-0 overflow-hidden bg-white">
                                                    <div className="relative">
                                                        {cPr.image_url ? (
                                                            <div className="aspect-video w-full bg-slate-100">
                                                                <img src={cPr.image_url} alt="achievement" className="w-full h-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="aspect-video w-full bg-primary/5 flex items-center justify-center text-primary/20">
                                                                <ImageIcon size={48} />
                                                            </div>
                                                        )}
                                                        <div className="p-6 space-y-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                                                    <UserIcon size={20} className="text-slate-400" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-black text-slate-400">이번 시즌 MVP 후보</p>
                                                                    <p className="text-sm font-bold text-primary">{c.name} 님의 성과</p>
                                                                </div>
                                                            </div>
                                                            <div className="bg-slate-50 p-4 rounded-2xl italic text-slate-600 text-sm leading-relaxed border border-slate-100">
                                                                "{cPr.content}"
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 text-center">
                                                                총 {c.logCount}회 운동 인증 완료 (상위 {c.tier} 티어)
                                                            </p>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        ) : (
                                            <p className="text-[10px] text-slate-300">아직 성과를 등록하지 않았습니다.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Button
                                    variant={alreadyVoted ? "secondary" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "h-9 px-4 rounded-full font-bold transition-all",
                                        alreadyVoted ? "bg-red-50 text-red-500 border-red-100 hover:bg-red-100" : "border-primary text-primary hover:bg-primary hover:text-white"
                                    )}
                                    onClick={() => {
                                        if (c.userId) {
                                            if (alreadyVoted) {
                                                handleCancelVote(c.userId, c.name);
                                            } else {
                                                handleVote(c.userId, c.name);
                                            }
                                        }
                                    }}
                                    disabled={!!isVoting || !!isCancelling || isSelf || (!alreadyVoted && myVotes.length >= 2)}
                                >
                                    {isVoting === c.name || isCancelling === c.name ? (
                                        <Loader2 className="animate-spin w-4 h-4" />
                                    ) : alreadyVoted ? (
                                        "투표취소"
                                    ) : (
                                        "투표하기"
                                    )}
                                </Button>
                                {isSelf && <span className="text-[9px] text-slate-300 font-bold mr-2">본인 제외</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
