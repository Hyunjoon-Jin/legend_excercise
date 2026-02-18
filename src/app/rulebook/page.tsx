"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const rulebookData = [
    {
        chapter: "제1장 총칙",
        rules: [
            {
                title: "제1조(용어 정의)",
                content: `1. ‘시즌’은 본 모임의 운영 단위 기간을 말한다.
2. ‘주(week)’는 월요일 00시부터 일요일 24시까지의 기간을 말한다.
3. ‘당일 업로드’는 운동 종료 당일 24시(KST)까지 업로드하는 것을 의미한다.
4. ‘인증 실패’는 주 2회 미만 인증, 요건 미충족, 당일 업로드 미준수 시 해당한다.`
            },
            {
                title: "제2조(목적)",
                content: "본 규정은 꾸준한 운동 습관 형성을 독려하고, 건강한 커뮤니티 활동을 증진하는 것을 목적으로 한다."
            },
        ],
    },
    {
        chapter: "제2장 조직 및 운영진",
        rules: [
            {
                title: "제7조(운영진)",
                content: "모임의 장, 운동대장, 재무담당을 둔다. 임기는 1개 시즌으로 하며 연임할 수 있다."
            },
            {
                title: "제9조(운동대장)",
                content: "운동대장은 구성원의 운동 인증을 관리·승인하고, 최종 승인 및 반려 권한을 가진다."
            },
        ],
    },
    {
        chapter: "제4장 운동 인증",
        rules: [
            {
                title: "제17조(인증 기준)",
                content: `- 러닝: 30분 이상 또는 3km 이상
- 걷기: 1시간 이상 또는 3km 이상
- 헬스: 30분 이상, 3가지 이상 종목
- 요가/필라테스: 30분 이상 (타임랩스 등)
- 구기종목: 30분 이상`
            },
            {
                title: "제16조(벌금)",
                content: "인증 실패 1회당 5,000원 부과. 한 주에 모두 실패 시 10,000원."
            },
        ],
    },
];

export default function RulebookPage() {
    const router = useRouter();

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft size={24} />
                </Button>
                <h1 className="text-xl font-bold text-primary">공식 규정집 Ver 4.1</h1>
            </header>

            <main className="p-6 space-y-8 pb-20">
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">제정일: 2025.11.05</p>
                    <p className="text-xs text-muted-foreground font-bold">시행일: 2026.01.01</p>
                </div>

                {rulebookData.map((section, idx) => (
                    <section key={idx} className="space-y-4">
                        <h2 className="text-lg font-bold text-primary border-l-4 border-accent pl-3">
                            {section.chapter}
                        </h2>
                        <Accordion type="single" collapsible className="w-full">
                            {section.rules.map((rule, ruleIdx) => (
                                <AccordionItem key={ruleIdx} value={`item-${idx}-${ruleIdx}`}>
                                    <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                                        {rule.title}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {rule.content}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </section>
                ))}

                <div className="bg-slate-50 p-6 rounded-2xl space-y-4 mt-8">
                    <h3 className="font-bold text-primary">질의 및 분쟁 처리</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        분쟁 발생 시 운영진은 24시간 내 협의 후 결정하며, 최종 결정은 48시간 내 공지합니다. 새로운 증빙 제출 시 1회 재심이 허용됩니다.
                    </p>
                </div>
            </main>
        </div>
    );
}
