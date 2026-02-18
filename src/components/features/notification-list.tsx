"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
    Bell,
    CheckCheck,
    Info,
    Trophy,
    Calendar as CalendarIcon,
    X
} from "lucide-react";
import {
    getNotifications,
    markNotificationAsRead
} from "@/lib/data";
import { Notification } from "@/types/database";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NotificationListProps {
    onClose: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
    const { user } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchNotifs = async () => {
            if (!user) return;
            const { data } = await getNotifications(user.id);
            if (data) setNotifications(data);
            setIsLoading(false);
        };
        fetchNotifs();
    }, [user]);

    const handleRead = async (id: string) => {
        await markNotificationAsRead(id);
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
    };

    const getIcon = (title: string) => {
        if (title.includes("우승") || title.includes("MVP")) return <Trophy className="text-amber-500" size={18} />;
        if (title.includes("인증") || title.includes("등록")) return <CheckCheck className="text-green-500" size={18} />;
        if (title.includes("캘린더") || title.includes("시즌")) return <CalendarIcon className="text-blue-500" size={18} />;
        return <Info className="text-slate-400" size={18} />;
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                    <Bell size={20} className="text-accent" />
                    알림 센터
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X size={20} />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center p-10">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : notifications.length > 0 ? (
                    <div className="divide-y divide-slate-50">
                        {notifications.map((n) => (
                            <div
                                key={n.id}
                                onClick={() => handleRead(n.id)}
                                className={cn(
                                    "p-4 flex gap-3 transition-colors active:bg-slate-50",
                                    !n.is_read ? "bg-amber-50/30" : "opacity-60"
                                )}
                            >
                                <div className="mt-1">{getIcon(n.title)}</div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-primary">{n.title}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {format(new Date(n.created_at), "M월 d일 HH:mm", { locale: ko })}
                                        </p>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">{n.content}</p>
                                </div>
                                {!n.is_read && <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2" />}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-20 text-center space-y-2">
                        <Bell size={40} className="text-slate-200" />
                        <p className="text-sm text-slate-400">새로운 알림이 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
