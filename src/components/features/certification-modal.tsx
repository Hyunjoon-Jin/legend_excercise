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
import { Camera, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { submitWorkoutLog, getActiveSeason, notifyAdmins } from "@/lib/data";

const certSchema = z.object({
    type: z.string().min(1, "운동 종류를 선택하세요."),
    duration: z.string().min(1, "운동 시간을 입력하세요."),
    comment: z.string().optional(),
});

type CertFormValues = z.infer<typeof certSchema>;

interface CertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function CertificationModal({ isOpen, onClose, onSuccess }: CertModalProps) {
    const { user } = useAuthStore();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

    const form = useForm<CertFormValues>({
        resolver: zodResolver(certSchema),
        defaultValues: {
            type: "",
            duration: "",
            comment: "",
        },
    });

    useEffect(() => {
        const fetchSeason = async () => {
            const { data } = await getActiveSeason();
            if (data) setActiveSeasonId(data.id);
        };
        if (isOpen) fetchSeason();
    }, [isOpen]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (data: CertFormValues) => {
        if (!user || !activeSeasonId) return;
        if (!imageFile) {
            alert("인증 사진을 업로드해 주세요.");
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Upload Image to Supabase Storage
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `workout-proofs/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images') // Ensure you have a bucket named 'images'
                .upload(filePath, imageFile);

            if (uploadError) throw new Error("이미지 업로드에 실패했습니다.");

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath);

            // 2. Submit Log to Database
            const { error: submitError } = await submitWorkoutLog({
                user_id: user.id,
                season_id: activeSeasonId,
                workout_date: new Date().toISOString().split('T')[0],
                workout_type: data.type as any,
                duration_minutes: parseInt(data.duration),
                proof_image_url: publicUrl,
                comment: data.comment,
            });

            if (submitError) throw submitError;

            const memberName = user.username || '회원';
            await notifyAdmins(memberName, '');

            alert("인증 신청이 완료되었습니다! 관리자 승인을 기다려주세요.");
            onSuccess?.();
            onClose();
            form.reset();
            setImageFile(null);
            setImagePreview(null);
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
                    <DialogTitle className="text-xl font-bold text-primary">운동 인증하기</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                    {/* Image Upload Area */}
                    <div className="space-y-2">
                        <Label>인증 사진</Label>
                        {imagePreview ? (
                            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-2 border-slate-100 bg-slate-50">
                                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImagePreview(null);
                                        setImageFile(null);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Camera className="w-10 h-10 text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-400">사진을 터치하여 업로드</p>
                                    <p className="text-xs text-slate-300 mt-1">심박수, 시간, 날짜 포함 권장</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                            </label>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>운동 종류</Label>
                            <Select onValueChange={(val) => form.setValue("type", val)}>
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
                            ) : "인증 신청하기"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
