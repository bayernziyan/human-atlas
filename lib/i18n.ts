import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from '../locales/en.json';
import zhCN from '../locales/zh-CN.json';

export const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const STORAGE_KEY = 'human-atlas-lang';
const SUGGESTED_COOKIE = 'human-atlas-lang-suggested';
const QUERY_KEY = 'lang';
const STORAGE_KEYS_TO_TRY = [STORAGE_KEY, 'anatomy-studio-lang', 'lang'];
const NAMESPACE = 'translation';

function readUrlParam(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(QUERY_KEY);
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh_cn') return 'zh-CN';
    if (lower === 'en' || lower === 'en-us' || lower === 'en_us') return 'en';
  } catch {
    return null;
  }
  return null;
}

function readCookie(): SupportedLanguage | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie.split('; ').find((c) => c.startsWith(`${SUGGESTED_COOKIE}=`));
  if (!cookie) return null;
  const value = cookie.slice(SUGGESTED_COOKIE.length + 1);
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(value)) {
    return value as SupportedLanguage;
  }
  return null;
}

function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  const fromUrl = readUrlParam();
  if (fromUrl) return fromUrl;
  const fromCookie = readCookie();
  if (fromCookie) return fromCookie;
  for (const key of STORAGE_KEYS_TO_TRY) {
    const saved = window.localStorage.getItem(key);
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
      return saved as SupportedLanguage;
    }
  }
  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith('zh')) return 'zh-CN';
  return 'en';
}

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      lng: detectInitialLanguage(),
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      ns: [NAMESPACE],
      defaultNS: NAMESPACE,
      interpolation: {escapeValue: false},
      returnNull: false,
      returnEmptyString: false,
      react: {useSuspense: false},
    })
    .then(() => {
      // Add bundles AFTER init so i18next marks both languages as loaded.
      // Passing inline `resources:` to init() leaves `i18n.languages` empty
      // for any language other than the resolved one, which causes
      // `i18n.t()` to fall back to English.
      i18n.addResourceBundle('en', NAMESPACE, en, true, true);
      i18n.addResourceBundle('zh-CN', NAMESPACE, zhCN, true, true);
    });
}

export function setLanguage(lang: SupportedLanguage) {
  void i18n.changeLanguage(lang);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
}

export function getCurrentLanguage(): SupportedLanguage {
  const lng = i18n.language;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lng)
    ? (lng as SupportedLanguage)
    : 'en';
}

export default i18n;