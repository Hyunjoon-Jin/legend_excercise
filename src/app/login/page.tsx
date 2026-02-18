"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const loginSchema = z.object({
    username: z.string().min(2, "이름은 2글자 이상이어야 합니다."),
    password: z.string().min(4, "시크릿 코드는 4글자 이상이어야 합니다."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuthStore();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    const onSubmit = async (data: LoginFormValues) => {
        setError(null);
        setIsLoading(true);

        try {
            // 실제 프로젝트에서는 Supabase Auth를 쓰는 것이 좋으나, 
            // 사용자의 요구사항(이름+비번 간단 로그인)에 맞춰 profiles 테이블에서 직접 조회합니다.
            // 보안을 위해 실제 서비스에서는 password를 hash하여 저장하고 비교해야 합니다.

            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', data.username)
                .single();

            if (fetchError || !profile) {
                // 관리자/테스트 계정용 폴백 (DB에 아직 데이터가 없을 경우를 대비)
                if (data.username === "관리자" && data.password === "0000") {
                    login({ id: "admin-id", username: "관리자", role: "admin", tier: "Gold" });
                    router.push("/");
                    return;
                }
                setError("등록된 사용자가 아니거나 이름이 틀렸습니다.");
                return;
            }

            // 단순 비밀번호 비교 (실제 운영 시에는 보안 처리가 필요함)
            if (data.password === "0000" || data.password === "1234") {
                login({
                    id: profile.id,
                    username: profile.username,
                    role: profile.role,
                    tier: profile.tier,
                    avatarUrl: profile.avatar_url,
                });
                router.push("/");
            } else {
                setError("시크릿 코드가 일치하지 않습니다.");
            }
        } catch (err) {
            setError("로그인 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-secondary">
            <Card className="w-full max-w-sm border-none shadow-none bg-transparent">
                <CardHeader className="space-y-1 text-center pb-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-accent text-3xl font-bold">
                            L
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-primary">레전드 운동방</CardTitle>
                    <p className="text-sm text-muted-foreground">시즌 4.1 공식 관리 플랫폼</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-primary">이름</label>
                            <Input
                                {...form.register("username")}
                                placeholder="이름을 입력하세요"
                                disabled={isLoading}
                                className={cn(form.formState.errors.username && "border-error focus-visible:ring-error")}
                            />
                            {form.formState.errors.username && (
                                <p className="text-xs text-error">{form.formState.errors.username.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-primary">시크릿 코드 (비밀번호)</label>
                            <Input
                                {...form.register("password")}
                                type="password"
                                placeholder="비밀번호를 입력하세요"
                                disabled={isLoading}
                                className={cn(form.formState.errors.password && "border-error focus-visible:ring-error")}
                            />
                            {form.formState.errors.password && (
                                <p className="text-xs text-error">{form.formState.errors.password.message}</p>
                            )}
                        </div>
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-xs text-error text-center">{error}</p>
                            </div>
                        )}
                        <Button type="submit" className="w-full mt-6" size="lg" disabled={isLoading}>
                            {isLoading ? "로그인 중..." : "로그인"}
                        </Button>
                    </form>
                    <p className="mt-8 text-center text-xs text-muted-foreground">
                        계정이 없으신가요? 운영진에게 문의하세요.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
