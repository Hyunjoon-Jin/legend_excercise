"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Camera, X, Loader2, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { submitWorkoutLog, getActiveSeason, notifyAdmins, updateWorkoutLog } from "@/lib/data";
import type { WorkoutLog } from "@/types/database";

const certSchema = z.object({
    type: z.string().min(1, "운동 종류를 선택하세요."),
    duration: z.string().min(1, "운동 시간을 입력하세요."),
    date: z.string().min(1, "날짜를 입력하세요."),
    comment: z.string().optional(),
});

type CertFormValues = z.infer<typeof certSchema>;

interface MediaItem {
    file?: File;
    preview: string;      // data URL (new) or remote URL (existing)
    isVideo: boolean;
    isExisting?: boolean; // already uploaded to storage
}

interface CertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    editingLog?: WorkoutLog;
}

function isVideoFile(file: File) {
    return file.type.startsWith("video/");
}

function isVideoUrl(url: string) {
    return /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);
}

export function CertificationModal({ isOpen, onClose, onSuccess, editingLog }: CertModalProps) {
    const { user } = useAuthStore();
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

    const isEditMode = !!editingLog;

    const form = useForm<CertFormValues>({
        resolver: zodResolver(certSchema),
        defaultValues: {
            type: "",
            duration: "",
            date: new Date().toISOString().split('T')[0],
            comment: "",
        },
    });

    useEffect(() => {
        if (!isOpen) return;
        if (isEditMode && editingLog) {
            form.reset({
                type: editingLog.workout_type || "",
                duration: String(editingLog.duration_minutes || ""),
                date: editingLog.workout_date || new Date().toISOString().split('T')[0],
                comment: editingLog.comment || "",
            });
            // Restore existing media
            const items: MediaItem[] = [];
            if (editingLog.proof_media_urls && editingLog.proof_media_urls.length > 0) {
                editingLog.proof_media_urls.forEach(url => {
                    items.push({ preview: url, isVideo: isVideoUrl(url), isExisting: true });
                });
            } else if (editingLog.proof_image_url && editingLog.proof_image_url !== 'admin-registered') {
                items.push({ preview: editingLog.proof_image_url, isVideo: isVideoUrl(editingLog.proof_image_url), isExisting: true });
            }
            setMediaItems(items);
        } else {
            form.reset({
                type: "",
                duration: "",
                date: new Date().toISOString().split('T')[0],
                comment: "",
            });
            setMediaItems([]);
            getActiveSeason().then(({ data }) => { if (data) setActiveSeasonId(data.id); });
        }
    }, [isOpen, isEditMode, editingLog]);

    useEffect(() => {
        if (!isOpen && !isEditMode) {
            getActiveSeason().then(({ data }) => { if (data) setActiveSeasonId(data.id); });
        }
    }, []);

    const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const newItems: MediaItem[] = files.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            isVideo: isVideoFile(file),
        }));
        setMediaItems(prev => [...prev, ...newItems]);
        e.target.value = "";
    };

    const removeItem = (idx: number) => {
        setMediaItems(prev => {
            const item = prev[idx];
            if (item.file) URL.revokeObjectURL(item.preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const uploadFile = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user!.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `workout-proofs/${fileName}`;
        const { error } = await supabase.storage.from('images').upload(filePath, file);
        if (error) throw new Error("파일 업로드 실패");
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
        return publicUrl;
    };

    const onSubmit = async (data: CertFormValues) => {
        if (!user) return;
        if (mediaItems.length === 0) {
            alert("인증 사진 또는 영상을 최소 1개 업로드해 주세요.");
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload new files; existing items keep their URL
            const uploadedUrls: string[] = await Promise.all(
                mediaItems.map(item =>
                    item.file ? uploadFile(item.file) : Promise.resolve(item.preview)
                )
            );

            const firstUrl = uploadedUrls[0];
            const allUrls = uploadedUrls;

            if (isEditMode && editingLog) {
                const { error } = await updateWorkoutLog(editingLog.id, {
                    workout_type: data.type as any,
                    duration_minutes: parseInt(data.duration),
                    comment: data.comment,
                    proof_image_url: firstUrl,
                    proof_media_urls: allUrls,
                    workout_date: data.date,
                });
                if (error) throw error;
                alert("인증이 수정되었습니다.");
            } else {
                if (!activeSeasonId) throw new Error("활성 시즌이 없습니다.");
                const { error: submitError } = await submitWorkoutLog({
                    user_id: user.id,
                    season_id: activeSeasonId,
                    workout_date: data.date,
                    workout_type: data.type as any,
                    duration_minutes: parseInt(data.duration),
                    proof_image_url: firstUrl,
                    proof_media_urls: allUrls,
                    comment: data.comment,
                } as any);
                if (submitError) throw submitError;
                const memberName = user.username || '회원';
                await notifyAdmins(memberName, '');
                alert("인증 신청이 완료되었습니다! 관리자 승인을 기다려주세요.");
            }

            onSuccess?.();
            onClose();
        } catch (err: any) {
            alert(err.message || "오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-primary">
                        {isEditMode ? "인증 수정하기" : "운동 인증하기"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                    {/* Media Upload Area */}
                    <div className="space-y-2">
                        <Label>인증 사진 / 영상</Label>

                        {/* Preview grid */}
                        {mediaItems.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5">
                                {mediaItems.map((item, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                                        {item.isVideo ? (
                                            <video
                                                src={item.preview}
                                                className="w-full h-full object-cover"
                                                muted
                                            />
                                        ) : (
                                            <img
                                                src={item.preview}
                                                alt={`미디어 ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeItem(idx)}
                                            className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full"
                                        >
                                            <X size={12} />
                                        </button>
                                        {item.isVideo && (
                                            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">영상</div>
                                        )}
                                    </div>
                                ))}

                                {/* Add more button */}
                                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                                    <Plus size={18} className="text-slate-300 mb-0.5" />
                                    <span className="text-[9px] text-slate-300">추가</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*,video/*"
                                        multiple
                                        onChange={handleFilesChange}
                                    />
                                </label>
                            </div>
                        )}

                        {/* Empty state upload area */}
                        {mediaItems.length === 0 && (
                            <label className="flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Camera className="w-10 h-10 text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-400">사진 / 영상 선택 (여러 장 가능)</p>
                                    <p className="text-xs text-slate-300 mt-1">심박수, 시간, 날짜 포함 권장</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,video/*"
                                    multiple
                                    onChange={handleFilesChange}
                                />
                            </label>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>운동 종류</Label>
                            <Select
                                value={form.watch("type")}
                                onValueChange={(val) => form.setValue("type", val)}
                            >
                                <SelectTrigger className={cn(form.formState.errors.type && "border-error focus:ring-error")}>
                                    <SelectValue placeholder="선택" />
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
                            <Label>운동 시간 (분)</Label>
                            <Input
                                {...form.register("duration")}
                                type="number"
                                placeholder="0"
                                className={cn(form.formState.errors.duration && "border-error focus-visible:ring-error")}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>운동 날짜</Label>
                        <Input
                            {...form.register("date")}
                            type="date"
                            className={cn(form.formState.errors.date && "border-error focus-visible:ring-error")}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>코멘트 (선택)</Label>
                        <Input {...form.register("comment")} placeholder="오늘 운동 소감 한마디" />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="submit"
                            className="w-full h-14 rounded-2xl text-md font-bold"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    처리 중...
                                </>
                            ) : isEditMode ? "수정 완료" : "인증 신청하기"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
