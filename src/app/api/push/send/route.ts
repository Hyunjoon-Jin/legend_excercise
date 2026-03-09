import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // We use anon key but we changed RLS so anyone can read subscriptions.
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialization moved inside POST handler to prevent build-time errors

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { targetUserId, title, content, link } = body;

        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.warn('VAPID keys not configured. Push notification aborted.');
            return NextResponse.json({ error: 'Web Push not configured' }, { status: 500 });
        }

        webpush.setVapidDetails(
            'mailto:test@example.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        let query = supabase.from('user_subscriptions').select('*');

        // If targetUserId is provided, send to that user only.
        // Otherwise, broadcast to everyone.
        if (targetUserId) {
            query = query.eq('user_id', targetUserId);
        }

        const { data: subscriptions, error } = await query;

        if (error) {
            console.error('Error fetching subscriptions:', error);
            return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
        }

        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({ success: true, message: 'No active subscriptions found.' });
        }

        const notificationPayload = JSON.stringify({
            title,
            body: content,
            url: link || '/'
        });

        const sendPromises = subscriptions.map((sub: any) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                }
            };

            return webpush.sendNotification(pushSubscription, notificationPayload)
                .catch((err) => {
                    console.error('Error sending push to endpoint:', sub.endpoint, err);
                    // If subscription is gone (e.g. 410 Gone), we could delete it from DB here.
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        return supabase.from('user_subscriptions').delete().eq('id', sub.id);
                    }
                });
        });

        await Promise.all(sendPromises);

        return NextResponse.json({ success: true, count: subscriptions.length });
    } catch (e: any) {
        console.error('Push Send Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
