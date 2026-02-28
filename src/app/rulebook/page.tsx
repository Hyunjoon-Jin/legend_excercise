"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Search, X, BookOpen, ChevronDown, Shield, Users, Dumbbell, Gavel, FileText, Trophy, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const chapterIcons = [BookOpen, Users, Shield, Dumbbell, Trophy, Gift, Gavel, FileText];
const chapterColors = [
    { bg: "bg-blue-500", light: "bg-blue-50", text: "text-blue-600", border: "bg-blue-500" },
    { bg: "bg-violet-500", light: "bg-violet-50", text: "text-violet-600", border: "bg-violet-500" },
    { bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-600", border: "bg-emerald-500" },
    { bg: "bg-amber-500", light: "bg-amber-50", text: "text-amber-600", border: "bg-amber-500" },
    { bg: "bg-yellow-500", light: "bg-yellow-50", text: "text-yellow-700", border: "bg-yellow-500" },
    { bg: "bg-green-500", light: "bg-green-50", text: "text-green-700", border: "bg-green-500" },
    { bg: "bg-slate-500", light: "bg-slate-50", text: "text-slate-600", border: "bg-slate-500" },
    { bg: "bg-cyan-500", light: "bg-cyan-50", text: "text-cyan-700", border: "bg-cyan-500" },
];

const rulebookData = [
    {
        chapter: "제1장 총칙",
        rules: [
            {
                title: "제1조(용어 정의)",
                content: `1. '시즌'은 본 모임의 운영 단위 기간을 말한다.
2. '주(week)'는 한국 표준시(KST)를 기준으로 월요일 00시부터 일요일 24시까지의 기간을 말한다.
3. '당일 업로드'는 운동 종료 당일 24시(KST)까지 인증 자료를 업로드하는 것을 의미하며, 자정 이후 업로드는 익일 업로드로 간주한다.
4. '인증 실패'는 다음 각 호의 어느 하나에 해당하는 경우를 말한다.
  ① 해당 주에 인증 횟수가 2회 미만인 경우
  ② 인증 자료가 제17조의 요건을 충족하지 못한 경우
  ③ 당일 업로드 요건을 지키지 못한 경우
5. '유효표'는 투표 규정에 부합하고 자기투표·공란·중복이 아닌 표를 말하며, 이에 해당하지 않는 표는 '무효표'로 한다.
6. '정적 운동'은 요가·필라테스·웨이트 트레이닝 루틴 등 심박이 낮을 수 있는 종목을 포함한다.
7. '예산'은 본 모임을 통해 확보한 가입비, 보증금, 벌금, 이전 시즌 이월금을 합한 재원을 의미한다.`,
            },
            {
                title: "제2조(목적)",
                content: "본 규정은 레전드운동방 구성원의 꾸준한 운동 습관 형성을 독려하고, 건강한 커뮤니티 활동을 증진하는 것을 목적으로 한다.",
            },
            {
                title: "제3조(운영 방식)",
                content: "본 모임은 정해진 기간 동안 유지되는 시즌제로 운영한다.",
            },
            {
                title: "제4조(적용 대상)",
                content: "본 규정은 모임에 참여하는 모든 구성원에게 적용한다.",
            },
            {
                title: "제5조(운영 기간의 결정)",
                content: `시즌의 운영 기간은 다음 각 호의 절차에 따라 결정한다.
① 운영진은 차기 시즌의 운영 기간을 현 시즌 종료 3일 전에 발의하여야 한다.
② 발의된 운영 기간에 대하여 현 시즌 종료 1일 전까지 이견이 제기되지 아니한 경우, 해당 기간은 확정된 것으로 본다.
③ 이견이 제기된 경우 구성원 간 토의를 통해 기간을 조정하고, 현 시즌 종료 시점 전까지 차기 시즌의 운영 기간을 확정하여야 한다.`,
            },
            {
                title: "제6조(규정의 변경)",
                content: `1. 본 규정의 변경은 시즌 종료 시점과 관계없이 진행할 수 있다.
2. 규정 변경의 발의 건의자는 구성원 중 누구라도 될 수 있으며, 모임의 장에게 발의 건의를 제출함을 원칙으로 한다.
3. 모임의 장은 발의 건의를 접수한 날로부터 3일 이내에 해당 안건을 발의하여야 한다.
4. 발의된 규정 변경안은 유효 투표수의 2/3 이상이 동의하는 경우 가결되며, 해당 규정 변경안에 기재된 시행일을 기준으로 발효된다.
5. 규정 변경안이 시행되면 기존 규정은 효력을 상실한다.`,
            },
        ],
    },
    {
        chapter: "제2장 조직 및 운영진",
        rules: [
            {
                title: "제7조(운영진 및 임기)",
                content: `1. 모임의 장, 운동대장, 재무담당을 둔다.
2. 운영진의 임기는 1개 시즌으로 하며, 연임할 수 있다.`,
            },
            {
                title: "제8조(모임의 장)",
                content: `1. 모임의 장은 모임의 전반적인 운영을 책임지며, 구성원 간의 의견을 조율하고 분쟁 발생 시 이를 중재한다.
2. 모임의 장은 본 규정에 명시되지 아니한 사안이 발생한 경우 운영진 협의를 거쳐 최종 결정을 내릴 권한을 가진다.
3. 모든 투표는 모임의 장이 발의한다.`,
            },
            {
                title: "제9조(운동대장)",
                content: `1. 운동대장은 구성원의 운동 인증을 관리·승인하고, 운동 관련 기준을 수립하며 질의에 응답한다.
2. 운동대장은 운동 인증의 최종 승인 및 반려 권한을 가지며, 인증 기록의 무결성을 유지한다.`,
            },
            {
                title: "제10조(재무담당)",
                content: `1. 재무담당은 모임의 모든 예산(가입비, 벌금, 보증금)을 관리하고, 보상 지급 및 이월금을 담당한다.
2. 재무담당은 재정 현황을 투명하게 공개하여야 한다.`,
            },
            {
                title: "제11조(운영진 선출 및 궐위)",
                content: `1. 구성원이 차기 운영진에 출마할 의사를 현 시즌 종료 1주일 전까지 표명하지 아니한 경우, 기존 운영진은 자동으로 유임된 것으로 본다.
2. 운영진의 궐위 또는 사퇴가 발생하거나 구성원이 차기 운영진에 출마할 의사를 표명한 경우, 모임의 장은 해당 보직에 대하여 투표를 발의하여야 하며, 차기 시즌 시작 1일 전까지 선출을 완료하여야 한다.
3. 선출 방식은 다수결로 하며 최다득표자가 선출된다. 득표수가 동일한 경우에는 기존 운영진을 유임한다.
4. 특정 보직의 궐위가 발생한 경우 모임의 장은 해당 보직의 역할을 대신한다.
5. 모임의 장은 궐위 발생일로부터 1주일 이내에 해당 보직의 선출을 위한 투표를 발의하여야 한다.
6. 궐위인 보직에 대한 출마자가 없을 경우 모임의 장은 선정한 구성원에게 임시 보직을 제안하여 맡길 수 있다.
7. 임시 보직을 제안받은 구성원은 해당 궐위 보직에 준하는 권한과 역할을 부여받는다. 다만, 임시 보직을 제안받은 구성원은 보직 수행을 원하지 아니하는 경우 이를 거절할 수 있다.
8. 임시 보직을 맡을 구성원이 없을 경우 모임의 장은 해당 보직의 역할을 임시로 겸한다.`,
            },
        ],
    },
    {
        chapter: "제3장 가입, 탈퇴 및 회비",
        rules: [
            {
                title: "제12조(시즌 회비 및 보증금)",
                content: `1. 구성원은 매 시즌 가입비 5,000원을 납부하여야 하며, 가입 시 추가로 보증금 5,000원을 납부하여야 한다.
2. 보증금은 시즌 동안 인증 실패가 누적 0회인 경우에 한하여 전액 환급한다.
3. 인증 실패가 누적 1회 이상인 경우 보증금은 환급되지 아니한다.
4. 중도 가입자의 환급 기준은 가입 이후의 주만 집계하며, 중도 탈퇴 시 환불되지 아니한다.`,
            },
            {
                title: "제13조(가입)",
                content: `1. 신규 가입은 시즌 시작 시점에 한다.
2. 중도 가입자는 가입 주는 인증 1회, 이후 주는 2회 의무를 적용한다.
3. 버닝은 가입 후 2주 경과 시 적용한다.`,
            },
            {
                title: "제14조(탈퇴)",
                content: `1. 시즌 중 탈퇴 시 가입비·보증금은 환불되지 않는다.
2. 탈퇴 주는 벌금·보증금 집계에 포함한다.`,
            },
        ],
    },
    {
        chapter: "제4장 운동 인증",
        rules: [
            {
                title: "제15조(주간 인증 의무)",
                content: `1. 구성원은 매주 2회 이상 운동을 실시하고 이를 인증하여야 한다.
2. 인증 실패의 정의는 제1조 제4항에 따른다.
3. 시즌의 시작 또는 종료 시점이 월요일 또는 일요일이 아니어서 주가 단절되는 경우에는 해당 부분 주에 한하여 인증 1회만으로 인증 성공으로 간주한다.`,
            },
            {
                title: "제16조(벌금)",
                content: `1. 벌금은 주 단위로 산정한다.
2. 해당 주의 인증 실패 1회당 5,000원을 부과하며, 한 주에 인증 실패가 2회인 경우 벌금은 10,000원으로 한다.
3. 재무담당은 월 1회 벌금 누적 내역을 공지하여야 한다.`,
            },
            {
                title: "제17조(인증 기준)",
                content: `1. 운동 인증은 다음 각 호의 요건을 충족하여야 한다.
  ① 인증 자료에는 반드시 운동 날짜, 운동 지속 시간 및 상세 데이터(심박수, 거리 등)가 기록된 사진 또는 운동 앱 화면이 포함되어야 한다.
  ② 인증 업로드는 운동 종료 당일 24시(KST)까지 하여야 하며, 기기 오류로 기록이 소실된 경우에는 운동대장의 판단하에 인정할 수 있다.
  ③ 종목별 인증 기준은 다음과 같다.
  - 러닝: 30분 이상 또는 3km 이상을 달성하여야 하며, 러닝 앱(NRC, 가민 등)의 기록 캡처(시간 또는 거리 표시)를 제출하여야 한다.
  - 걷기·산책: 1시간 이상 또는 3km 이상을 달성하여야 하며, 운동 모드가 활성화된 앱 기록을 제출하여야 한다.
  - 헬스·홈트: 총 운동 시간 30분 이상을 수행하여야 하며(세트 간 휴식 포함), 3가지 이상의 종목을 수행하여야 한다. 인증 자료는 운동 앱의 루틴 완료 화면 또는 운동 시작 시각이 표시된 사진으로 제출하여야 한다.
  - 요가·필라테스: 실제 수업 또는 개인 루틴을 30분 이상 수행하여야 하며, 심박수 데이터가 없는 경우 본인이 포함된 타임랩스 영상 또는 활동 사진과 시간 기록을 제출하여야 한다.
  - 구기 종목(축구, 농구 등): 경기 또는 연습을 30분 이상 수행하여야 하며, 가능하면 심박 또는 활동 기록을 제출하고, 부득이한 경우 활동 사진 및 시간 기록으로 대체할 수 있다.
2. 모든 인증의 최종 승인 여부는 운동대장이 판단한다.
3. 모든 인증은 하루 1회만 인증 가능한 것을 원칙으로 하나, 같은 시퀀스로 판단되지 않는 별개의 운동을 인증하는 경우, 예외적으로 추가 인증이 가능하다.
4. 1일 2회 이상 인증을 원하는 구성원은 2시간 이상의 간격을 두고 다른 시퀀스로 진행한 운동임을 인증해야 하며, 최종 인증 여부는 운동대장의 판단에 따른다.`,
            },
        ],
    },
    {
        chapter: "제5장 우수자·MVP 선정 및 보상",
        rules: [
            {
                title: "제18조(보상 재원) ★개정",
                content: `1. 본 모임의 예산 중 환급 예정인 보증금 액수를 제외한 나머지 금액을 보상 예비 재원이라 한다.
2. 보상 재원은 보상 예비 재원 중 30,000원으로 정한다.`,
            },
            {
                title: "제19조(재정 투명성)",
                content: `1. 재무담당은 시즌 종료 전 총 재원을 공개한다.
2. 시즌 중 월 1회 재정 스냅샷을 공지한다.`,
            },
            {
                title: "제20조(보상 지급) ★개정",
                content: `1. 시즌 종료 후 인증 점수와 MVP 투표 점수를 합산하여 우수자 1, 2, 3등에게 상품을 지급한다.
2. 동점이 발생한 경우에는 최근 4주 인증 횟수가 많은 자를 우선한다.
3. 보상 상품은 1~3등에게 순위에 따른 차등 없이 스타벅스 기프티쇼 10,000원권을 각각 지급한다.`,
            },
            {
                title: "제21조(우수자 선정 방식)",
                content: `1. 인증 횟수 점수 70%, MVP 투표 점수 30%를 합산하여 총점 100점 중 득점이 높은 순서대로 우수자 순위를 결정한다.
2. 인증 점수는 (참가자 인증 횟수 ÷ 최고 인증 횟수) × 70점으로 한다.
3. MVP 점수는 (유효 득표 ÷ 유효표 총합) × 30점으로 한다.`,
            },
            {
                title: "제22조(MVP 선정)",
                content: `1. MVP는 운동 횟수뿐 아니라 운동으로 이룩한 성과, 발전 등 시즌 기간 동안 괄목할 만한 성장을 이룩한 사람을 선정하는 것을 취지로 한다.
2. MVP 투표 전 각 구성원은 자랑하고자 하는 운동 성과·발전상 및 간단한 소개 문구를 이미지 파일 또는 기록 형태로 모임의 장에게 제출한다.
3. MVP 투표는 시즌 마지막 날 시행하며, 모임의 장은 제출된 자료를 취합하여 투표를 발의한다.
4. 각 구성원은 최대 2명에게 투표할 수 있으며, 자기투표는 금지한다.
5. 무효표는 집계에서 제외하며, 투표는 익명으로 진행한다.
6. MVP는 최다득표자로 선정하며, 동점자 발생 시 1위 선정 재투표를 진행한다.`,
            },
            {
                title: "제23조(버닝 시스템)",
                content: `1. 시즌 막판 동기부여를 위하여, 시즌 마지막 2주간의 인증 횟수는 2배로 계산하는 '버닝 시스템'을 운영한다.
2. 중도 가입자는 가입 후 2주 경과 시 버닝 배수를 적용한다.`,
            },
        ],
    },
    {
        chapter: "제6장 추첨 행사 (신설)",
        rules: [
            {
                title: "제24조(추첨 행사) ★신설",
                content: `1. 1~3등 순위권 밖인 회원 중 해당 시즌의 운동 인증을 빼놓지 않고 성공한 회원을 대상으로 추첨 행사를 진행한다.
2. 추첨 행사 재원은 보상 예비 재원에서 1~3등 상품 제공 후 잔여액수 중 최대 5,000×(회원 수-3)원으로 정한다.
3. 추첨 행사 재원은 5,000원 단위로 정하며, 재원이 5,000원 미만인 경우 해당 시즌 추첨 행사는 운영하지 않는다.
4. 추첨 인원수는 추첨 행사 재원을 5,000원으로 나눈 값으로 결정한다.
5. 추첨은 회원의 점수에 비례하여 확률적으로 진행하며, 회원별 당첨 확률 수식은 다음과 같다.
  - 1~3등: 0%
  - 4등 이하 대상자: (본인 총점 / 4등 이하 회원들의 총점합) × 100 (%)
6. 중복 추첨은 없으며, 1회 추첨된 이후 해당 회원은 제외하고 추첨 인원수에 따라 필요 시 재추첨을 진행한다. 재추첨 시 확률 수식은 다음과 같다.
  - 1~3등, 추첨된 회원: 0%
  - 4등 이하의 추첨되지 않은 회원: (본인 총점 / 4등 이하의 추첨되지 않은 회원들의 총점합) × 100 (%)`,
            },
        ],
    },
    {
        chapter: "제7장 투표 운영 및 분쟁",
        rules: [
            {
                title: "제25조(투표 운영) ★개정",
                content: `1. 다음 시즌 불참을 선언한 자는 본 회의의 의사결정을 위한 투표에 참여할 수 없으나, MVP 투표에는 참여할 수 있다.
2. 모든 의사결정 및 MVP 투표는 자체 개발한 앱을 활용하여 진행하며, 투표 기한은 발의 시점으로부터 24시간으로 한다.
3. 모든 투표는 모임의 장이 발의하고, 운영진이 운영한다.`,
            },
            {
                title: "제26조(분쟁 처리)",
                content: `1. 분쟁 발생 시 운영진은 24시간 내 협의 후 결정하고, 최종 결정은 48시간 내 공지한다.
2. 판정 로그는 기록하며, 새로운 증빙 제출 시 1회 재심을 허용한다.`,
            },
        ],
    },
    {
        chapter: "부칙",
        rules: [
            {
                title: "부칙 전문",
                content: `제1조(시행일) 본 규정은 2026년 3월 2일부터 시행한다.
제2조(파일럿 기간) 2025년 11월 6일부터 11월 9일까지는 파일럿 기간으로 하며, 해당 기간의 인증은 총 인증 횟수에 반영하지 않는다.
제3조(3시즌 운영 기간) 제3시즌의 운영 기간은 2026년 3월 2일부터 2026년 5월 31일까지로 한다.
제4조(3시즌 버닝 기간) 제3시즌의 버닝 기간은 2026년 5월 18일부터 2026년 5월 31일까지로 한다.
제5조(3시즌 운영진) 제3시즌의 운영진은 모임의 장 손민지, 운동대장 진현준, 재무담당 박찬진으로 한다.`,
            },
        ],
    },
];

// 신구대조표 데이터 (Ver 4.1 → Ver 5.5)
const compareData = [
    {
        clause: "제18조",
        clauseSub: "보상 재원",
        oldContent: (
            <span>
                예산 중 보증금을 제외한 금액을{" "}
                <span className="line-through text-red-600 bg-red-50 px-0.5 rounded font-bold">전액 혹은 최대 10만원까지</span>{" "}
                보상 재원으로 삼는다.
            </span>
        ),
        newContent: (
            <span>
                예산 중 보증금을 제외한 금액을{" "}
                <span className="font-bold text-emerald-700 bg-emerald-50 px-0.5 rounded">보상 예비 재원</span>
                이라 하며, 그 중{" "}
                <span className="font-bold text-emerald-700 bg-emerald-50 px-0.5 rounded">30,000원을 보상 재원</span>
                으로 확정한다.
            </span>
        ),
    },
    {
        clause: "제20조",
        clauseSub: "보상 지급",
        oldContent: (
            <span>
                우수자 1~3등에게 보상 재원을{" "}
                <span className="line-through text-red-600 bg-red-50 px-0.5 rounded font-bold">50%, 30%, 20%로 차등 배분</span>
                하고, 대상자가 상품을 선정한다.
            </span>
        ),
        newContent: (
            <span>
                순위에 따른 차등 없이{" "}
                <span className="font-bold text-emerald-700 bg-emerald-50 px-0.5 rounded">스타벅스 10,000원권으로 지급 상품을 통일</span>
                한다.
            </span>
        ),
    },
    {
        clause: "제22조",
        clauseSub: "MVP 특별상",
        oldContent: (
            <span>
                MVP 최다득표자에게{" "}
                <span className="line-through text-red-600 bg-red-50 px-0.5 rounded font-bold">스타벅스 상품권 1만원권을 별도 지급</span>
                한다.
            </span>
        ),
        newContent: (
            <span>
                MVP{" "}
                <span className="font-bold text-emerald-700 bg-emerald-50 px-0.5 rounded">특별상 지급 규정은 삭제</span>
                하고 점수 합산 시스템만 유지한다.
            </span>
        ),
    },
    {
        clause: "제24조",
        clauseSub: "추첨 행사 (신설)",
        isNew: true,
        oldContent: (
            <span className="text-slate-400 italic">— 해당 조항 없음 —</span>
        ),
        newContent: (
            <span>
                인증 0회 실패자 대상{" "}
                <span className="font-bold text-emerald-700 bg-emerald-50 px-0.5 rounded">추첨 행사 도입</span>
                <br />
                <span className="block mt-2 font-mono text-[11px] bg-slate-100 rounded-lg px-3 py-2 text-slate-700">
                    재원 = 보상 예비 재원 잔여액 중 최대 5,000×(N-3)원
                </span>
                <span className="block mt-1 font-mono text-[11px] bg-slate-100 rounded-lg px-3 py-2 text-slate-700">
                    당첨확률 = (본인 총점 / 대상자 총점합) × 100
                </span>
            </span>
        ),
    },
    {
        clause: "제25조",
        clauseSub: "투표 운영",
        oldContent: (
            <span>
                모든 투표는{" "}
                <span className="line-through text-red-600 bg-red-50 px-0.5 rounded font-bold">카카오톡 채팅방의 투표 기능</span>
                을 통해 진행한다.
            </span>
        ),
        newContent: (
            <span>
                모든 투표는{" "}
                <span className="font-bold text-emerald-700 bg-emerald-50 px-0.5 rounded">자체 개발한 전용 앱</span>
                을 활용하여 진행한다.
            </span>
        ),
    },
    {
        clause: "부칙",
        clauseSub: "시즌 기간",
        oldContent: (
            <span>
                제2시즌 기간:{" "}
                <span className="line-through text-red-600 bg-red-50 px-0.5 rounded font-bold">2026.01.01 ~ 02.28</span>
            </span>
        ),
        newContent: (
            <span>
                제3시즌 기간:{" "}
                <span className="font-bold text-emerald-700 bg-emerald-50 px-0.5 rounded">2026.03.02 ~ 05.31</span>
                <br />
                <span className="text-[11px] text-slate-500">(버닝: 2026.05.18 ~ 05.31)</span>
            </span>
        ),
    },
];

function highlightText(text: string, query: string) {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="bg-amber-200 text-primary rounded-sm px-0.5 not-italic font-bold">{part}</mark>
                    : <span key={i}>{part}</span>
            )}
        </>
    );
}

function RuleItem({ rule, query, color }: { rule: { title: string; content: string }; query: string; color: typeof chapterColors[0] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={cn("rounded-2xl overflow-hidden transition-all", open ? "bg-white shadow-md" : "bg-white shadow-sm")}>
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 group"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-1.5 h-5 rounded-full shrink-0 transition-all", color.bg, open ? "opacity-100" : "opacity-30")} />
                    <span className={cn("font-bold text-sm transition-colors", open ? "text-primary" : "text-slate-600")}>
                        {highlightText(rule.title, query)}
                    </span>
                </div>
                <ChevronDown
                    size={16}
                    className={cn("shrink-0 text-slate-300 transition-transform duration-300 group-hover:text-slate-400", open && "rotate-180 text-slate-400")}
                />
            </button>
            {open && (
                <div className="px-5 pb-5 pt-1">
                    <div className={cn("rounded-2xl p-4", color.light)}>
                        <p className={cn("text-xs leading-relaxed whitespace-pre-wrap", color.text, "font-medium")}>
                            {highlightText(rule.content, query)}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RulebookPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeView, setActiveView] = useState<"fulltext" | "compare">("fulltext");

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return rulebookData;
        const q = searchQuery.toLowerCase();
        return rulebookData.map(ch => ({
            ...ch,
            rules: ch.rules.filter(r =>
                r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
            ),
        })).filter(ch => ch.rules.length > 0);
    }, [searchQuery]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white shadow-sm px-4 pt-4 pb-3 space-y-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shrink-0">
                        <ChevronLeft size={20} />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-black text-primary">공식 규정집</h1>
                        <p className="text-[11px] text-slate-400 font-bold">Ver 5.5 · 개정일 2026.02.23 · 시행일 2026.03.02</p>
                    </div>
                    <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0">
                        <BookOpen size={18} className="text-accent" />
                    </div>
                </div>

                {/* View Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveView("fulltext")}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                            activeView === "fulltext" ? "bg-white text-primary shadow-sm" : "text-slate-500"
                        )}
                    >
                        규정집 전문
                    </button>
                    <button
                        onClick={() => setActiveView("compare")}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                            activeView === "compare" ? "bg-white text-primary shadow-sm" : "text-slate-500"
                        )}
                    >
                        신구대조표
                    </button>
                </div>

                {/* Search (fulltext only) */}
                {activeView === "fulltext" && (
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <Input
                            placeholder="조항 번호, 제목, 단어 검색 (예: 18조, 벌금, 러닝...)"
                            className="pl-10 h-11 rounded-2xl bg-slate-50 border-none text-sm placeholder:text-slate-300 focus-visible:ring-amber-300"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                                <X size={15} />
                            </button>
                        )}
                    </div>
                )}
            </header>

            {/* 규정집 전문 */}
            {activeView === "fulltext" && (
                <main className="px-4 pt-5 pb-24 space-y-8">
                    {filteredData.length > 0 ? filteredData.map((section, idx) => {
                        const color = chapterColors[idx % chapterColors.length];
                        const Icon = chapterIcons[idx % chapterIcons.length];
                        return (
                            <section key={idx} className="space-y-3">
                                <div className="flex items-center gap-3 px-1">
                                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", color.bg)}>
                                        <Icon size={15} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-primary tracking-tight">{section.chapter}</p>
                                        <p className="text-[10px] text-slate-400 font-bold">{section.rules.length}개 조항</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {section.rules.map((rule, ruleIdx) => (
                                        <RuleItem key={ruleIdx} rule={rule} query={searchQuery} color={color} />
                                    ))}
                                </div>
                            </section>
                        );
                    }) : (
                        <div className="py-24 flex flex-col items-center justify-center text-slate-300 space-y-3">
                            <Search size={44} strokeWidth={1.5} />
                            <p className="text-sm font-bold">검색 결과가 없습니다.</p>
                            <button onClick={() => setSearchQuery("")} className="text-xs text-amber-500 font-black">
                                전체 보기로 돌아가기
                            </button>
                        </div>
                    )}

                    {/* Notice */}
                    <div className="bg-primary rounded-3xl p-6 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-accent/20 rounded-lg flex items-center justify-center">
                                <Shield size={14} className="text-accent" />
                            </div>
                            <h3 className="font-black text-white text-sm">유의사항</h3>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed font-medium">
                            규정 위반 시 벌금이 부과되며, 고의적인 부정 인증은 즉시 강퇴 사유가 될 수 있습니다. 모든 인증은 <span className="text-accent font-black">당일 업로드</span>를 원칙으로 합니다.
                        </p>
                    </div>
                </main>
            )}

            {/* 신구대조표 */}
            {activeView === "compare" && (
                <main className="px-4 pt-5 pb-24 space-y-4">
                    {/* 타이틀 */}
                    <div className="flex items-center justify-between px-1">
                        <div>
                            <p className="text-sm font-black text-primary">정밀 신구대조표</p>
                            <p className="text-[11px] text-slate-400 font-bold mt-0.5">Ver 4.1 → Ver 5.5</p>
                        </div>
                        <span className="text-[10px] font-black px-2.5 py-1 bg-blue-100 text-blue-600 rounded-full">6개 조항 개정</span>
                    </div>

                    {/* 범례 */}
                    <div className="flex gap-3 px-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] line-through text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-bold">기존</span>
                            <span className="text-[10px] text-slate-400">삭제·변경</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">개정</span>
                            <span className="text-[10px] text-slate-400">신규·변경</span>
                        </div>
                    </div>

                    {/* 대조표 카드 */}
                    {compareData.map((row, i) => (
                        <div key={i} className={cn(
                            "bg-white rounded-2xl shadow-sm overflow-hidden",
                            row.isNew && "ring-2 ring-green-200"
                        )}>
                            <div className={cn(
                                "px-4 py-3 border-b flex items-center justify-between",
                                row.isNew ? "bg-green-50 border-green-100" : "bg-slate-50 border-slate-100"
                            )}>
                                <div>
                                    <span className={cn("text-sm font-black", row.isNew ? "text-green-700" : "text-primary")}>{row.clause}</span>
                                    <span className="text-[11px] text-slate-400 font-bold ml-2">{row.clauseSub}</span>
                                </div>
                                {row.isNew && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-green-500 text-white rounded-full">신설</span>
                                )}
                            </div>
                            <div className="divide-y divide-slate-50">
                                <div className="p-4 space-y-1.5">
                                    <span className="text-[10px] font-black text-red-400 tracking-wide">기존 규정 (Ver 4.1)</span>
                                    <p className="text-xs text-slate-600 leading-relaxed">{row.oldContent}</p>
                                </div>
                                <div className="p-4 space-y-1.5">
                                    <span className="text-[10px] font-black text-emerald-600 tracking-wide">개정 규정 (Ver 5.5)</span>
                                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{row.newContent}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* 개정 핵심 요약 */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                        <p className="text-sm font-black text-amber-800">개정 핵심 요약</p>
                        <ul className="space-y-2.5">
                            <li className="flex items-start gap-2 text-xs text-amber-700">
                                <span className="shrink-0 font-black text-amber-500 mt-0.5">●</span>
                                <span><strong>보상 고정화:</strong> 보상 재원을 3만원으로 고정하여 운영 예측 가능성을 높임.</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs text-amber-700">
                                <span className="shrink-0 font-black text-amber-500 mt-0.5">●</span>
                                <span><strong>추첨제 도입:</strong> 1~3등이 아니더라도 성실히 인증한 멤버들에게 남은 예산으로 보상 기회 제공.</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs text-amber-700">
                                <span className="shrink-0 font-black text-amber-500 mt-0.5">●</span>
                                <span><strong>디지털 전환:</strong> 카톡 투표에서 자체 앱 투표로 변경하여 데이터 관리 및 참여 편의성 증대.</span>
                            </li>
                        </ul>
                    </div>
                </main>
            )}
        </div>
    );
}
