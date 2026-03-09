"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, autoLogin, logout } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    // Zustand가 localStorage에서 데이터를 읽은 뒤에 체크하기 위해 마운트 후에만 실행
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (pathname === "/login") return;

        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        // 자동로그인이 꺼져 있으면 세션이 살아있는지 확인
        if (!autoLogin) {
            const sessionActive = sessionStorage.getItem("legend-session-active");
            if (!sessionActive) {
                logout();
                router.push("/login");
            }
        }
    }, [mounted, isAuthenticated, autoLogin, pathname, router, logout]);

    return <>{children}</>;
}
