<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { bankService } from "../services/bankService";

const route = useRoute();
const router = useRouter();

const status = ref<"connecting" | "success" | "error">("connecting");
const errorMessage = ref("");

onMounted(async () => {
  const { code, state, error } = route.query;

  if (typeof error === "string" && error) {
    status.value = "error";
    errorMessage.value = "The bank authorization was cancelled or denied.";
    return;
  }

  if (typeof code !== "string" || typeof state !== "string") {
    status.value = "error";
    errorMessage.value = "Missing authorization code from the bank.";
    return;
  }

  try {
    await bankService.exchange(code, state);
    status.value = "success";
    setTimeout(() => {
      void router.replace({ name: "settings", query: { bankConnected: "1" } });
    }, 1200);
  } catch (err) {
    status.value = "error";
    errorMessage.value = err instanceof Error ? err.message : String(err);
  }
});

const backToSettings = () => router.replace({ name: "settings" });
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center"
    >
      <template v-if="status === 'connecting'">
        <svg
          class="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <p class="text-gray-700 dark:text-gray-200 font-semibold">
          Connecting your bank…
        </p>
      </template>

      <template v-else-if="status === 'success'">
        <div class="text-5xl mb-3">✅</div>
        <p class="text-gray-800 dark:text-gray-100 font-semibold">
          Bank connected!
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Redirecting to Settings…
        </p>
      </template>

      <template v-else>
        <div class="text-5xl mb-3">⚠️</div>
        <p class="text-gray-800 dark:text-gray-100 font-semibold">
          Couldn't connect your bank
        </p>
        <p class="text-sm text-red-600 dark:text-red-400 mt-2">
          {{ errorMessage }}
        </p>
        <button
          @click="backToSettings"
          class="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Back to Settings
        </button>
      </template>
    </div>
  </div>
</template>
