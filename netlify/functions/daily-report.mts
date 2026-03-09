import type { Config } from "@netlify/functions";

// 매일 23:00 KST (= 14:00 UTC)에 실행
export const config: Config = {
    schedule: "0 14 * * *",
};

export default async (req: Request) => {
    const baseUrl = process.env.URL || "http://localhost:3000";
    const secret = process.env.CRON_SECRET || "";

    try {
        const response = await fetch(`${baseUrl}/api/cron/daily-report`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${secret}`,
            },
        });

        const data = await response.json();
        console.log("[daily-report] cron result:", data);

        return new Response(JSON.stringify({ ok: response.ok, data }), {
            status: response.ok ? 200 : 500,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("[daily-report] cron error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
