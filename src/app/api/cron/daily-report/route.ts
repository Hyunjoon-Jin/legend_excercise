import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Service role key bypasses RLS → 서버사이드에서 모든 테이블 접근 가능
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    // Bearer 토큰 검증
    const auth = req.headers.get("Authorization");
    const secret = process.env.CRON_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const debug: Record<string, any> = {};

    try {
        // KST 기준 오늘 날짜 (UTC+9)
        const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const dateStr = nowKST.toISOString().split("T")[0];
        debug.date = dateStr;

        // 활성 시즌
        const { data: season } = await supabase
            .from("seasons")
            .select("id, name")
            .eq("is_active", true)
            .single();
        debug.season = season?.name ?? null;

        if (!season) {
            return NextResponse.json({ ...debug, message: "활성 시즌 없음 - 알림 생략" });
        }

        // 관리자 목록
        const { data: admins } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "admin");
        debug.adminCount = admins?.length ?? 0;

        if (!admins || admins.length === 0) {
            return NextResponse.json({ ...debug, message: "관리자 없음 - 알림 생략" });
        }

        const reportLink = `/admin/report?date=${dateStr}`;
        const title = "📊 일일 리포트 준비됨";
        const content = `${dateStr} 운동 인증 리포트를 확인하고 공유하세요.`;

        // 인앱 알림 생성 (type 필드 포함)
        const notifications = admins.map((admin: { id: string }) => ({
            user_id: admin.id,
            type: "system" as const,
            title,
            content,
            link: reportLink,
            is_read: false,
        }));
        const { error: notifError } = await supabase.from("notifications").insert(notifications);
        debug.notifInserted = !notifError;
        if (notifError) debug.notifError = notifError.message;

        // 웹 푸시
        debug.push = { subsFound: 0, sent: 0, expired: 0, errors: [] as string[] };

        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            debug.push.skipped = "VAPID 키 없음";
        } else {
            webpush.setVapidDetails(
                "mailto:test@example.com",
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );

            const payload = JSON.stringify({ title, body: content, url: reportLink });

            for (const admin of admins) {
                const { data: subs, error: subErr } = await supabase
                    .from("user_subscriptions")
                    .select("*")
                    .eq("user_id", admin.id);

                if (subErr) { debug.push.errors.push(`sub fetch: ${subErr.message}`); continue; }
                if (!subs || subs.length === 0) continue;

                debug.push.subsFound += subs.length;

                await Promise.all(
                    subs.map(async (sub: any) => {
                        try {
                            await webpush.sendNotification(
                                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                                payload
                            );
                            debug.push.sent++;
                        } catch (err: any) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                debug.push.expired++;
                                await supabase.from("user_subscriptions").delete().eq("id", sub.id);
                            } else {
                                debug.push.errors.push(`${err.statusCode ?? "?"}: ${err.message}`);
                            }
                        }
                    })
                );
            }
        }

        return NextResponse.json({ ok: true, ...debug });
    } catch (err: any) {
        console.error("[cron/daily-report] error:", err);
        return NextResponse.json({ error: err.message, debug }, { status: 500 });
    }
}
