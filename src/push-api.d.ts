// Push API type augmentations for ServiceWorkerRegistration
interface PushSubscriptionOptionsInit {
  userVisibleOnly?: boolean;
  applicationServerKey?: BufferSource | string | null;
}

interface PushSubscriptionJSON {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: Record<string, string>;
}

interface PushSubscription {
  readonly endpoint: string;
  readonly expirationTime: number | null;
  readonly options: PushSubscriptionOptionsInit;
  getKey(name: PushEncryptionKeyName): ArrayBuffer | null;
  toJSON(): PushSubscriptionJSON;
  unsubscribe(): Promise<boolean>;
}

type PushEncryptionKeyName = 'p256dh' | 'auth';

interface PushManager {
  getSubscription(): Promise<PushSubscription | null>;
  permissionState(options?: PushSubscriptionOptionsInit): Promise<PushPermissionState>;
  subscribe(options?: PushSubscriptionOptionsInit): Promise<PushSubscription>;
}

type PushPermissionState = 'denied' | 'granted' | 'prompt';

interface ServiceWorkerRegistration {
  readonly pushManager: PushManager;
}
