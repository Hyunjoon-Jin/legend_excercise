"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    Plus, ChevronUp, ChevronDown, Trash2, Loader2, BarChart2,
    ClipboardList, PenSquare, Users, CheckCircle2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
    getSurveys,
    getSurveyWithQuestions,
    createSurvey,
    deleteSurvey,
    toggleSurveyActive,
    submitSurveyResponse,
    getSurveyAnswers,
} from "@/lib/data";
import type { Survey, SurveyQuestion, SurveyOption, SurveyAnswer } from "@/types/database";

// ─── Local helpers ────────────────────────────────────────────────────────────

type QuestionType = 'single_choice' | 'multiple_choice' | 'short_text' | 'long_text' | 'number';

const Q_TYPE_LABELS: Record<QuestionType, string> = {
    single_choice: '단일 선택',
    multiple_choice: '복수 선택',
    short_text: '단답형',
    long_text: '서술형',
    number: '숫자 입력',
};

const Q_TYPE_COLORS: Record<QuestionType, string> = {
    single_choice: 'bg-blue-100 text-blue-700',
    multiple_choice: 'bg-purple-100 text-purple-700',
    short_text: 'bg-green-100 text-green-700',
    long_text: 'bg-teal-100 text-teal-700',
    number: 'bg-orange-100 text-orange-700',
};

function getDisplayName(profiles?: { username?: string; display_name?: string } | null) {
    return profiles?.display_name || profiles?.username || '알 수 없음';
}

interface SurveyWithQuestions extends Survey {
    questions: SurveyQuestion[];
}

// ─── Draft types for create modal ────────────────────────────────────────────

interface OptionDraft {
    id: string;
    text: string;
    jumpToIndex: string; // '' = default, '-1' = end, '0'/'1'/... = question index
}

interface QuestionDraft {
    id: string;
    type: QuestionType;
    title: string;
    description: string;
    required: boolean;
    numberMin: string;
    numberMax: string;
    options: OptionDraft[];
    jumpToIndex: string; // '' = default, '-1' = end, '0'/'1'/... = question index
}

function makeOption(): OptionDraft {
    return { id: crypto.randomUUID(), text: '', jumpToIndex: '' };
}

function makeQuestion(): QuestionDraft {
    return {
        id: crypto.randomUUID(),
        type: 'single_choice',
        title: '',
        description: '',
        required: true,
        numberMin: '',
        numberMax: '',
        options: [makeOption(), makeOption()],
        jumpToIndex: '',
    };
}

// ─── JumpToSelector ───────────────────────────────────────────────────────────

function JumpToSelector({
    value,
    onChange,
    questions,
    currentIndex,
    label = "이 문항 이후 이동",
}: {
    value: string;
    onChange: (v: string) => void;
    questions: QuestionDraft[];
    currentIndex: number;
    label?: string;
}) {
    return (
        <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">{label}:</span>
            <div className="flex-1 min-w-0">
                <Select value={value || '__default__'} onValueChange={v => onChange(v === '__default__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__default__">다음 문항 순서대로</SelectItem>
                        <SelectItem value="-1">— 설문 종료 —</SelectItem>
                        {questions.map((q, idx) => {
                            if (idx === currentIndex) return null;
                            return (
                                <SelectItem key={q.id} value={String(idx)}>
                                    문항 {idx + 1}: {q.title || '(제목 없음)'}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

// ─── Survey Create Modal ──────────────────────────────────────────────────────

function SurveyCreateModal({
    open,
    onClose,
    userId,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    userId: string;
    onCreated: () => void;
}) {
    const [step, setStep] = useState<'info' | 'questions'>('info');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [showResults, setShowResults] = useState(true);
    const [questions, setQuestions] = useState<QuestionDraft[]>(() => {
        const q = makeQuestion();
        return [q];
    });
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            const q = makeQuestion();
            setStep('info');
            setTitle('');
            setDescription('');
            setShowResults(true);
            setQuestions([q]);
            setExpandedId(q.id);
        }
    }, [open]);

    const handleClose = () => onClose();

    // Question helpers
    const updateQ = (id: string, patch: Partial<QuestionDraft>) =>
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));

    const addQuestion = () => {
        const q = makeQuestion();
        setQuestions(prev => [...prev, q]);
        setExpandedId(q.id);
    };

    const removeQuestion = (id: string) => {
        setQuestions(prev => {
            if (prev.length <= 1) return prev;
            const next = prev.filter(q => q.id !== id);
            setExpandedId(next[next.length - 1]?.id ?? null);
            return next;
        });
    };

    const moveQuestion = (idx: number, dir: -1 | 1) => {
        setQuestions(prev => {
            const next = [...prev];
            const target = idx + dir;
            if (target < 0 || target >= next.length) return prev;
            [next[idx], next[target]] = [next[target], next[idx]];
            return next;
        });
    };

    const updateOption = (qId: string, optId: string, patch: Partial<OptionDraft>) =>
        setQuestions(prev => prev.map(q => q.id !== qId ? q : {
            ...q,
            options: q.options.map(o => o.id === optId ? { ...o, ...patch } : o),
        }));

    const addOption = (qId: string) =>
        setQuestions(prev => prev.map(q => q.id !== qId ? q : {
            ...q, options: [...q.options, makeOption()],
        }));

    const removeOption = (qId: string, optId: string) =>
        setQuestions(prev => prev.map(q => q.id !== qId ? q : {
            ...q, options: q.options.filter(o => o.id !== optId),
        }));

    const handleSubmit = async () => {
        if (!title.trim()) return;
        for (const q of questions) {
            if (!q.title.trim()) { alert('모든 문항에 제목을 입력해주세요.'); return; }
            if (['single_choice', 'multiple_choice'].includes(q.type) && q.options.some(o => !o.text.trim())) {
                alert('모든 선택지에 내용을 입력해주세요.'); return;
            }
        }
        setSubmitting(true);
        const { error } = await createSurvey(
            userId,
            { title: title.trim(), description: description.trim() || undefined, show_results_after_submit: showResults },
            questions.map(q => ({
                type: q.type,
                title: q.title.trim(),
                description: q.description.trim() || undefined,
                required: q.required,
                number_min: q.numberMin !== '' ? Number(q.numberMin) : null,
                number_max: q.numberMax !== '' ? Number(q.numberMax) : null,
                jump_to_index: q.jumpToIndex === '' ? null : q.jumpToIndex === '-1' ? -1 : Number(q.jumpToIndex),
                options: ['single_choice', 'multiple_choice'].includes(q.type)
                    ? q.options.map(o => ({
                        text: o.text.trim(),
                        jump_to_index: o.jumpToIndex === '' ? null : o.jumpToIndex === '-1' ? -1 : Number(o.jumpToIndex),
                    }))
                    : [],
            }))
        );
        setSubmitting(false);
        if (error) { alert('설문 생성 중 오류가 발생했습니다.'); return; }
        onCreated();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="w-[calc(100vw-2rem)] max-w-[520px] mx-auto max-h-[90vh] overflow-x-hidden overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'info' ? '새 설문 만들기' : '문항 구성'}
                    </DialogTitle>
                </DialogHeader>

                {step === 'info' ? (
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">설문 제목 *</label>
                            <Input
                                placeholder="설문 제목을 입력하세요"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">설명 (선택)</label>
                            <textarea
                                placeholder="설문 설명이나 안내사항"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <p className="text-sm font-semibold text-slate-700">응답 후 결과 공개</p>
                                <p className="text-xs text-slate-400">응답자가 제출 후 결과를 볼 수 있습니다</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowResults(!showResults)}
                                className={cn(
                                    "relative w-11 h-6 rounded-full transition-colors",
                                    showResults ? "bg-indigo-500" : "bg-slate-300"
                                )}
                            >
                                <span className={cn(
                                    "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                                    showResults ? "translate-x-5" : "translate-x-0"
                                )} />
                            </button>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={handleClose}>취소</Button>
                            <Button
                                size="sm"
                                disabled={!title.trim()}
                                onClick={() => setStep('questions')}
                                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                            >
                                다음: 문항 구성 →
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 pt-2">
                        {questions.map((q, idx) => (
                            <div key={q.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                {/* Question header (click to expand) */}
                                <div
                                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                                >
                                    <span className="text-xs font-black text-slate-400 w-4 text-center shrink-0">{idx + 1}</span>
                                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0", Q_TYPE_COLORS[q.type])}>
                                        {Q_TYPE_LABELS[q.type]}
                                    </span>
                                    <span className="flex-1 text-sm text-slate-700 truncate min-w-0">
                                        {q.title || <span className="text-slate-400 italic">제목 없음</span>}
                                    </span>
                                    {q.required && <span className="text-[10px] text-red-400 shrink-0">*</span>}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        <button onClick={e => { e.stopPropagation(); moveQuestion(idx, -1); }} disabled={idx === 0}
                                            className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 transition-colors">
                                            <ChevronUp size={12} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); moveQuestion(idx, 1); }} disabled={idx === questions.length - 1}
                                            className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 transition-colors">
                                            <ChevronDown size={12} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); removeQuestion(q.id); }} disabled={questions.length <= 1}
                                            className="p-1 hover:bg-red-100 text-red-400 rounded disabled:opacity-30 transition-colors">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded editor */}
                                {expandedId === q.id && (
                                    <div className="p-3 space-y-3 border-t border-slate-100">
                                        {/* Type selector */}
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">문항 유형</label>
                                            <Select
                                                value={q.type}
                                                onValueChange={val => {
                                                    const newType = val as QuestionType;
                                                    updateQ(q.id, {
                                                        type: newType,
                                                        options: ['single_choice', 'multiple_choice'].includes(newType)
                                                            ? (q.options.length >= 2 ? q.options : [makeOption(), makeOption()])
                                                            : q.options,
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(Object.entries(Q_TYPE_LABELS) as [QuestionType, string][]).map(([val, label]) => (
                                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Title */}
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">문항 제목 *</label>
                                            <Input
                                                placeholder="질문을 입력하세요"
                                                value={q.title}
                                                onChange={e => updateQ(q.id, { title: e.target.value })}
                                                className="text-sm"
                                            />
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">부가 설명 (선택)</label>
                                            <Input
                                                placeholder="질문에 대한 추가 설명"
                                                value={q.description}
                                                onChange={e => updateQ(q.id, { description: e.target.value })}
                                                className="text-sm"
                                            />
                                        </div>

                                        {/* Required toggle */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`req-${q.id}`}
                                                checked={q.required}
                                                onChange={e => updateQ(q.id, { required: e.target.checked })}
                                                className="w-4 h-4 accent-indigo-500"
                                            />
                                            <label htmlFor={`req-${q.id}`} className="text-xs text-slate-600 cursor-pointer">필수 응답 문항</label>
                                        </div>

                                        {/* Number min/max */}
                                        {q.type === 'number' && (
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">최솟값</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="없음"
                                                        value={q.numberMin}
                                                        onChange={e => updateQ(q.id, { numberMin: e.target.value })}
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">최댓값</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="없음"
                                                        value={q.numberMax}
                                                        onChange={e => updateQ(q.id, { numberMax: e.target.value })}
                                                        className="text-sm"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Choice options */}
                                        {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-500 block">선택지</label>
                                                {q.options.map((opt, optIdx) => (
                                                    <div key={opt.id} className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-400 w-4 text-center shrink-0">{optIdx + 1}</span>
                                                            <Input
                                                                placeholder={`선택지 ${optIdx + 1}`}
                                                                value={opt.text}
                                                                onChange={e => updateOption(q.id, opt.id, { text: e.target.value })}
                                                                className="flex-1 text-sm h-8"
                                                            />
                                                            <button
                                                                onClick={() => removeOption(q.id, opt.id)}
                                                                disabled={q.options.length <= 2}
                                                                className="text-slate-300 hover:text-red-400 disabled:opacity-20 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                        {/* Per-option jump_to for single_choice */}
                                                        {q.type === 'single_choice' && (
                                                            <div className="ml-6 pl-2 border-l-2 border-slate-100">
                                                                <JumpToSelector
                                                                    value={opt.jumpToIndex}
                                                                    onChange={v => updateOption(q.id, opt.id, { jumpToIndex: v })}
                                                                    questions={questions}
                                                                    currentIndex={idx}
                                                                    label="선택 시 이동"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addOption(q.id)}
                                                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 mt-1 transition-colors"
                                                >
                                                    <Plus size={12} /> 선택지 추가
                                                </button>
                                            </div>
                                        )}

                                        {/* Question-level jump_to */}
                                        <div className="pt-1 border-t border-slate-100">
                                            {q.type === 'single_choice' ? (
                                                <p className="text-[10px] text-slate-400">* 단일 선택: 각 선택지에서 이동 설정 가능</p>
                                            ) : (
                                                <JumpToSelector
                                                    value={q.jumpToIndex}
                                                    onChange={v => updateQ(q.id, { jumpToIndex: v })}
                                                    questions={questions}
                                                    currentIndex={idx}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        <button
                            onClick={addQuestion}
                            className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors text-sm"
                        >
                            <Plus size={16} /> 문항 추가
                        </button>

                        <div className="flex gap-2 justify-end pt-1">
                            <Button variant="outline" size="sm" onClick={() => setStep('info')}>← 이전</Button>
                            <Button variant="outline" size="sm" onClick={handleClose}>취소</Button>
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                            >
                                {submitting ? <><Loader2 size={14} className="animate-spin mr-1" />저장 중...</> : '설문 생성'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Survey Take Modal ────────────────────────────────────────────────────────

function SurveyTakeModal({
    surveyId,
    userId,
    onClose,
    onSubmitted,
}: {
    surveyId: string;
    userId: string;
    onClose: () => void;
    onSubmitted: (showResults: boolean) => void;
}) {
    const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<SurveyQuestion[]>([]);
    const [currentQ, setCurrentQ] = useState<SurveyQuestion | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [done, setDone] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        const load = async () => {
            const { data } = await getSurveyWithQuestions(surveyId);
            if (data && data.questions.length > 0) {
                setSurvey(data as SurveyWithQuestions);
                setCurrentQ(data.questions[0]);
                setHistory([data.questions[0]]);
            }
            setLoading(false);
        };
        load();
    }, [surveyId]);

    const getNextQ = (q: SurveyQuestion, answerVal: string, questions: SurveyQuestion[]): SurveyQuestion | null => {
        let jumpTo: string | null = null;
        if (q.type === 'single_choice' && answerVal) {
            const selectedOpt = q.options?.find(o => o.id === answerVal);
            if (selectedOpt?.jump_to) jumpTo = selectedOpt.jump_to;
        }
        if (!jumpTo && q.jump_to) jumpTo = q.jump_to;
        if (jumpTo === 'end') return null;
        if (jumpTo) {
            const target = questions.find(qq => qq.id === jumpTo);
            if (target) return target;
        }
        return questions.find(qq => qq.order_index === q.order_index + 1) ?? null;
    };

    const currentAnswer = currentQ ? (answers[currentQ.id] ?? '') : '';

    const handleNext = async () => {
        if (!currentQ || !survey) return;

        if (currentQ.required && !currentAnswer.trim()) {
            setValidationError('이 문항은 필수 응답입니다.');
            return;
        }
        if (currentQ.type === 'number' && currentAnswer !== '') {
            const num = Number(currentAnswer);
            if (isNaN(num)) { setValidationError('숫자를 입력해주세요.'); return; }
            if (currentQ.number_min != null && num < currentQ.number_min) {
                setValidationError(`최솟값은 ${currentQ.number_min}입니다.`); return;
            }
            if (currentQ.number_max != null && num > currentQ.number_max) {
                setValidationError(`최댓값은 ${currentQ.number_max}입니다.`); return;
            }
        }
        setValidationError('');

        const next = getNextQ(currentQ, currentAnswer, survey.questions);
        if (!next) {
            await handleSubmit();
        } else {
            setHistory(prev => [...prev, next]);
            setCurrentQ(next);
        }
    };

    const handleBack = () => {
        if (history.length <= 1) return;
        setValidationError('');
        const prev = history[history.length - 2];
        setHistory(h => h.slice(0, -1));
        setCurrentQ(prev);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        const { error: submitError } = await submitSurveyResponse(surveyId, userId, answers);
        setSubmitting(false);
        if (submitError) { setValidationError('제출 중 오류가 발생했습니다.'); return; }
        setDone(true);
    };

    const isLastQuestion = (): boolean => {
        if (!currentQ || !survey) return true;
        return getNextQ(currentQ, currentAnswer, survey.questions) === null;
    };

    const totalQ = survey?.questions.length ?? 0;
    const progressPct = currentQ ? ((currentQ.order_index + 1) / Math.max(totalQ, 1)) * 100 : 0;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-[440px] mx-auto max-h-[90vh] overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-slate-300" size={28} />
                    </div>
                ) : done ? (
                    <div className="py-10 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 size={32} className="text-green-500" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800">제출 완료!</h3>
                        <p className="text-sm text-slate-500">응답해주셔서 감사합니다.</p>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
                            {survey?.show_results_after_submit && (
                                <Button
                                    size="sm"
                                    onClick={() => onSubmitted(true)}
                                    className="bg-indigo-500 hover:bg-indigo-600 text-white"
                                >
                                    <BarChart2 size={14} className="mr-1" /> 결과 보기
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-base leading-tight">{survey?.title}</DialogTitle>
                            {survey?.description && (
                                <p className="text-xs text-slate-400 mt-1">{survey.description}</p>
                            )}
                        </DialogHeader>

                        {/* Progress bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>문항 {(currentQ?.order_index ?? 0) + 1} / {totalQ}</span>
                                <span>{Math.round(progressPct)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>

                        {/* Current question */}
                        {currentQ && (
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", Q_TYPE_COLORS[currentQ.type as QuestionType])}>
                                            {Q_TYPE_LABELS[currentQ.type as QuestionType]}
                                        </span>
                                        {currentQ.required && <span className="text-red-400 text-xs font-bold">*필수</span>}
                                    </div>
                                    <p className="font-bold text-slate-800 text-sm leading-snug">{currentQ.title}</p>
                                    {currentQ.description && (
                                        <p className="text-xs text-slate-400 mt-1.5">{currentQ.description}</p>
                                    )}
                                </div>

                                {/* Answer area by type */}
                                {currentQ.type === 'single_choice' && (
                                    <div className="space-y-2">
                                        {currentQ.options?.map(opt => (
                                            <label key={opt.id} className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors",
                                                currentAnswer === opt.id
                                                    ? "border-indigo-400 bg-indigo-50"
                                                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                            )}>
                                                <input
                                                    type="radio"
                                                    name={currentQ.id}
                                                    value={opt.id}
                                                    checked={currentAnswer === opt.id}
                                                    onChange={() => setAnswers(prev => ({ ...prev, [currentQ.id]: opt.id }))}
                                                    className="w-4 h-4 accent-indigo-500"
                                                />
                                                <span className="text-sm text-slate-700">{opt.text}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {currentQ.type === 'multiple_choice' && (
                                    <div className="space-y-2">
                                        {currentQ.options?.map(opt => {
                                            const selected = currentAnswer.split(',').filter(Boolean);
                                            const isChecked = selected.includes(opt.id);
                                            const toggle = () => {
                                                const next = isChecked
                                                    ? selected.filter(s => s !== opt.id)
                                                    : [...selected, opt.id];
                                                setAnswers(prev => ({ ...prev, [currentQ.id]: next.join(',') }));
                                            };
                                            return (
                                                <label key={opt.id} className={cn(
                                                    "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors",
                                                    isChecked ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
                                                )}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={toggle}
                                                        className="w-4 h-4 accent-indigo-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{opt.text}</span>
                                                </label>
                                            );
                                        })}
                                        <p className="text-xs text-slate-400">* 여러 개 선택 가능</p>
                                    </div>
                                )}

                                {currentQ.type === 'short_text' && (
                                    <Input
                                        placeholder="답변을 입력하세요"
                                        value={currentAnswer}
                                        onChange={e => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                                        className="text-sm"
                                    />
                                )}

                                {currentQ.type === 'long_text' && (
                                    <textarea
                                        placeholder="답변을 자유롭게 입력하세요"
                                        value={currentAnswer}
                                        onChange={e => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                                        rows={4}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                                    />
                                )}

                                {currentQ.type === 'number' && (
                                    <div>
                                        <Input
                                            type="number"
                                            placeholder={
                                                currentQ.number_min != null && currentQ.number_max != null
                                                    ? `${currentQ.number_min} ~ ${currentQ.number_max}`
                                                    : '숫자를 입력하세요'
                                            }
                                            value={currentAnswer}
                                            onChange={e => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
                                            min={currentQ.number_min ?? undefined}
                                            max={currentQ.number_max ?? undefined}
                                            className="text-sm"
                                        />
                                        {(currentQ.number_min != null || currentQ.number_max != null) && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                {currentQ.number_min != null && `최솟값: ${currentQ.number_min}`}
                                                {currentQ.number_min != null && currentQ.number_max != null && '  ·  '}
                                                {currentQ.number_max != null && `최댓값: ${currentQ.number_max}`}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {validationError && (
                                    <p className="text-xs text-red-500 font-medium">{validationError}</p>
                                )}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-2 justify-between pt-2 border-t border-slate-100">
                            <div>
                                {history.length > 1 && (
                                    <Button variant="outline" size="sm" onClick={handleBack}>← 이전</Button>
                                )}
                            </div>
                            <Button
                                size="sm"
                                onClick={handleNext}
                                disabled={submitting}
                                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                            >
                                {submitting && <Loader2 size={14} className="animate-spin mr-1" />}
                                {isLastQuestion() ? '제출하기' : '다음 →'}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Survey Results Modal ─────────────────────────────────────────────────────

function SurveyResultsModal({
    surveyId,
    onClose,
}: {
    surveyId: string;
    onClose: () => void;
}) {
    const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
    const [responseCount, setResponseCount] = useState(0);
    const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const [surveyRes, answersRes] = await Promise.all([
            getSurveyWithQuestions(surveyId),
            getSurveyAnswers(surveyId),
        ]);
        if (surveyRes.data) setSurvey(surveyRes.data as SurveyWithQuestions);
        if (answersRes.data) {
            setResponseCount(answersRes.data.responseCount);
            setAnswers(answersRes.data.answers);
        }
        setLoading(false);
    }, [surveyId]);

    useEffect(() => { load(); }, [load]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [load]);

    const getOptionCounts = (qId: string, options: SurveyOption[]) => {
        const qAnswers = answers.filter(a => a.question_id === qId);
        const counts: Record<string, number> = {};
        options.forEach(o => { counts[o.id] = 0; });
        qAnswers.forEach(a => {
            if (!a.answer_text) return;
            a.answer_text.split(',').forEach(optId => {
                if (counts[optId] !== undefined) counts[optId]++;
            });
        });
        const total = Object.values(counts).reduce((s, c) => s + c, 0);
        return { counts, total };
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-[520px] mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-2">
                        <DialogTitle className="text-base leading-tight flex-1">
                            {loading ? '결과 불러오는 중...' : survey?.title}
                        </DialogTitle>
                        <Button variant="outline" size="sm" onClick={load} className="text-xs h-7 shrink-0">
                            <Loader2 size={11} className="mr-1" /> 새로고침
                        </Button>
                    </div>
                    {!loading && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <Users size={13} className="text-indigo-400" />
                            <span className="text-xs text-slate-500 font-semibold">{responseCount}명 응답</span>
                        </div>
                    )}
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="animate-spin text-slate-300" size={28} />
                    </div>
                ) : responseCount === 0 ? (
                    <div className="py-12 text-center">
                        <BarChart2 size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-sm text-slate-400">아직 응답이 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-4 pt-1">
                        {survey?.questions.map((q, idx) => {
                            const qAnswers = answers.filter(a => a.question_id === q.id);
                            return (
                                <div key={q.id} className="bg-slate-50 rounded-xl p-4 space-y-3">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-xs font-black text-slate-400">Q{idx + 1}</span>
                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", Q_TYPE_COLORS[q.type as QuestionType])}>
                                                {Q_TYPE_LABELS[q.type as QuestionType]}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">{q.title}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{qAnswers.length}명 응답</p>
                                    </div>

                                    {/* Choice results: bar chart */}
                                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && q.options && (() => {
                                        const { counts, total } = getOptionCounts(q.id, q.options);
                                        return (
                                            <div className="space-y-2">
                                                {q.options.map(opt => {
                                                    const count = counts[opt.id] ?? 0;
                                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                                    return (
                                                        <div key={opt.id}>
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="text-slate-700 font-medium">{opt.text}</span>
                                                                <span className="font-bold text-slate-500 ml-2 shrink-0">{count}명 ({pct}%)</span>
                                                            </div>
                                                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* Number results: stats */}
                                    {q.type === 'number' && (() => {
                                        const nums = qAnswers
                                            .filter(a => a.answer_text != null && a.answer_text !== '')
                                            .map(a => Number(a.answer_text))
                                            .filter(n => !isNaN(n));
                                        if (nums.length === 0) return <p className="text-xs text-slate-400">응답 없음</p>;
                                        const avg = (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1);
                                        return (
                                            <div className="flex gap-6">
                                                <div className="text-center">
                                                    <p className="text-[10px] text-slate-400 mb-0.5">평균</p>
                                                    <p className="text-lg font-black text-indigo-600">{avg}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] text-slate-400 mb-0.5">최솟값</p>
                                                    <p className="text-lg font-black text-slate-600">{Math.min(...nums)}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] text-slate-400 mb-0.5">최댓값</p>
                                                    <p className="text-lg font-black text-slate-600">{Math.max(...nums)}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] text-slate-400 mb-0.5">응답 수</p>
                                                    <p className="text-lg font-black text-slate-600">{nums.length}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Text results: list */}
                                    {(q.type === 'short_text' || q.type === 'long_text') && (
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {qAnswers.filter(a => a.answer_text?.trim()).length === 0 ? (
                                                <p className="text-xs text-slate-400">응답 없음</p>
                                            ) : (
                                                qAnswers.filter(a => a.answer_text?.trim()).map(a => (
                                                    <div key={a.id} className="bg-white rounded-lg p-2.5 border border-slate-100">
                                                        <p className="text-xs text-slate-600 leading-relaxed">"{a.answer_text}"</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Survey Tab (Main Export) ─────────────────────────────────────────────────

export function SurveyTab({
    userId,
    isAdmin,
    boardChannelRef,
}: {
    userId: string;
    isAdmin: boolean;
    boardChannelRef: React.MutableRefObject<any>;
}) {
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
    const [myResponseIds, setMyResponseIds] = useState<Set<string>>(new Set());
    const [showCreate, setShowCreate] = useState(false);
    const [takingSurveyId, setTakingSurveyId] = useState<string | null>(null);
    const [viewingResultsId, setViewingResultsId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const { data: surveysData } = await getSurveys();
        if (surveysData) setSurveys(surveysData);

        // Fetch all responses in one query to get counts + my responses
        const { data: allResponses } = await supabase
            .from('survey_responses')
            .select('survey_id, user_id')
            .eq('is_complete', true);

        if (allResponses) {
            const counts: Record<string, number> = {};
            const mine = new Set<string>();
            allResponses.forEach((r: any) => {
                counts[r.survey_id] = (counts[r.survey_id] || 0) + 1;
                if (r.user_id === userId) mine.add(r.survey_id);
            });
            setResponseCounts(counts);
            setMyResponseIds(mine);
        }
        setLoading(false);
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    // Real-time: listen for survey updates from other users
    useEffect(() => {
        const channel = supabase
            .channel("survey_live")
            .on("broadcast", { event: "surveys_updated" }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [load]);

    const handleDelete = async (id: string) => {
        if (!confirm('이 설문을 삭제하시겠습니까? 모든 응답도 함께 삭제됩니다.')) return;
        await deleteSurvey(id);
        setSurveys(prev => prev.filter(s => s.id !== id));
        boardChannelRef.current?.send({ type: "broadcast", event: "surveys_updated", payload: {} });
    };

    const handleToggleActive = async (id: string, current: boolean) => {
        await toggleSurveyActive(id, !current);
        setSurveys(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s));
        boardChannelRef.current?.send({ type: "broadcast", event: "surveys_updated", payload: {} });
    };

    const handleCreated = () => {
        load();
        boardChannelRef.current?.send({ type: "broadcast", event: "surveys_updated", payload: {} });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                <span className="text-sm text-slate-500 font-medium">설문 {surveys.length}</span>
                <Button
                    size="sm"
                    onClick={() => setShowCreate(true)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs h-8 gap-1.5"
                >
                    <Plus size={13} />
                    설문 만들기
                </Button>
            </div>

            {/* Survey list */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 size={24} className="animate-spin text-slate-300" />
                    </div>
                ) : surveys.length === 0 ? (
                    <div className="text-center py-16">
                        <ClipboardList size={36} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-sm text-slate-400">아직 설문이 없습니다.</p>
                        <p className="text-xs text-slate-300 mt-1">첫 설문을 만들어보세요!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {surveys.map(survey => {
                            const hasResponded = myResponseIds.has(survey.id);
                            const count = responseCounts[survey.id] ?? 0;
                            const isOwner = survey.user_id === userId;

                            return (
                                <div key={survey.id} className="px-4 py-4">
                                    <div className="mb-2.5">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <span className={cn(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                survey.is_active
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-slate-100 text-slate-500"
                                            )}>
                                                {survey.is_active ? '● 진행 중' : '○ 종료됨'}
                                            </span>
                                            {hasResponded && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                                                    ✓ 응답 완료
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-bold text-slate-800 text-sm">{survey.title}</p>
                                        {survey.description && (
                                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{survey.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                                            <span className="font-medium text-slate-500">{getDisplayName(survey.profiles)}</span>
                                            <span>·</span>
                                            <span className="flex items-center gap-0.5">
                                                <Users size={10} /> {count}명 응답
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-1.5 flex-wrap">
                                        {!hasResponded && survey.is_active && (
                                            <Button
                                                size="sm"
                                                onClick={() => setTakingSurveyId(survey.id)}
                                                className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                                            >
                                                <PenSquare size={11} className="mr-1" /> 참여하기
                                            </Button>
                                        )}
                                        {(hasResponded || isOwner || isAdmin) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setViewingResultsId(survey.id)}
                                                className="h-7 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                            >
                                                <BarChart2 size={11} className="mr-1" /> 결과 보기
                                            </Button>
                                        )}
                                        {(isOwner || isAdmin) && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleToggleActive(survey.id, survey.is_active)}
                                                    className="h-7 text-xs"
                                                >
                                                    {survey.is_active ? '설문 종료' : '설문 재개'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDelete(survey.id)}
                                                    className="h-7 text-xs text-red-400 border-red-200 hover:bg-red-50"
                                                >
                                                    <Trash2 size={11} className="mr-1" /> 삭제
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modals */}
            <SurveyCreateModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                userId={userId}
                onCreated={handleCreated}
            />

            {takingSurveyId && (
                <SurveyTakeModal
                    surveyId={takingSurveyId}
                    userId={userId}
                    onClose={() => setTakingSurveyId(null)}
                    onSubmitted={(showResults) => {
                        const id = takingSurveyId;
                        setTakingSurveyId(null);
                        setMyResponseIds(prev => new Set([...prev, id]));
                        setResponseCounts(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
                        boardChannelRef.current?.send({ type: "broadcast", event: "surveys_updated", payload: {} });
                        if (showResults) setViewingResultsId(id);
                    }}
                />
            )}

            {viewingResultsId && (
                <SurveyResultsModal
                    surveyId={viewingResultsId}
                    onClose={() => setViewingResultsId(null)}
                />
            )}
        </div>
    );
}
