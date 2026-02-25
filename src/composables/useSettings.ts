import { ref, watch, computed } from "vue";
import { pushToCloud } from "../services/cloudSyncService";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export type Theme = "light" | "dark" | "system";

export interface AppSettings {
  currency: string;
  theme: Theme;
}

export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", flag: "🇨🇭" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flag: "🇳🇿" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", flag: "🇸🇪" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", flag: "🇳🇴" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", flag: "🇩🇰" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", flag: "🇲🇽" },
  { code: "ZAR", symbol: "R", name: "South African Rand", flag: "🇿🇦" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", flag: "🇰🇷" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", flag: "🇭🇰" },
  { code: "PLN", symbol: "zł", name: "Polish Złoty", flag: "🇵🇱" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", flag: "🇨🇿" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint", flag: "🇭🇺" },
  { code: "RON", symbol: "lei", name: "Romanian Leu", flag: "🇷🇴" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", flag: "🇹🇷" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", flag: "🇸🇦" },
  { code: "THB", symbol: "฿", name: "Thai Baht", flag: "🇹🇭" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", flag: "🇮🇩" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flag: "🇲🇾" },
];

const DEFAULT_SETTINGS: AppSettings = {
  currency: "USD",
  theme: "light",
};

function loadSettings(): AppSettings {
  try {
    const s = localStorage.getItem("appSettings");
    if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

// ── Singleton shared reactive state ─────────────────────────────────────────
const settings = ref<AppSettings>(loadSettings());

// ── Test mode — dev only, never pushed to cloud ───────────────────────────────
const _testMode = ref<boolean>(
  import.meta.env.DEV ? localStorage.getItem("testMode") === "true" : false,
);

watch(
  settings,
  (val) => {
    const serialized = JSON.stringify(val);
    localStorage.setItem("appSettings", serialized);
    void pushToCloud("appSettings", serialized);
  },
  { deep: true },
);

// When another device pushes new settings via Firestore the onSnapshot handler
// updates localStorage and fires 'storage-updated'. Reload here so the UI
// reflects the change without a full page refresh.
function handleRemoteSettingsUpdate() {
  const fresh = loadSettings();
  if (JSON.stringify(fresh) !== JSON.stringify(settings.value)) {
    settings.value = fresh;
  }
}
window.addEventListener("storage-updated", handleRemoteSettingsUpdate);

let mqCleanup: (() => void) | null = null;

function applyTheme(t: Theme) {
  const html = document.documentElement;
  if (mqCleanup) {
    mqCleanup();
    mqCleanup = null;
  }
  if (t === "dark") {
    html.classList.add("dark");
  } else if (t === "light") {
    html.classList.remove("dark");
  } else {
    // system
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) html.classList.add("dark");
      else html.classList.remove("dark");
    };
    mq.addEventListener("change", handler);
    mqCleanup = () => mq.removeEventListener("change", handler);
    if (mq.matches) html.classList.add("dark");
    else html.classList.remove("dark");
  }
}

export function useSettings() {
  const currencyCode = computed(() => settings.value.currency);
  const theme = computed(() => settings.value.theme);

  const currencyInfo = computed(
    () =>
      CURRENCIES.find((c) => c.code === settings.value.currency) ??
      CURRENCIES[0]!,
  );

  function setCurrency(code: string) {
    settings.value = { ...settings.value, currency: code };
  }

  function setTheme(t: Theme) {
    settings.value = { ...settings.value, theme: t };
    applyTheme(t);
  }

  const isTestMode = computed(() => _testMode.value);

  function setTestMode(enabled: boolean) {
    if (!import.meta.env.DEV) return;
    _testMode.value = enabled;
    localStorage.setItem("testMode", String(enabled));
    // Notify views so they reload data
    window.dispatchEvent(new Event("storage-updated"));
  }

  /** Call once on app mount to apply the persisted theme. */
  function initTheme() {
    applyTheme(settings.value.theme);
  }

  function formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: settings.value.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${settings.value.currency} ${amount.toFixed(2)}`;
    }
  }

  return {
    settings,
    currencyCode,
    theme,
    currencyInfo,
    setCurrency,
    setTheme,
    initTheme,
    formatCurrency,
    isTestMode,
    setTestMode,
  };
}
