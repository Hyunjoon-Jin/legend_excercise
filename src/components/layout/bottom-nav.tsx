"use client";

import { useRouter, usePathname } from "next/navigation";
import { PlusCircle, Calendar, Trophy, User as UserIcon, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/use-auth-store";

interface BottomNavProps {
    onPlusClick?: () => void;
}

export function BottomNav({ onPlusClick }: BottomNavProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useAuthStore();

    const tabs = [
        { id: "cert", label: "인증", icon: PlusCircle, path: "/", isPlus: true, adminOnly: true },
        { id: "calendar", label: "캘린더", icon: Calendar, path: "/calendar" },
        { id: "rankings", label: "랭킹", icon: Trophy, path: "/rankings" },
        { id: "community", label: "커뮤니티", icon: MessageCircle, path: "/community" },
        { id: "profile", label: "내정보", icon: UserIcon, path: "/profile" },
    ].filter(tab => !tab.adminOnly || user?.role === 'admin');

    return (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-20 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-40 pb-2">
            {tabs.map((tab) => {
                const isActive = pathname === tab.path;
                const Icon = tab.icon;

                return (
                    <button
                        key={tab.id}
                        onClick={() => {
                            if (tab.isPlus && onPlusClick) {
                                onPlusClick();
                                if (pathname !== "/") router.push("/");
                            } else {
                                router.push(tab.path);
                            }
                        }}
                        className={cn(
                            "flex flex-col items-center gap-1.5 transition-all group",
                            isActive || (tab.isPlus && pathname === "/") ? "text-primary" : "text-slate-400"
                        )}
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center group-active:scale-90 transition-all",
                            (isActive || (tab.isPlus && pathname === "/")) && tab.isPlus ? "bg-accent/10 text-accent" :
                                isActive ? "bg-slate-50" : ""
                        )}>
                            <Icon size={20} className={cn(isActive && !tab.isPlus && "text-accent")} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider">
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
