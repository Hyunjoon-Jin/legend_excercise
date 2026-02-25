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
} from "@/lib/data";
import type { ChatMessage, Post, PostComment } from "@/types/database";
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

// ─── Chat Tab ─────────────────────────────────────────────────────────────────
function ChatTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        getChatMessages().then(({ data }) => {
            if (data) setMessages(data);
        });
    }, []);

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel("chat_messages_realtime")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "chat_messages" },
                async (payload) => {
                    // Fetch with profile join
                    const { data } = await supabase
                        .from("chat_messages")
                        .select("*, profiles(id, username, display_name, avatar_url)")
                        .eq("id", payload.new.id)
                        .single();
                    if (data) {
                        setMessages((prev) => {
                            // Avoid duplicate if we already added it optimistically
                            if (prev.some((m) => m.id === data.id)) return prev;
                            return [...prev, data as ChatMessage];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        setInput("");
        await sendChatMessage(userId, text);
        setSending(false);
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
                                {/* Avatar placeholder */}
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

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [{ comments: c }, { data: myLike }] = await Promise.all([
                getPost(post.id),
                getMyLike(post.id, userId),
            ]);
            setComments(c || []);
            setLiked(!!myLike);
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
                    <button
                        onClick={handleLike}
                        className={cn(
                            "mt-4 flex items-center gap-1.5 text-sm font-medium transition-colors",
                            liked ? "text-red-500" : "text-slate-400 hover:text-red-400"
                        )}
                    >
                        <Heart size={16} fill={liked ? "currentColor" : "none"} />
                        {likeCount}
                    </button>
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

// ─── Board Tab ────────────────────────────────────────────────────────────────
function BoardTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [showWrite, setShowWrite] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadPosts = async () => {
        setLoading(true);
        const { data } = await getPosts();
        if (data) setPosts(data);
        setLoading(false);
    };

    useEffect(() => {
        loadPosts();
    }, []);

    const handleCreate = async () => {
        if (!title.trim() || !content.trim() || submitting) return;
        setSubmitting(true);
        const { data } = await createPost(userId, title.trim(), content.trim());
        if (data) {
            setShowWrite(false);
            setTitle("");
            setContent("");
            await loadPosts();
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
                }}
            />
        );
    }

    return (
        <div className="flex flex-col h-full">
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
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="font-medium text-slate-500">
                                        {getDisplayName(post.profiles)}
                                    </span>
                                    <span>{formatDate(post.created_at)}</span>
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
            <Dialog open={showWrite} onOpenChange={setShowWrite}>
                <DialogContent className="max-w-[440px] mx-auto">
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
                            rows={6}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowWrite(false)}
                            >
                                취소
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleCreate}
                                disabled={!title.trim() || !content.trim() || submitting}
                                className="bg-amber-400 hover:bg-amber-500 text-white"
                            >
                                {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                                등록
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommunityPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    const [tab, setTab] = useState<"chat" | "board">("chat");

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
                    {(["chat", "board"] as const).map((t) => (
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
                            {t === "chat" ? "채팅" : "게시판"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content area — takes remaining height above bottom nav */}
            <div className="flex-1 overflow-hidden flex flex-col" style={{ marginBottom: "80px" }}>
                {tab === "chat" ? (
                    <ChatTab userId={user.id} isAdmin={isAdmin} />
                ) : (
                    <BoardTab userId={user.id} isAdmin={isAdmin} />
                )}
            </div>

            <BottomNav />
        </div>
    );
}
