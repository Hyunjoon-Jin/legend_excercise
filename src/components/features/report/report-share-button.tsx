import React, { useState } from "react";
import { toBlob } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Share2, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ReportShareButtonProps {
    dailyRef: React.RefObject<HTMLDivElement | null>;
    rankingRef: React.RefObject<HTMLDivElement | null>;
    weeklyRef: React.RefObject<HTMLDivElement | null>;
    date: Date;
    disabled?: boolean;
}

export function ReportShareButton({ dailyRef, rankingRef, weeklyRef, date, disabled }: ReportShareButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const generateImages = async () => {
        setIsGenerating(true);
        try {
            const files: File[] = [];
            const dateStr = format(date, "yyyyMMdd");

            // Generate Daily
            if (dailyRef.current) {
                const blob = await toBlob(dailyRef.current, { cacheBust: true, pixelRatio: 2 });
                if (blob) files.push(new File([blob], `daily_${dateStr}.png`, { type: "image/png" }));
            }
            // Generate Ranking
            if (rankingRef.current) {
                const blob = await toBlob(rankingRef.current, { cacheBust: true, pixelRatio: 2 });
                if (blob) files.push(new File([blob], `ranking_${dateStr}.png`, { type: "image/png" }));
            }
            // Generate Weekly
            if (weeklyRef.current) {
                const blob = await toBlob(weeklyRef.current, { cacheBust: true, pixelRatio: 2 });
                if (blob) files.push(new File([blob], `weekly_${dateStr}.png`, { type: "image/png" }));
            }

            if (files.length === 0) {
                alert("이미지 생성에 실패했습니다.");
                return;
            }

            // Try Native Share if supported and can share files
            if (navigator.canShare && navigator.canShare({ files })) {
                try {
                    await navigator.share({
                        files,
                        title: `${format(date, "MM/dd")} 운동 리포트`,
                        text: "오늘의 운동 인증 현황과 현재 순위를 확인하세요!"
                    });
                    return; // Successfully shared
                } catch (error: any) {
                    if (error.name !== 'AbortError') {
                        console.error("공유 실패:", error);
                        // Fallback to download below
                    } else {
                        return; // User cancelled
                    }
                }
            }

            // Fallback: Download each file
            files.forEach(file => {
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });

        } catch (error) {
            console.error(error);
            alert("리포트 이미지 생성 중 오류가 발생했습니다.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button
            onClick={generateImages}
            disabled={disabled || isGenerating}
            className="w-full bg-kakao text-[#3b1e1e] hover:bg-[#FEE500]/90 font-bold"
            size="lg"
        >
            {isGenerating ? (
                <><Loader2 className="animate-spin mr-2" /> 이미지 3장 생성 중...</>
            ) : (
                <><Share2 className="mr-2" size={20} /> 리포트 공유 / 다운로드</>
            )}
        </Button>
    );
}
