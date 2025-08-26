declare global {
    interface Window {
        Telegram: {
            WebApp: {
                initData: string;
                initDataUnsafe: {
                    user?: TelegramUser;
                    receiver?: TelegramUser;
                    chat?: TelegramChat;
                    chat_type?: string;
                    chat_instance?: string;
                    start_param?: string;
                    can_send_after?: number;
                    auth_date: number;
                    hash: string;
                };
                version: string;
                platform: string;
                colorScheme: 'light' | 'dark';
                themeParams: TelegramThemeParams;
                isExpanded: boolean;
                viewportHeight: number;
                viewportStableHeight: number;
                headerColor: string;
                backgroundColor: string;
                isClosingConfirmationEnabled: boolean;
                isVerticalSwipesEnabled: boolean;

                // Methods
                ready: () => void;
                expand: () => void;
                close: () => void;
                setHeaderColor: (color: string) => void;
                setBackgroundColor: (color: string) => void;
                enableClosingConfirmation: () => void;
                disableClosingConfirmation: () => void;
                enableVerticalSwipes: () => void;
                disableVerticalSwipes: () => void;
                onEvent: (eventType: string, eventHandler: () => void) => void;
                offEvent: (eventType: string, eventHandler: () => void) => void;
                sendData: (data: string) => void;
                openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
                openTelegramLink: (url: string) => void;
                openInvoice: (url: string, callback?: (status: string) => void) => void;
                showPopup: (params: TelegramPopupParams, callback?: (buttonId: string) => void) => void;
                showAlert: (message: string, callback?: () => void) => void;
                showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
                showScanQrPopup: (params: TelegramScanQrPopupParams, callback?: (text: string) => boolean) => void;
                closeScanQrPopup: () => void;
                readTextFromClipboard: (callback?: (text: string) => void) => void;
                requestWriteAccess: (callback?: (granted: boolean) => void) => void;
                requestContact: (callback?: (granted: boolean, contact?: TelegramContact) => void) => void;

                MainButton: TelegramMainButton;
                BackButton: TelegramBackButton;
                SettingsButton: TelegramSettingsButton;
                HapticFeedback: TelegramHapticFeedback;
                CloudStorage: TelegramCloudStorage;
                BiometricManager: TelegramBiometricManager;
            };
        };
    }
}

export interface TelegramUser {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
    allows_write_to_pm?: boolean;
}

export interface TelegramChat {
    id: number;
    type: 'group' | 'supergroup' | 'channel';
    title: string;
    username?: string;
    photo_url?: string;
}

export interface TelegramThemeParams {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
    header_bg_color?: string;
    accent_text_color?: string;
    section_bg_color?: string;
    section_header_text_color?: string;
    subtitle_text_color?: string;
    destructive_text_color?: string;
}

export interface TelegramMainButton {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
        text?: string;
        color?: string;
        text_color?: string;
        is_active?: boolean;
        is_visible?: boolean;
    }) => void;
}

export interface TelegramBackButton {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
}

export interface TelegramSettingsButton {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
}

export interface TelegramHapticFeedback {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
}

export interface TelegramCloudStorage {
    setItem: (key: string, value: string, callback?: (error: string | null, success: boolean) => void) => void;
    getItem: (key: string, callback: (error: string | null, value: string | null) => void) => void;
    getItems: (keys: string[], callback: (error: string | null, values: Record<string, string>) => void) => void;
    removeItem: (key: string, callback?: (error: string | null, success: boolean) => void) => void;
    removeItems: (keys: string[], callback?: (error: string | null, success: boolean) => void) => void;
    getKeys: (callback: (error: string | null, keys: string[]) => void) => void;
}

export interface TelegramBiometricManager {
    isInited: boolean;
    isBiometricAvailable: boolean;
    biometricType: 'finger' | 'face' | 'unknown';
    isAccessRequested: boolean;
    isAccessGranted: boolean;
    isBiometricTokenSaved: boolean;
    deviceId: string;
    init: (callback?: () => void) => void;
    requestAccess: (params: { reason?: string }, callback?: (granted: boolean) => void) => void;
    authenticate: (params: { reason?: string }, callback?: (success: boolean, token?: string) => void) => void;
    updateBiometricToken: (token: string, callback?: (success: boolean) => void) => void;
    openSettings: () => void;
}

export interface TelegramPopupParams {
    title?: string;
    message: string;
    buttons?: Array<{
        id?: string;
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
        text?: string;
    }>;
}

export interface TelegramScanQrPopupParams {
    text?: string;
}

export interface TelegramContact {
    contact: {
        user_id: number;
        phone_number: string;
        first_name: string;
        last_name?: string;
        vcard?: string;
    };
}

export interface TelegramAuthData {
    user: TelegramUser;
    chat?: TelegramChat;
    chat_type?: string;
    start_param?: string;
    auth_date: number;
    hash: string;
    initData: string;
}

export function initTelegramWebApp(): TelegramAuthData | null {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;

        try {
            webApp.ready();
            webApp.expand();

            webApp.enableClosingConfirmation();
            webApp.enableVerticalSwipes();

            const { user, chat, chat_type, start_param, auth_date, hash } = webApp.initDataUnsafe;

            if (user && auth_date && hash) {
                console.log('Telegram WebApp initialized successfully', {
                    user: user.username || user.first_name,
                    version: webApp.version,
                    platform: webApp.platform,
                    colorScheme: webApp.colorScheme
                });

                return {
                    user,
                    chat,
                    chat_type,
                    start_param,
                    auth_date,
                    hash,
                    initData: webApp.initData
                };
            } else {
                console.warn('Telegram WebApp: Missing required user data', {
                    hasUser: !!user,
                    hasAuthDate: !!auth_date,
                    hasHash: !!hash,
                    initData: webApp.initData
                });
            }
        } catch (error) {
            console.error('Error initializing Telegram WebApp:', error);
        }
    } else {
        console.log('Telegram WebApp not available - running in development mode');
    }

    console.log('Using development fallback user data');
    return {
        user: {
            id: 123456789,
            first_name: 'Demo',
            last_name: 'User',
            username: 'demo_user',
            language_code: 'en',
            is_premium: false
        },
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'demo_hash',
        initData: 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Demo%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22demo_user%22%2C%22language_code%22%3A%22en%22%7D&auth_date=1234567890&hash=demo_hash'
    };
}

export class TelegramWebAppManager {
    private static instance: TelegramWebAppManager;
    private webApp: typeof window.Telegram.WebApp | null = null;
    private initialized = false;

    private constructor() {
    }

    static getInstance(): TelegramWebAppManager {
        if (!TelegramWebAppManager.instance) {
            TelegramWebAppManager.instance = new TelegramWebAppManager();
        }
        return TelegramWebAppManager.instance;
    }

    initialize(): boolean {
        if (this.initialized) return true;

        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            this.webApp = window.Telegram.WebApp;

            // Initialize the web app
            this.webApp.ready();
            this.webApp.expand();

            // Configure default behavior
            this.webApp.enableClosingConfirmation();
            this.webApp.enableVerticalSwipes();

            this.initialized = true;
            console.log('Telegram WebApp Manager initialized');
            return true;
        }

        console.log('Telegram WebApp not available');
        return false;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    showMainButton(text: string, callback: () => void): void {
        if (this.webApp?.MainButton) {
            this.webApp.MainButton.setText(text);
            this.webApp.MainButton.onClick(callback);
            this.webApp.MainButton.show();
        }
    }

    hideMainButton(): void {
        if (this.webApp?.MainButton) {
            this.webApp.MainButton.hide();
        }
    }

    showAlert(message: string, callback?: () => void): void {
        if (this.webApp) {
            this.webApp.showAlert(message, callback);
        } else {
            alert(message);
            callback?.();
        }
    }

    hapticFeedback(type: 'impact' | 'notification' | 'selection', style?: 'light' | 'medium' | 'heavy' | 'error' | 'success' | 'warning'): void {
        if (this.webApp?.HapticFeedback) {
            if (type === 'impact' && style && ['light', 'medium', 'heavy'].includes(style)) {
                this.webApp.HapticFeedback.impactOccurred(style as 'light' | 'medium' | 'heavy');
            } else if (type === 'notification' && style && ['error', 'success', 'warning'].includes(style)) {
                this.webApp.HapticFeedback.notificationOccurred(style as 'error' | 'success' | 'warning');
            } else if (type === 'selection') {
                this.webApp.HapticFeedback.selectionChanged();
            }
        }
    }

    close(): void {
        if (this.webApp) {
            this.webApp.close();
        }
    }
}

export function applyTelegramTheme(): void {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const themeParams = window.Telegram.WebApp.themeParams;
        const root = document.documentElement;

        if (themeParams.bg_color) {
            root.style.setProperty('--tg-bg-color', themeParams.bg_color);
        }
        if (themeParams.text_color) {
            root.style.setProperty('--tg-text-color', themeParams.text_color);
        }
        if (themeParams.hint_color) {
            root.style.setProperty('--tg-hint-color', themeParams.hint_color);
        }
        if (themeParams.link_color) {
            root.style.setProperty('--tg-link-color', themeParams.link_color);
        }
        if (themeParams.button_color) {
            root.style.setProperty('--tg-button-color', themeParams.button_color);
        }
        if (themeParams.button_text_color) {
            root.style.setProperty('--tg-button-text-color', themeParams.button_text_color);
        }
        if (themeParams.secondary_bg_color) {
            root.style.setProperty('--tg-secondary-bg-color', themeParams.secondary_bg_color);
        }
        if (themeParams.header_bg_color) {
            root.style.setProperty('--tg-header-bg-color', themeParams.header_bg_color);
        }
        if (themeParams.accent_text_color) {
            root.style.setProperty('--tg-accent-text-color', themeParams.accent_text_color);
        }
    }
}