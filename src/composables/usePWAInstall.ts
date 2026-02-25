import { ref } from "vue";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

// Module-level: the prompt event only fires once per page load
const _deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const _canInstall = ref(false);
const _installed = ref(false);
let _initialized = false;

export function usePWAInstall() {
  if (!_initialized) {
    _initialized = true;

    window.addEventListener("beforeinstallprompt", (e) => {
      // Prevent Chrome ≤67 mini-infobar
      e.preventDefault();
      _deferredPrompt.value = e as BeforeInstallPromptEvent;
      _canInstall.value = true;
    });

    window.addEventListener("appinstalled", () => {
      _deferredPrompt.value = null;
      _canInstall.value = false;
      _installed.value = true;
    });

    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      _installed.value = true;
    }
  }

  async function install() {
    if (!_deferredPrompt.value) return;
    await _deferredPrompt.value.prompt();
    const { outcome } = await _deferredPrompt.value.userChoice;
    if (outcome === "accepted") {
      _deferredPrompt.value = null;
      _canInstall.value = false;
    }
  }

  return { canInstall: _canInstall, installed: _installed, install };
}
