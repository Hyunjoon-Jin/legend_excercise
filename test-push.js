require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (!supabaseUrl || !supabaseKey || !vapidPublic || !vapidPrivate) {
    console.error("Missing env vars!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
webpush.setVapidDetails('mailto:test@example.com', vapidPublic, vapidPrivate);

async function testPush() {
    const { data, error } = await supabase.from('user_subscriptions').select('*');
    if (error) {
        console.error("DB Error:", error);
        return;
    }
    console.log(`Found ${data.length} subscriptions`);
    if (data.length === 0) return;

    const sub = data[0];
    const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
        }
    };

    console.log("Sending to:", pushSubscription);

    const payload = JSON.stringify({
        title: "Test Script Push",
        body: "This is a test notification from the CLI",
        icon: "/icon-192x192.png",
        url: "/"
    });

    try {
        await webpush.sendNotification(pushSubscription, payload);
        console.log("Push sent successfully!");
    } catch (e) {
        console.error("Push send failed:", e);
    }
}

testPush();
