import { ref } from "vue";

export interface WrappedStatus {
  available: boolean;
  /** The calendar year the current Wrapped covers (e.g. 2025). */
  year: number;
}

// Module-level shared state — the fetch is made once per page load and the
// reactive refs are shared across every component that calls useWrappedStatus().
const _status = ref<WrappedStatus | null>(null);
const _loading = ref(true);
let _initialized = false;

export function useWrappedStatus() {
  if (!_initialized) {
    _initialized = true;
    fetch("/api/wrapped-status")
      .then((r) => r.json() as Promise<WrappedStatus>)
      .then((data) => {
        _status.value = data;
      })
      .catch(() => {
        // Fallback: treat as unavailable so nothing breaks when running locally
        // without the serverless function
        _status.value = {
          available: false,
          year: new Date().getFullYear() - 1,
        };
      })
      .finally(() => {
        _loading.value = false;
      });
  }

  return { status: _status, loading: _loading };
}
