"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SmilePlus } from "lucide-react";
import type { ReactionGroup } from "@/types/database";

export { type ReactionGroup };

export const REACTION_EMOJIS = ["❤️", "💪", "😂", "🔥", "👍", "🥹", "😮", "🎉"];

interface ReactionBarProps {
    groups: ReactionGroup[];
    onToggle: (emoji: string) => void;
    /** whether the + add button is shown (false = read-only display) */
    canAdd?: boolean;
    /** which side the picker pops out on */
    align?: "left" | "right";
    className?: string;
}

export function ReactionBar({
    groups,
    onToggle,
    canAdd = true,
    align = "left",
    className,
}: ReactionBarProps) {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showPicker) return;
        const close = (e: MouseEvent | TouchEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowPicker(false);
            }
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("touchstart", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("touchstart", close);
        };
    }, [showPicker]);

    const hasAny = groups.length > 0;
    if (!hasAny && !canAdd) return null;

    return (
        <div className={cn("flex flex-wrap items-center gap-1", className)}>
            {/* Reaction chips */}
            {groups.map((g) => (
                <button
                    key={g.emoji}
                    onClick={() => onToggle(g.emoji)}
                    className={cn(
                        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all active:scale-90 select-none",
                        g.hasMe
                            ? "bg-amber-50 border-amber-300 text-amber-700 font-bold shadow-sm"
                            : "bg-white/90 border-slate-200 text-slate-600 hover:border-amber-200 hover:bg-amber-50/40"
                    )}
                >
                    <span className="leading-none">{g.emoji}</span>
                    <span className="text-[11px] font-semibold tabular-nums">{g.count}</span>
                </button>
            ))}

            {/* + button */}
            {canAdd && (
                <div className="relative" ref={pickerRef}>
                    <button
                        onClick={() => setShowPicker((v) => !v)}
                        className={cn(
                            "flex items-center justify-center w-6 h-6 rounded-full border transition-all active:scale-90 select-none",
                            hasAny
                                ? "bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200"
                                : "bg-white/60 border-slate-100 text-slate-300 hover:text-amber-400 hover:border-amber-200 hover:bg-white",
                            showPicker && "bg-amber-50 border-amber-200 text-amber-500"
                        )}
                    >
                        <SmilePlus size={13} />
                    </button>

                    {showPicker && (
                        <div
                            className={cn(
                                "absolute bottom-full mb-2 z-[60]",
                                "bg-white rounded-2xl shadow-2xl border border-slate-100",
                                "px-2 py-2 flex items-center gap-0.5",
                                align === "right" ? "right-0" : "left-0"
                            )}
                        >
                            {REACTION_EMOJIS.map((emoji) => {
                                const existing = groups.find((g) => g.emoji === emoji);
                                return (
                                    <button
                                        key={emoji}
                                        onClick={() => {
                                            onToggle(emoji);
                                            setShowPicker(false);
                                        }}
                                        className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center text-[20px] transition-all active:scale-90 hover:bg-slate-50 select-none",
                                            existing?.hasMe && "bg-amber-50 ring-1 ring-amber-200"
                                        )}
                                    >
                                        {emoji}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
