import React, { useState } from "react";
import { toBlob } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Share2, Download, Loader2, Copy, Check } from "lucide-react";
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
    const [isCopied, setIsCopied] = useState(false);

    // 이미지 3장 생성 후 저장 (모바일: Web Share / 데스크톱: 다운로드)
    const handleImageShare = async () => {
        setIsGenerating(true);
        try {
            const files: File[] = [];
            const dateStr = format(date, "yyyyMMdd");

            if (dailyRef.current) {
                const blob = await toBlob(dailyRef.current, { cacheBust: true, pixelRatio: 2 });
                if (blob) files.push(new File([blob], `daily_${dateStr}.png`, { type: "image/png" }));
            }
            if (rankingRef.current) {
                const blob = await toBlob(rankingRef.current, { cacheBust: true, pixelRatio: 2 });
                if (blob) files.push(new File([blob], `ranking_${dateStr}.png`, { type: "image/png" }));
            }
            if (weeklyRef.current) {
                const blob = await toBlob(weeklyRef.current, { cacheBust: true, pixelRatio: 2 });
                if (blob) files.push(new File([blob], `weekly_${dateStr}.png`, { type: "image/png" }));
            }

            if (files.length === 0) {
                alert("이미지 생성에 실패했습니다.");
                return;
            }

            // 모바일: 파일 공유 (카카오톡 등 앱으로 바로 전송 가능)
            if (navigator.canShare && navigator.canShare({ files })) {
                try {
                    await navigator.share({
                        files,
                        title: `${format(date, "MM/dd")} 운동 리포트`,
                        text: "오늘의 운동 인증 현황과 현재 순위를 확인하세요!"
                    });
                    return;
                } catch (err: any) {
                    if (err.name === "AbortError") return;
                    // 공유 실패 시 다운로드로 폴백
                }
            }

            // 데스크톱 폴백: 파일 다운로드
            files.forEach(file => {
                const url = URL.createObjectURL(file);
                const a = document.createElement("a");
                a.href = url;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });

        } catch (err) {
            console.error(err);
            alert("리포트 이미지 생성 중 오류가 발생했습니다.");
        } finally {
            setIsGenerating(false);
        }
    };

    // 카카오톡/링크 공유: 리포트 페이지 URL을 공유
    // - 모바일: OS 공유 시트 → 카카오톡 선택
    // - Windows Edge: Windows 공유 다이얼로그 → 카카오톡 PC 선택
    // - 미지원: 링크 클립보드 복사
    const handleKakaoShare = async () => {
        const pageUrl = window.location.href;
        const shareData = {
            title: `${format(date, "M월 d일")} Legend 운동 리포트`,
            text: "오늘의 운동 인증 현황과 랭킹을 확인하세요!",
            url: pageUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err: any) {
                if (err.name === "AbortError") return;
                // 공유 API 실패 시 클립보드로 폴백
            }
        }

        // 폴백: 클립보드 복사
        try {
            await navigator.clipboard.writeText(pageUrl);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2500);
        } catch {
            alert(`링크를 복사해서 카카오톡에 붙여넣으세요:\n${pageUrl}`);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {/* 이미지 저장/공유 버튼 */}
            <Button
                onClick={handleImageShare}
                disabled={disabled || isGenerating}
                className="w-full bg-slate-800 text-white hover:bg-slate-700 font-bold"
                size="lg"
            >
                {isGenerating ? (
                    <><Loader2 className="animate-spin mr-2" /> 이미지 3장 생성 중...</>
                ) : (
                    <><Download className="mr-2" size={20} /> 이미지 저장 / 공유</>
                )}
            </Button>

            {/* 카카오톡 링크 공유 버튼 */}
            <Button
                onClick={handleKakaoShare}
                disabled={disabled}
                className="w-full bg-[#FEE500] text-[#3b1e1e] hover:bg-[#FEE500]/90 font-bold"
                size="lg"
            >
                {isCopied ? (
                    <><Check className="mr-2" size={20} /> 링크 복사됨! 카카오톡에 붙여넣기</>
                ) : (
                    <><Share2 className="mr-2" size={20} /> 카카오톡으로 링크 공유</>
                )}
            </Button>
        </div>
    );
}
