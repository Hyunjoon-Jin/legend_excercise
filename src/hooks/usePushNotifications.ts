import { useState, useEffect } from 'react';
import { savePushSubscription } from '@/lib/data';
import { useAuthStore } from '@/lib/store/use-auth-store';

export function usePushNotifications() {
    const { user } = useAuthStore();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    // 앱 로드 시: SW 자동 등록 + 기존 구독 여부 확인
    useEffect(() => {
        if (typeof window === 'undefined') return;

        if ('Notification' in window) {
            setPermission(Notification.permission);
        }

        if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

        navigator.serviceWorker.register('/sw.js')
            .then(registration => registration.pushManager.getSubscription())
            .then(async subscription => {
                if (subscription) {
                    setIsSubscribed(true);
                    // 브라우저에 구독이 있으면 DB에도 저장 (테이블 신규 생성 등으로 누락된 경우 복구)
                    await savePushSubscription(user.id, subscription.toJSON());
                }
            })
            .catch(err => console.error('SW registration check failed:', err));
    }, [user]);

    const subscribeToPush = async () => {
        if (!user) return;

        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.warn('Push messaging is not supported');
                return;
            }

            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult !== 'granted') {
                console.warn('Notification permission denied');
                return;
            }

            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!publicKey) throw new Error('VAPID public key missing');

            // 기존 구독 해제 후 재구독 (키 변경 대응)
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) await existingSub.unsubscribe();

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            await savePushSubscription(user.id, subscription.toJSON());
            setIsSubscribed(true);
            console.log('Push subscription successful');

        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
        }
    };

    return { isSubscribed, permission, subscribeToPush };
}
