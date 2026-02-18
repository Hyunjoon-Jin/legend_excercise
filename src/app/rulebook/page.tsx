"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Search, X, Book } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const rulebookData = [
    {
        chapter: "제1장 총칙",
        rules: [
            {
                title: "제1조(명칭)",
                content: "본 모임의 명칭은 '레전드 운동인증방'(이하 '본 모임')이라 한다."
            },
            {
                title: "제2조(목적)",
                content: "본 모임은 정기적인 운동 습관 형성을 통해 회원 간의 건강 증진 및 유대감을 강화하는 것을 목적으로 한다."
            },
            {
                title: "제3조(용어 정의)",
                content: `1. '시즌': 본 모임의 운영 단위 기간(보통 4주~8주).
2. '주(Week)': 월요일 00:00부터 일요일 23:59까지.
3. '인증': 운동 수행 후 정해진 방식에 따라 기록을 남기는 행위.
4. '당일 업로드': 운동 종료 당일 내에 인증을 완료하는 것.`
            },
        ],
    },
    {
        chapter: "제2장 조직 및 운영진",
        rules: [
            {
                title: "제4조(운영진 구성)",
                content: "운영진은 방장(1인), 운동대장(1~2인), 재무(1인)로 구성된다."
            },
            {
                title: "제5조(운영진 역할)",
                content: `1. 방장: 모임 총괄 및 주요 의사결정.
2. 운동대장: 인증 현황 관리, 승인 및 반려, 랭킹 집계.
3. 재무: 회비 및 벌금 정산, 시즌 결산 보고.`
            },
        ],
    },
    {
        chapter: "제3장 회원 가입 및 자격",
        rules: [
            {
                title: "제6조(가입 자격)",
                content: "본 모임의 취지에 동감하고 성실히 활동할 의사가 있는 자는 누구나 가입 가능하다."
            },
            {
                title: "제7조(활동 의무)",
                content: "회원은 주 최소 2회 이상의 운동 인증을 성실히 이행해야 할 의무를 가진다."
            },
        ],
    },
    {
        chapter: "제4장 운동 인증 및 평가",
        rules: [
            {
                title: "제8조(인증 기준)",
                content: `분야별 최소 기준은 다음과 같다.
- 러닝: 3km 이상 또는 30분 이상 지속.
- 헬스/홈트: 40분 이상 수행 (심박수 또는 사진 증빙).
- 걷기: 5km 이상 또는 1시간 이상.
- 기타(요가/필라테스/스포츠): 40분 이상 활동 증빙.`
            },
            {
                title: "제9조(인증 방식)",
                content: "플랫폼 내 '인증하기' 기능을 통해 사진(심박수/시간 기록 포함)과 운동 정보를 업로드한다."
            },
            {
                title: "제10조(승인 기준)",
                content: "운동대장은 데이터의 신뢰성을 판단하여 승인하며, 동일 사진 중복 사용이나 조작 발견 시 무효 처리한다."
            },
        ],
    },
    {
        chapter: "제5장 상벌 규정",
        rules: [
            {
                title: "제11조(벌금)",
                content: "주 2회 미인증 시 1회당 5,000원의 벌금이 부과된다. 벌금은 시즌 종료 후 전체 회원의 간식비 또는 회식비로 사용된다."
            },
            {
                title: "제12조(포상)",
                content: "시즌 종료 후 누적 인증 횟수 상위 3인 및 MVP에게는 소정의 기프티콘 또는 차기 시즌 혜택을 부여한다."
            },
            {
                title: "제13조(강퇴 규정)",
                content: "정당한 사유 없이 2주 연속 전체 미인증 시 운영진 판단하에 퇴출될 수 있다."
            },
        ],
    },
    {
        chapter: "제6장 보칙",
        rules: [
            {
                title: "제14조(규정 외 사항)",
                content: "본 규정에 명시되지 않은 사항은 통상적인 관례 및 운영진의 합의에 따른다."
            },
            {
                title: "제15조(규정 발효)",
                content: "본 규정은 2026년 2월 18일부터 즉시 효력을 발생한다."
            },
        ],
    },
];

export default function RulebookPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return rulebookData;

        const lowQuery = searchQuery.toLowerCase();
        return rulebookData.map(chapter => ({
            ...chapter,
            rules: chapter.rules.filter(rule =>
                rule.title.toLowerCase().includes(lowQuery) ||
                rule.content.toLowerCase().includes(lowQuery)
            )
        })).filter(chapter => chapter.rules.length > 0);
    }, [searchQuery]);

    const highlightText = (text: string, query: string) => {
        if (!query.trim()) return text;
        const parts = text.split(new RegExp(`(${query})`, "gi"));
        return (
            <>
                {parts.map((part, i) => (
                    part.toLowerCase() === query.toLowerCase() ? (
                        <span key={i} className="bg-accent/40 text-primary font-bold rounded-sm px-0.5">{part}</span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                ))}
            </>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-secondary">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ChevronLeft size={20} />
                    </Button>
                    <div className="flex items-center gap-2">
                        <Book size={20} className="text-accent" />
                        <h1 className="text-lg font-bold text-primary">공식 규정집 Ver 4.2</h1>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input
                        placeholder="조항 또는 내용을 검색하세요"
                        className="pl-11 h-12 rounded-2xl bg-slate-50 border-none focus:ring-accent"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </header>

            <main className="p-5 space-y-6 pb-20">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                        <span>개정일: 2026.02.18</span>
                        <span>시행일: 즉시</span>
                    </div>
                </div>

                {filteredData.length > 0 ? (
                    filteredData.map((section, idx) => (
                        <section key={idx} className="space-y-3">
                            <h2 className="text-sm font-bold text-slate-400 px-1">
                                {section.chapter}
                            </h2>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-50 overflow-hidden text-sm">
                                <Accordion type="multiple" className="w-full">
                                    {section.rules.map((rule, ruleIdx) => (
                                        <AccordionItem
                                            key={ruleIdx}
                                            value={`item-${idx}-${ruleIdx}`}
                                            className="border-b last:border-0 border-slate-50"
                                        >
                                            <AccordionTrigger className="px-5 py-4 text-primary font-bold hover:no-underline text-left">
                                                {highlightText(rule.title, searchQuery)}
                                            </AccordionTrigger>
                                            <AccordionContent className="px-5 pb-5 pt-0 text-slate-600 leading-relaxed whitespace-pre-wrap text-xs">
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    {highlightText(rule.content, searchQuery)}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </section>
                    ))
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                        <Search size={40} className="mb-3 opacity-20" />
                        <p className="text-sm">검색 결과가 없습니다.</p>
                        <button
                            onClick={() => setSearchQuery("")}
                            className="mt-2 text-xs text-accent font-bold"
                        >
                            검색 초기화
                        </button>
                    </div>
                )}

                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 mt-4">
                    <h3 className="font-bold text-amber-800 text-sm mb-2">💡 유의사항</h3>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        규정 위반 시 벌금이 부과되며, 고의적인 부정 인증은 즉시 강퇴 사유가 될 수 있습니다. 모든 인증은 '당일 업로드'를 원칙으로 합니다.
                    </p>
                </div>
            </main>
        </div>
    );
}
