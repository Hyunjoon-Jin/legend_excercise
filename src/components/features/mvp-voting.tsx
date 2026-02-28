"use client";

import { useEffect, useRef, useState } from "react";
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
    ExternalLink,
    Timer,
    ImagePlus,
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

function isVideoUrl(url: string) {
    return /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);
}

function getPrMediaUrls(imageUrl?: string): string[] {
    if (!imageUrl) return [];
    try { const p = JSON.parse(imageUrl); if (Array.isArray(p)) return p; } catch {}
    return [imageUrl];
}

function formatRemaining(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

interface MVPVotingProps {
    votingOpen?: boolean;
    votingEndsAt?: string;
}

export function MVPVoting({ votingOpen = true, votingEndsAt }: MVPVotingProps) {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    // 남은 시간 계산 (1초 단위 실시간 업데이트)
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const [msLeft, setMsLeft] = useState<number | null>(() =>
        votingEndsAt ? new Date(votingEndsAt).getTime() - Date.now() : null
    );

    useEffect(() => {
        if (!votingEndsAt) { setMsLeft(null); return; }
        const update = () => setMsLeft(new Date(votingEndsAt).getTime() - Date.now());
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [votingEndsAt]);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [myVotes, setMyVotes] = useState<any[]>([]);
    const [prs, setPrs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isVoting, setIsVoting] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState<string | null>(null);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

    // Self PR Form
    const [myPr, setMyPr] = useState<{ content: string; image_url: string }>({ content: "", image_url: "" });
    const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [newFilePreviews, setNewFilePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
                        setExistingMediaUrls(getPrMediaUrls(userPr.image_url));
                        setSelectedFiles([]);
                        setNewFilePreviews([]);
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
            // 1. Upload new files
            let newlyUploadedUrls: string[] = [];
            if (selectedFiles.length > 0) {
                const results = await Promise.all(selectedFiles.map(f => uploadMVPImage(f, user.id)));
                newlyUploadedUrls = results.filter(r => r.data).map(r => r.data as string);
            }

            // 2. Combine existing (not removed) + new
            const allUrls = [...existingMediaUrls, ...newlyUploadedUrls];
            const imageUrlToSave = allUrls.length === 0 ? ""
                : allUrls.length === 1 ? allUrls[0]
                : JSON.stringify(allUrls);

            // 3. Submit PR
            const { error } = await submitMVPPr({
                season_id: activeSeasonId,
                user_id: user.id,
                content: myPr.content,
                image_url: imageUrlToSave
            });

            if (error) throw error;

            alert("이번 시즌 성과 PR이 등록되었습니다!");
            newFilePreviews.forEach(url => URL.revokeObjectURL(url));
            setSelectedFiles([]);
            setNewFilePreviews([]);
            setShowPrForm(false);

            // Refresh PRs
            const { data } = await getMVPPrs(activeSeasonId);
            if (data) {
                setPrs(data);
                const userPr = data.find(p => p.user_id === user.id);
                if (userPr) {
                    setMyPr({ content: userPr.content, image_url: userPr.image_url || "" });
                    setExistingMediaUrls(getPrMediaUrls(userPr.image_url));
                }
            }
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
                {votingOpen ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary rounded-full border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-black text-slate-400">내 투표 현황</span>
                        <span className="text-xs font-black text-primary">{myVotes.length}<span className="text-slate-300 mx-0.5">/</span>2</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
                        <AlertCircle size={10} className="text-amber-500" />
                        <span className="text-[10px] font-black text-amber-600">투표 준비 중</span>
                    </div>
                )}
            </div>

            {/* 투표 종료 카운트다운 — 모든 사용자에게 항상 표시 */}
            {votingOpen && msLeft !== null && msLeft > 0 && (
                <div className="bg-gradient-to-br from-slate-800 to-primary rounded-2xl p-4 shadow-lg shadow-slate-200 space-y-2.5">
                    <p className="text-[10px] font-black text-white/50 text-center tracking-widest">투표 마감까지 남은 시간</p>
                    <div className="flex items-end justify-center gap-1.5">
                        {(() => {
                            const totalSec = Math.max(0, Math.floor(msLeft / 1000));
                            const d = Math.floor(totalSec / 86400);
                            const h = Math.floor((totalSec % 86400) / 3600);
                            const m = Math.floor((totalSec % 3600) / 60);
                            const s = totalSec % 60;
                            const units = d > 0
                                ? [{ v: d, label: '일' }, { v: h, label: '시' }, { v: m, label: '분' }]
                                : [{ v: h, label: '시' }, { v: m, label: '분' }, { v: s, label: '초' }];
                            return units.map((u, i) => (
                                <div key={i} className="flex items-end gap-1.5">
                                    <div className="flex flex-col items-center">
                                        <div className="bg-white/10 rounded-xl px-3 py-2 min-w-[52px] text-center">
                                            <span className="text-2xl font-black text-white tabular-nums leading-none">
                                                {String(u.v).padStart(2, '0')}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-bold text-white/40 mt-1">{u.label}</span>
                                    </div>
                                    {i < units.length - 1 && (
                                        <span className="text-xl font-black text-white/25 pb-5">:</span>
                                    )}
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {votingOpen && msLeft !== null && msLeft <= 0 && (
                <div className="bg-slate-100 rounded-2xl p-3 flex items-center justify-center gap-2">
                    <AlertCircle size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">투표 시간이 종료되었습니다.</span>
                </div>
            )}

            {!votingOpen && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-800">투표가 아직 시작되지 않았습니다.</p>
                        <p className="text-[11px] text-amber-600 mt-0.5">관리자가 투표를 시작하면 투표할 수 있습니다.<br />지금은 성과 자랑만 가능합니다.</p>
                    </div>
                </div>
            )}

            {/* 긴급 배너: 투표 진행 중 + 3시간 이내 + 미투표자 */}
            {votingOpen && !isAdmin && msLeft !== null && msLeft > 0 && msLeft <= THREE_HOURS && myVotes.length < 2 && (
                <div className="bg-red-600 rounded-2xl p-4 flex items-center gap-3 animate-pulse shadow-lg shadow-red-200">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                        <Timer size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white leading-tight">⏰ 투표 마감까지 {formatRemaining(msLeft)} 남았어요!</p>
                        <p className="text-[11px] text-red-100 font-bold mt-0.5">
                            아직 {2 - myVotes.length}표가 남아 있습니다. 지금 바로 투표해 주세요!
                        </p>
                    </div>
                </div>
            )}

            {/* 투표 완료 확인 배너: 3시간 이내지만 이미 2표 완료 */}
            {votingOpen && !isAdmin && msLeft !== null && msLeft > 0 && msLeft <= THREE_HOURS && myVotes.length >= 2 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <p className="text-xs font-bold text-emerald-700">투표 완료! 마감까지 {formatRemaining(msLeft)} 남았습니다.</p>
                </div>
            )}

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
                                    <Label className="text-[11px] font-bold text-slate-500 ml-1">성과 설명</Label>
                                    <textarea
                                        placeholder="어떤 성과를 내셨나요? (예: 러닝 100km 달성!&#10;자유롭게 여러 줄로 작성하세요)"
                                        value={myPr.content}
                                        onChange={(e) => setMyPr({ ...myPr, content: e.target.value })}
                                        rows={4}
                                        className="w-full rounded-xl bg-white border-0 shadow-inner text-sm px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-slate-500 ml-1">사진/영상 첨부 (선택, 최대 5개)</Label>
                                    {(existingMediaUrls.length + selectedFiles.length > 0) && (
                                        <div className="grid grid-cols-3 gap-2">
                                            {existingMediaUrls.map((url, i) => (
                                                <div key={`e-${i}`} className="relative aspect-square">
                                                    {isVideoUrl(url) ? (
                                                        <video src={url} className="w-full h-full object-cover rounded-lg bg-black" />
                                                    ) : (
                                                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                                                    )}
                                                    <button type="button" onClick={() => setExistingMediaUrls(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            {newFilePreviews.map((url, i) => (
                                                <div key={`n-${i}`} className="relative aspect-square">
                                                    {selectedFiles[i]?.type.startsWith("video/") ? (
                                                        <video src={url} className="w-full h-full object-cover rounded-lg bg-black" />
                                                    ) : (
                                                        <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                                                    )}
                                                    <button type="button" onClick={() => { URL.revokeObjectURL(url); setSelectedFiles(prev => prev.filter((_, j) => j !== i)); setNewFilePreviews(prev => prev.filter((_, j) => j !== i)); }} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            {existingMediaUrls.length + selectedFiles.length < 5 && (
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-300 hover:border-amber-300 hover:text-amber-400 transition-colors">
                                                    <ImagePlus size={18} />
                                                    <span className="text-[10px] mt-1">추가</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {existingMediaUrls.length + selectedFiles.length === 0 && (
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-amber-300 hover:text-amber-400 transition-colors text-xs">
                                            <ImagePlus size={14} />
                                            사진/영상 첨부 (최대 5개)
                                        </button>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,video/*"
                                        onChange={(e) => {
                                            const sel = Array.from(e.target.files || []);
                                            const remaining = 5 - existingMediaUrls.length - selectedFiles.length;
                                            const toAdd = sel.slice(0, remaining);
                                            setSelectedFiles(prev => [...prev, ...toAdd]);
                                            setNewFilePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                        className="hidden"
                                    />
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
                                        {getPrMediaUrls(cPr?.image_url)[0] ? (
                                            <img src={getPrMediaUrls(cPr?.image_url)[0]} alt={c.name} className="w-full h-full rounded-full object-cover" />
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
                                        {isAdmin && !votingOpen && c.voteCount > 0 && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-black">
                                                {c.voteCount}표
                                            </span>
                                        )}
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
                                                        {(() => {
                                                            const mediaUrls = getPrMediaUrls(cPr.image_url);
                                                            return mediaUrls.length > 0 ? (
                                                                <div className={cn("grid gap-1", mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                                                                    {mediaUrls.map((url, mi) =>
                                                                        isVideoUrl(url) ? (
                                                                            <video key={mi} src={url} controls className="w-full bg-black" />
                                                                        ) : (
                                                                            <img key={mi} src={url} alt="" className="w-full object-contain bg-slate-100" />
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="aspect-video w-full bg-primary/5 flex items-center justify-center text-primary/20">
                                                                    <ImageIcon size={48} />
                                                                </div>
                                                            );
                                                        })()}
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
                                    disabled={!votingOpen || !!isVoting || !!isCancelling || isSelf || (!alreadyVoted && myVotes.length >= 2)}
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
