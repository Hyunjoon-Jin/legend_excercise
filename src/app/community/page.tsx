"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BottomNav } from "@/components/layout/bottom-nav";
import { supabase } from "@/lib/supabase";
import {
    getChatMessages,
    sendChatMessage,
    getPosts,
    getPost,
    createPost,
    deletePost,
    createComment,
    deleteComment,
    toggleLike,
    getMyLike,
    uploadPostMedia,
    getReactionsForTargets,
    toggleReaction,
    getAnnouncements,
    getCertificationFeed,
    getWorkoutLogComments,
    createWorkoutLogComment,
    deleteWorkoutLogComment,
} from "@/lib/data";
import { getWorkoutLabel } from "@/lib/workout-types";
import { SurveyTab } from "@/components/features/survey/survey-tab";
import type { ChatMessage, Post, PostComment, ReactionGroup, Announcement, WorkoutLog, WorkoutLogComment } from "@/types/database";
import { ReactionBar } from "@/components/features/reaction-bar";
import { cn } from "@/lib/utils";
import {
    Send,
    Heart,
    MessageSquare,
    Trash2,
    PenSquare,
    ChevronLeft,
    Loader2,
    Users,
    ImagePlus,
    X,
    Images,
    Bell,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function isSameDay(a: string, b: string) {
    return new Date(a).toDateString() === new Date(b).toDateString();
}

function getDisplayName(profiles?: { display_name?: string; username?: string } | null) {
    return profiles?.display_name || profiles?.username || "알 수 없음";
}

function isVideoUrl(url: string) {
    return /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url);
}

function getWorkoutBadge(type: WorkoutLog['workout_type']): string {
    return getWorkoutLabel(type);
}

// ─── Reaction helpers ────────────────────────────────────────────────────────
type RawReaction = { target_id: string; user_id: string; emoji: string };

function buildReactionsMap(raw: RawReaction[], userId: string): Record<string, ReactionGroup[]> {
    const tmp: Record<string, Record<string, { count: number; hasMe: boolean }>> = {};
    (raw || []).forEach((r) => {
        if (!tmp[r.target_id]) tmp[r.target_id] = {};
        if (!tmp[r.target_id][r.emoji]) tmp[r.target_id][r.emoji] = { count: 0, hasMe: false };
        tmp[r.target_id][r.emoji].count++;
        if (r.user_id === userId) tmp[r.target_id][r.emoji].hasMe = true;
    });
    return Object.fromEntries(
        Object.entries(tmp).map(([id, em]) => [
            id,
            Object.entries(em).map(([emoji, v]) => ({ emoji, ...v })),
        ])
    );
}

function optimisticToggle(
    prev: Record<string, ReactionGroup[]>,
    targetId: string,
    emoji: string
): Record<string, ReactionGroup[]> {
    const current = prev[targetId] || [];
    const found = current.find((g) => g.emoji === emoji);
    let next: ReactionGroup[];
    if (found) {
        if (found.hasMe) {
            next = found.count === 1
                ? current.filter((g) => g.emoji !== emoji)
                : current.map((g) => g.emoji === emoji ? { ...g, count: g.count - 1, hasMe: false } : g);
        } else {
            next = current.map((g) => g.emoji === emoji ? { ...g, count: g.count + 1, hasMe: true } : g);
        }
    } else {
        next = [...current, { emoji, count: 1, hasMe: true }];
    }
    return { ...prev, [targetId]: next };
}

// ─── Media Gallery ────────────────────────────────────────────────────────────
function MediaGallery({ urls }: { urls: string[] }) {
    if (!urls || urls.length === 0) return null;
    return (
        <div className={cn("mt-3 grid gap-1.5", urls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {urls.map((url, i) =>
                isVideoUrl(url) ? (
                    <video
                        key={i}
                        src={url}
                        controls
                        className={cn(
                            "w-full rounded-xl bg-black",
                            urls.length === 1 ? "max-h-80" : "aspect-square object-cover"
                        )}
                    />
                ) : (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                            src={url}
                            alt=""
                            className={cn(
                                "w-full rounded-xl object-cover",
                                urls.length === 1 ? "max-h-80" : "aspect-square"
                            )}
                        />
                    </a>
                )
            )}
        </div>
    );
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────
function ChatTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionGroup[]>>({});
    const bottomRef = useRef<HTMLDivElement>(null);
    const chatChannelRef = useRef<any>(null);

    // Initial load + reactions
    useEffect(() => {
        getChatMessages().then(async ({ data }) => {
            if (!data) return;
            setMessages(data);
            const ids = data.map((m) => m.id);
            const { data: raw } = await getReactionsForTargets("chat", ids);
            if (raw) setReactionsMap(buildReactionsMap(raw, userId));
        });
    }, [userId]);

    // Broadcast 구독: 다른 사용자의 메시지·반응 즉시 수신
    // (postgres_changes 대신 broadcast 사용 — Supabase Auth 없이도 동작)
    useEffect(() => {
        const channel = supabase
            .channel("chat_live")
            .on("broadcast", { event: "new_message" }, ({ payload }: { payload: any }) => {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === payload.id)) return prev;
                    return [...prev, payload as ChatMessage];
                });
            })
            .on("broadcast", { event: "reaction_change" }, ({ payload }: { payload: any }) => {
                if (payload.user_id === userId) return;
                const { target_id, emoji, action } = payload;
                setReactionsMap((prev) => {
                    const current = prev[target_id] || [];
                    const found = current.find((g) => g.emoji === emoji);
                    if (action === "add") {
                        const next = found
                            ? current.map((g) => g.emoji === emoji ? { ...g, count: g.count + 1 } : g)
                            : [...current, { emoji, count: 1, hasMe: false }];
                        return { ...prev, [target_id]: next };
                    } else {
                        if (!found) return prev;
                        const next = found.count <= 1
                            ? current.filter((g) => g.emoji !== emoji)
                            : current.map((g) => g.emoji === emoji ? { ...g, count: g.count - 1 } : g);
                        return { ...prev, [target_id]: next };
                    }
                });
            })
            .subscribe();
        chatChannelRef.current = channel;
        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        setInput("");
        const { data } = await sendChatMessage(userId, text);
        if (data) {
            setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, data as ChatMessage];
            });
            // 다른 사용자들에게 새 메시지 브로드캐스트
            chatChannelRef.current?.send({ type: "broadcast", event: "new_message", payload: data });
        }
        setSending(false);
    };

    const handleChatReaction = async (msgId: string, emoji: string) => {
        const current = reactionsMap[msgId] || [];
        const found = current.find((g) => g.emoji === emoji);
        const action = found?.hasMe ? "remove" : "add";
        setReactionsMap((prev) => optimisticToggle(prev, msgId, emoji));
        await toggleReaction("chat", msgId, userId, emoji);
        chatChannelRef.current?.send({
            type: "broadcast", event: "reaction_change",
            payload: { target_id: msgId, emoji, user_id: userId, action },
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                <Users size={16} className="text-slate-400" />
                <span className="text-sm text-slate-500 font-medium">단체 채팅방</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-4">
                {messages.length === 0 && (
                    <p className="text-center text-slate-400 text-sm mt-8">
                        첫 메시지를 보내보세요!
                    </p>
                )}
                {messages.map((msg, idx) => {
                    const isMe = msg.user_id === userId;
                    const showDate =
                        idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at);
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showSender = !isMe && (prevMsg?.user_id !== msg.user_id || showDate);
                    const msgReactions = reactionsMap[msg.id] || [];

                    return (
                        <div key={msg.id}>
                            {showDate && (
                                <div className="flex items-center justify-center my-3">
                                    <span className="text-[11px] text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                        {formatDate(msg.created_at)}
                                    </span>
                                </div>
                            )}
                            <div
                                className={cn(
                                    "flex items-end gap-2",
                                    isMe ? "flex-row-reverse" : "flex-row"
                                )}
                            >
                                {!isMe && showSender && (
                                    <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
                                        {getDisplayName(msg.profiles).charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {!isMe && !showSender && <div className="w-7 shrink-0" />}

                                <div className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                                    {showSender && !isMe && (
                                        <span className="text-[11px] text-slate-500 font-medium ml-1">
                                            {getDisplayName(msg.profiles)}
                                        </span>
                                    )}
                                    <div className="flex items-end gap-1.5">
                                        {isMe && (
                                            <span className="text-[10px] text-slate-400 mb-0.5">
                                                {formatTime(msg.created_at)}
                                            </span>
                                        )}
                                        <div
                                            className={cn(
                                                "px-3 py-2 rounded-2xl max-w-[220px] text-sm leading-snug break-words",
                                                isMe
                                                    ? "bg-amber-400 text-white rounded-br-sm"
                                                    : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-sm"
                                            )}
                                        >
                                            {msg.content}
                                        </div>
                                        {!isMe && (
                                            <span className="text-[10px] text-slate-400 mb-0.5">
                                                {formatTime(msg.created_at)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Reaction bar */}
                                    {(msgReactions.length > 0 || !isMe) && (
                                        <ReactionBar
                                            groups={msgReactions}
                                            onToggle={(emoji) => handleChatReaction(msg.id, emoji)}
                                            canAdd={!isMe}
                                            align={isMe ? "right" : "left"}
                                            className={cn("mt-0.5", isMe ? "mr-0.5" : "ml-0.5")}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-2 border-t border-slate-100 bg-white flex gap-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 text-sm"
                />
                <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="bg-amber-400 hover:bg-amber-500 text-white px-3"
                >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
            </div>
        </div>
    );
}

// ─── Post Detail Drawer ───────────────────────────────────────────────────────
function PostDetail({
    post,
    userId,
    isAdmin,
    onClose,
    onDeleted,
}: {
    post: Post;
    userId: string;
    isAdmin: boolean;
    onClose: () => void;
    onDeleted: () => void;
}) {
    const [comments, setComments] = useState<PostComment[]>([]);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.like_count);
    const [commentInput, setCommentInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionGroup[]>>({});

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [{ comments: c }, { data: myLike }] = await Promise.all([
                getPost(post.id),
                getMyLike(post.id, userId),
            ]);
            setComments(c || []);
            setLiked(!!myLike);

            // Load reactions for post + all comments
            const commentIds = (c || []).map((cmt) => cmt.id);
            const [{ data: postRaw }, { data: cmtRaw }] = await Promise.all([
                getReactionsForTargets("post", [post.id]),
                commentIds.length > 0
                    ? getReactionsForTargets("comment", commentIds)
                    : Promise.resolve({ data: [] as { target_id: string; user_id: string; emoji: string }[] }),
            ]);
            const combined = [...(postRaw || []), ...(cmtRaw || [])];
            setReactionsMap(buildReactionsMap(combined, userId));

            setLoading(false);
        };
        load();
    }, [post.id, userId]);

    const handleLike = async () => {
        const { liked: newLiked } = await toggleLike(post.id, userId);
        setLiked(newLiked);
        setLikeCount((prev) => (newLiked ? prev + 1 : prev - 1));
    };

    const handleComment = async () => {
        const text = commentInput.trim();
        if (!text || submitting) return;
        setSubmitting(true);
        const { data } = await createComment(post.id, userId, text);
        if (data) setComments((prev) => [...prev, data]);
        setCommentInput("");
        setSubmitting(false);
    };

    const handleDeleteComment = async (commentId: string, commentUserId: string) => {
        if (commentUserId !== userId && !isAdmin) return;
        await deleteComment(commentId, commentUserId === userId ? userId : commentUserId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
    };

    const handleDeletePost = async () => {
        if (!window.confirm("게시글을 삭제하시겠습니까?")) return;
        await deletePost(post.id, post.user_id);
        onDeleted();
    };

    const handlePostReaction = (emoji: string) => {
        setReactionsMap((prev) => optimisticToggle(prev, post.id, emoji));
        toggleReaction("post", post.id, userId, emoji);
    };

    const handleCommentReaction = (commentId: string, emoji: string) => {
        setReactionsMap((prev) => optimisticToggle(prev, commentId, emoji));
        toggleReaction("comment", commentId, userId, emoji);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                    <ChevronLeft size={20} />
                </button>
                <span className="font-bold text-slate-800 text-sm flex-1 mx-3 truncate">{post.title}</span>
                {(post.user_id === userId || isAdmin) && (
                    <button onClick={handleDeletePost} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4 border-b border-slate-50">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700">
                            {getDisplayName(post.profiles).charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">{getDisplayName(post.profiles)}</p>
                            <p className="text-[11px] text-slate-400">{formatDate(post.created_at)}</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                    {/* Media Gallery */}
                    <MediaGallery urls={post.media_urls || []} />

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleLike}
                            className={cn(
                                "flex items-center gap-1.5 text-sm font-medium transition-colors",
                                liked ? "text-red-500" : "text-slate-400 hover:text-red-400"
                            )}
                        >
                            <Heart size={16} fill={liked ? "currentColor" : "none"} />
                            {likeCount}
                        </button>
                        <ReactionBar
                            groups={reactionsMap[post.id] || []}
                            onToggle={handlePostReaction}
                            canAdd={post.user_id !== userId}
                        />
                    </div>
                </div>

                {/* Comments */}
                <div className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        댓글 {comments.length}
                    </p>
                    {loading ? (
                        <Loader2 size={18} className="animate-spin text-slate-300 mx-auto" />
                    ) : comments.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">댓글이 없습니다.</p>
                    ) : (
                        <div className="space-y-3">
                            {comments.map((c) => (
                                <div key={c.id} className="flex gap-2">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                        {getDisplayName(c.profiles).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-xs font-semibold text-slate-700">
                                                {getDisplayName(c.profiles)}
                                            </span>
                                            {(c.user_id === userId || isAdmin) && (
                                                <button
                                                    onClick={() => handleDeleteComment(c.id, c.user_id)}
                                                    className="text-slate-300 hover:text-red-400"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">{c.content}</p>
                                        <ReactionBar
                                            groups={reactionsMap[c.id] || []}
                                            onToggle={(emoji) => handleCommentReaction(c.id, emoji)}
                                            canAdd={c.user_id !== userId}
                                            className="mt-1.5"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Comment Input */}
            <div className="px-4 py-2 border-t border-slate-100 bg-white flex gap-2">
                <Input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleComment();
                        }
                    }}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 text-sm"
                />
                <Button
                    size="sm"
                    onClick={handleComment}
                    disabled={!commentInput.trim() || submitting}
                    className="bg-amber-400 hover:bg-amber-500 text-white px-3"
                >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
            </div>
        </div>
    );
}

// ─── Notice Tab ───────────────────────────────────────────────────────────────
function NoticeTab() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        getAnnouncements().then(({ data }) => {
            if (data) setAnnouncements(data);
            setLoading(false);
        });
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                <Bell size={16} className="text-slate-400" />
                <span className="text-sm text-slate-500 font-medium">공지사항</span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 size={24} className="animate-spin text-slate-300" />
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                        <Bell size={32} className="text-slate-200" />
                        <p className="text-sm text-slate-400">등록된 공지가 없습니다.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {announcements.map((ann) => (
                            <button
                                key={ann.id}
                                onClick={() => setExpanded(expanded === ann.id ? null : ann.id)}
                                className="w-full text-left px-4 py-4 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                        <Bell size={14} className="text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                                공지
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(ann.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-slate-800 text-sm truncate">{ann.title}</p>
                                        {expanded === ann.id ? (
                                            <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">
                                                {ann.content}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{ann.content}</p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Cert Feed Tab ────────────────────────────────────────────────────────────

function CertFeedItem({ log, userId, isAdmin, reactionsMap, onReactionToggle }: {
    log: WorkoutLog; userId: string; isAdmin: boolean;
    reactionsMap: Record<string, ReactionGroup[]>;
    onReactionToggle: (logId: string, emoji: string, authorId: string) => void;
}) {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<WorkoutLogComment[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [commentInput, setCommentInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingComments, setLoadingComments] = useState(false);

    const handleToggleComments = async () => {
        if (!showComments && comments.length === 0) {
            setLoadingComments(true);
            const { data: cData } = await getWorkoutLogComments(log.id);
            if (cData) {
                setComments(cData);
                setCommentCount(cData.length);
            }
            setLoadingComments(false);
        }
        setShowComments(!showComments);
    };

    const handleComment = async () => {
        const text = commentInput.trim();
        if (!text || submitting) return;
        setSubmitting(true);
        const { data } = await createWorkoutLogComment(log.id, userId, text, log.user_id);
        if (data) {
            setComments(prev => [...prev, data]);
            setCommentCount(prev => prev + 1);
        }
        setCommentInput("");
        setSubmitting(false);
    };

    const handleDeleteComment = async (commentId: string, commentUserId: string) => {
        if (commentUserId !== userId && !isAdmin) return;
        await deleteWorkoutLogComment(commentId, commentUserId === userId ? userId : commentUserId);
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentCount(prev => Math.max(0, prev - 1));
    };

    const handleLogReaction = (emoji: string) => {
        onReactionToggle(log.id, emoji, log.user_id);
    };

    const displayName = getDisplayName(log.profiles);
    const initial = displayName.charAt(0).toUpperCase();
    const mediaUrls: string[] = (log.proof_media_urls && log.proof_media_urls.length > 0)
        ? log.proof_media_urls
        : (log.proof_image_url && log.proof_image_url !== 'admin-registered')
            ? [log.proof_image_url]
            : [];
    const hasRealImage = mediaUrls.length > 0;
    const msgReactions = reactionsMap[log.id] || [];

    return (
        <div className="px-4 py-4">
            {/* User row */}
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0 overflow-hidden">
                    {log.profiles?.avatar_url ? (
                        <img
                            src={log.profiles.avatar_url}
                            alt={displayName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        initial
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                            {displayName}
                        </span>
                        {log.profiles?.tier && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full font-bold shrink-0">
                                {log.profiles.tier}
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        {log.workout_date} · {log.duration_minutes}분
                    </p>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full shrink-0">
                    {getWorkoutBadge(log.workout_type)}
                </span>
            </div>

            {/* Proof media */}
            {hasRealImage && (
                <div className={cn(
                    "mb-3",
                    mediaUrls.length === 1 ? "" : "grid grid-cols-2 gap-1"
                )}>
                    {mediaUrls.map((url, mi) => (
                        isVideoUrl(url) ? (
                            <video
                                key={mi}
                                src={url}
                                controls
                                className={cn(
                                    "rounded-xl bg-slate-100 w-full",
                                    mediaUrls.length === 1 ? "max-h-72" : "aspect-square object-cover"
                                )}
                            />
                        ) : (
                            <a key={mi} href={url} target="_blank" rel="noopener noreferrer"
                                className={cn(
                                    "block rounded-xl overflow-hidden bg-slate-100",
                                    mediaUrls.length > 1 && "aspect-square"
                                )}
                            >
                                <img
                                    src={url}
                                    alt={`인증 사진 ${mi + 1}`}
                                    className={cn(
                                        "w-full object-cover",
                                        mediaUrls.length === 1 ? "max-h-72" : "h-full"
                                    )}
                                />
                            </a>
                        )
                    ))}
                </div>
            )}

            {/* Comment Body */}
            {log.comment && (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                    {log.comment}
                </p>
            )}

            {/* Actions: Reaction Bar + Comment Button */}
            <div className="flex items-center gap-3">
                <ReactionBar
                    groups={msgReactions}
                    onToggle={handleLogReaction}
                    canAdd={log.user_id !== userId}
                />
                <button
                    onClick={handleToggleComments}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                >
                    <MessageSquare size={14} />
                    댓글 {commentCount > 0 ? commentCount : ''}
                </button>
            </div>

            {/* Inline Comments Section */}
            {showComments && (
                <div className="mt-3 bg-slate-50 rounded-xl p-3 space-y-3">
                    {loadingComments ? (
                        <div className="flex justify-center p-2"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
                    ) : comments.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">가장 먼저 댓글을 남겨보세요!</p>
                    ) : (
                        <div className="space-y-2.5">
                            {comments.map(c => (
                                <div key={c.id} className="flex gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                        {getDisplayName(c.profiles).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 bg-white rounded-lg px-2.5 py-1.5 shadow-sm border border-slate-100">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[11px] font-semibold text-slate-700">
                                                {getDisplayName(c.profiles)}
                                            </span>
                                            {(c.user_id === userId || isAdmin) && (
                                                <button
                                                    onClick={() => handleDeleteComment(c.id, c.user_id)}
                                                    className="text-slate-300 hover:text-red-400"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">{c.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Comment Input */}
                    <div className="flex gap-2">
                        <Input
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleComment();
                                }
                            }}
                            placeholder="댓글 달기..."
                            className="h-8 text-xs bg-white flex-1"
                        />
                        <Button
                            size="sm"
                            onClick={handleComment}
                            disabled={!commentInput.trim() || submitting}
                            className="bg-amber-400 hover:bg-amber-500 text-white h-8 px-2.5"
                        >
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function CertFeedTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [onlyMine, setOnlyMine] = useState(false);
    const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionGroup[]>>({});
    const certChannelRef = useRef<any>(null);

    useEffect(() => {
        getCertificationFeed(40).then(({ data }) => {
            if (data) {
                setLogs(data);
                const logIds = data.map((l) => l.id);
                if (logIds.length > 0) {
                    getReactionsForTargets('workout_log', logIds).then(({ data: raw }) => {
                        if (raw) setReactionsMap(buildReactionsMap(raw, userId));
                    });
                }
            }
            setLoading(false);
        });
    }, [userId]);

    // Broadcast 구독: 다른 사용자의 반응·새 인증 즉시 수신
    useEffect(() => {
        const channel = supabase
            .channel("cert_live")
            .on("broadcast", { event: "reaction_change" }, ({ payload }: { payload: any }) => {
                if (payload.user_id === userId) return;
                const { target_id, emoji, action } = payload;
                setReactionsMap((prev) => {
                    const current = prev[target_id] || [];
                    const found = current.find((g) => g.emoji === emoji);
                    if (action === "add") {
                        const next = found
                            ? current.map((g) => g.emoji === emoji ? { ...g, count: g.count + 1 } : g)
                            : [...current, { emoji, count: 1, hasMe: false }];
                        return { ...prev, [target_id]: next };
                    } else {
                        if (!found) return prev;
                        const next = found.count <= 1
                            ? current.filter((g) => g.emoji !== emoji)
                            : current.map((g) => g.emoji === emoji ? { ...g, count: g.count - 1 } : g);
                        return { ...prev, [target_id]: next };
                    }
                });
            })
            .on("broadcast", { event: "feed_updated" }, () => {
                getCertificationFeed(40).then(({ data }) => {
                    if (data) setLogs(data);
                });
            })
            .subscribe();
        certChannelRef.current = channel;
        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const handleReactionToggle = async (logId: string, emoji: string, authorId: string) => {
        const current = reactionsMap[logId] || [];
        const found = current.find((g) => g.emoji === emoji);
        const action = found?.hasMe ? "remove" : "add";
        setReactionsMap((prev) => optimisticToggle(prev, logId, emoji));
        await toggleReaction("workout_log", logId, userId, emoji, authorId);
        certChannelRef.current?.send({
            type: "broadcast", event: "reaction_change",
            payload: { target_id: logId, emoji, user_id: userId, action },
        });
    };

    const displayed = onlyMine ? logs.filter(l => l.user_id === userId) : logs;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                <span className="text-base">💪</span>
                <span className="text-sm text-slate-500 font-medium">운동 인증 피드</span>
                <div className="ml-auto flex items-center gap-2">
                    {!loading && (
                        <span className="text-[11px] text-slate-400">{displayed.length}건</span>
                    )}
                    <button
                        onClick={() => setOnlyMine(v => !v)}
                        className={cn(
                            "text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all",
                            onlyMine
                                ? "bg-amber-400 border-amber-400 text-white"
                                : "bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-500"
                        )}
                    >
                        내 인증만
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 size={24} className="animate-spin text-slate-300" />
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                        <span className="text-4xl">💪</span>
                        <p className="text-sm text-slate-400">
                            {onlyMine ? "아직 내 인증이 없습니다." : "아직 승인된 인증이 없습니다."}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {displayed.map((log) => (
                            <CertFeedItem
                                key={log.id}
                                log={log}
                                userId={userId}
                                isAdmin={isAdmin}
                                reactionsMap={reactionsMap}
                                onReactionToggle={handleReactionToggle}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Board Tab ────────────────────────────────────────────────────────────────
function BoardTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
    const [boardSubTab, setBoardSubTab] = useState<'posts' | 'surveys'>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showWrite, setShowWrite] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const boardChannelRef = useRef<any>(null);

    // Media attachment state
    const [mediaFiles, setMediaFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadPosts = async () => {
        setLoading(true);
        const { data } = await getPosts();
        if (data) setPosts(data);
        setLoading(false);
    };

    useEffect(() => {
        loadPosts();
    }, []);

    // Broadcast 구독: 다른 사용자의 게시글 생성·삭제 즉시 수신
    useEffect(() => {
        const channel = supabase
            .channel("board_live")
            .on("broadcast", { event: "posts_updated" }, () => {
                loadPosts();
            })
            .subscribe();
        boardChannelRef.current = channel;
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        const remaining = 10 - mediaFiles.length;
        const toAdd = selected.slice(0, remaining);
        setMediaFiles((prev) => [...prev, ...toAdd]);
        setPreviewUrls((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeMedia = (idx: number) => {
        URL.revokeObjectURL(previewUrls[idx]);
        setMediaFiles((prev) => prev.filter((_, i) => i !== idx));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
    };

    const resetForm = () => {
        setTitle("");
        setContent("");
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        setMediaFiles([]);
        setPreviewUrls([]);
    };

    const handleCreate = async () => {
        if (!title.trim() || !content.trim() || submitting) return;
        setSubmitting(true);

        // Upload media files
        let uploadedUrls: string[] = [];
        if (mediaFiles.length > 0) {
            setUploading(true);
            const results = await Promise.all(mediaFiles.map((f) => uploadPostMedia(f, userId)));
            uploadedUrls = results.filter((r) => r.data).map((r) => r.data as string);
            setUploading(false);
        }

        const { data } = await createPost(userId, title.trim(), content.trim(), uploadedUrls);
        if (data) {
            setShowWrite(false);
            resetForm();
            await loadPosts();
            // 다른 사용자들에게 새 게시글 브로드캐스트
            boardChannelRef.current?.send({ type: "broadcast", event: "posts_updated", payload: {} });
        }
        setSubmitting(false);
    };

    if (selectedPost) {
        return (
            <PostDetail
                post={selectedPost}
                userId={userId}
                isAdmin={isAdmin}
                onClose={() => setSelectedPost(null)}
                onDeleted={() => {
                    setSelectedPost(null);
                    loadPosts();
                    boardChannelRef.current?.send({ type: "broadcast", event: "posts_updated", payload: {} });
                }}
            />
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Sub-tab switcher */}
            <div className="flex border-b border-slate-100 bg-white">
                <button
                    onClick={() => setBoardSubTab('posts')}
                    className={cn(
                        "flex-1 py-2.5 text-xs font-bold transition-colors",
                        boardSubTab === 'posts'
                            ? "text-amber-500 border-b-2 border-amber-400"
                            : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    게시글
                </button>
                <button
                    onClick={() => setBoardSubTab('surveys')}
                    className={cn(
                        "flex-1 py-2.5 text-xs font-bold transition-colors",
                        boardSubTab === 'surveys'
                            ? "text-indigo-500 border-b-2 border-indigo-400"
                            : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    설문
                </button>
            </div>

            {/* Survey sub-tab */}
            {boardSubTab === 'surveys' && (
                <SurveyTab userId={userId} isAdmin={isAdmin} boardChannelRef={boardChannelRef} />
            )}

            {/* Posts sub-tab */}
            {boardSubTab === 'posts' && <>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                <span className="text-sm text-slate-500 font-medium">게시글 {posts.length}</span>
                <Button
                    size="sm"
                    onClick={() => setShowWrite(true)}
                    className="bg-amber-400 hover:bg-amber-500 text-white text-xs h-8 gap-1.5"
                >
                    <PenSquare size={13} />
                    글쓰기
                </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 size={24} className="animate-spin text-slate-300" />
                    </div>
                ) : posts.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm mt-12">
                        첫 게시글을 작성해보세요!
                    </p>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {posts.map((post) => (
                            <button
                                key={post.id}
                                onClick={() => setSelectedPost(post)}
                                className="w-full text-left px-4 py-4 hover:bg-slate-50 transition-colors"
                            >
                                <p className="font-semibold text-slate-800 text-sm mb-1 truncate">
                                    {post.title}
                                </p>
                                <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                                    {post.content}
                                </p>
                                {/* First image thumbnail */}
                                {post.media_urls && post.media_urls.length > 0 && !isVideoUrl(post.media_urls[0]) && (
                                    <div className="mb-2 rounded-lg overflow-hidden h-32 bg-slate-100">
                                        <img
                                            src={post.media_urls[0]}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="font-medium text-slate-500">
                                        {getDisplayName(post.profiles)}
                                    </span>
                                    <span>{formatDate(post.created_at)}</span>
                                    {post.media_urls && post.media_urls.length > 0 && (
                                        <span className="flex items-center gap-0.5 text-amber-400">
                                            <Images size={11} />
                                            {post.media_urls.length}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-0.5 ml-auto">
                                        <Heart size={11} />
                                        {post.like_count}
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                        <MessageSquare size={11} />
                                        {post.comment_count ?? 0}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Write Dialog */}
            <Dialog
                open={showWrite}
                onOpenChange={(open) => {
                    setShowWrite(open);
                    if (!open) resetForm();
                }}
            >
                <DialogContent className="max-w-[440px] mx-auto max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>글쓰기</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <Input
                            placeholder="제목"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-sm"
                        />
                        <textarea
                            placeholder="내용을 입력하세요..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />

                        {/* Media Previews */}
                        {previewUrls.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {previewUrls.map((url, i) => (
                                    <div key={i} className="relative aspect-square">
                                        {mediaFiles[i]?.type.startsWith("video/") ? (
                                            <video
                                                src={url}
                                                className="w-full h-full object-cover rounded-lg bg-black"
                                            />
                                        ) : (
                                            <img
                                                src={url}
                                                alt=""
                                                className="w-full h-full object-cover rounded-lg"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeMedia(i)}
                                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                {previewUrls.length < 10 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-300 hover:border-amber-300 hover:text-amber-400 transition-colors"
                                    >
                                        <ImagePlus size={20} />
                                        <span className="text-[10px] mt-1">추가</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Add Media Button (empty state) */}
                        {previewUrls.length === 0 && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-amber-300 hover:text-amber-400 transition-colors text-sm"
                            >
                                <ImagePlus size={16} />
                                사진/영상 첨부 (최대 10개)
                            </button>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowWrite(false);
                                    resetForm();
                                }}
                            >
                                취소
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleCreate}
                                disabled={!title.trim() || !content.trim() || submitting}
                                className="bg-amber-400 hover:bg-amber-500 text-white"
                            >
                                {(submitting || uploading) ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin mr-1" />
                                        {uploading ? "업로드 중..." : "등록 중..."}
                                    </>
                                ) : "등록"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            </>}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommunityPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [tab, setTab] = useState<"chat" | "board" | "notice" | "cert">("chat");

    // URL ?tab= 파라미터로 초기 탭 설정
    useEffect(() => {
        if (typeof window === "undefined") return;
        const t = new URLSearchParams(window.location.search).get("tab");
        if (t === "chat" || t === "board" || t === "notice" || t === "cert") setTab(t);
    }, []);

    useEffect(() => {
        if (!isAuthenticated) router.push("/login");
    }, [isAuthenticated, router]);

    if (!isAuthenticated || !user) return null;

    const isAdmin = user.role === "admin";

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col max-w-[480px] mx-auto">
            {/* Page Header */}
            <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-0">
                <h1 className="text-xl font-black text-slate-900 mb-3">커뮤니티</h1>
                {/* Tab Bar */}
                <div className="flex">
                    {(["chat", "board", "notice", "cert"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                "flex-1 py-2.5 text-sm font-bold tracking-wide transition-colors border-b-2",
                                tab === t
                                    ? "border-amber-400 text-amber-500"
                                    : "border-transparent text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {t === "chat" ? "채팅" : t === "board" ? "게시판" : t === "notice" ? "공지" : "인증"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-hidden flex flex-col" style={{ marginBottom: "80px" }}>
                {tab === "chat" ? (
                    <ChatTab userId={user.id} isAdmin={isAdmin} />
                ) : tab === "board" ? (
                    <BoardTab userId={user.id} isAdmin={isAdmin} />
                ) : tab === "notice" ? (
                    <NoticeTab />
                ) : (
                    <CertFeedTab userId={user.id} isAdmin={user.role === 'admin'} />
                )}
            </div>

            <BottomNav />
        </div>
    );
}
