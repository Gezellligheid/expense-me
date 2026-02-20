<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../composables/useAuth";

const { signInWithGoogle } = useAuth();

const isSigningIn = ref(false);
const error = ref<string | null>(null);

async function handleSignIn() {
  error.value = null;
  isSigningIn.value = true;
  try {
    await signInWithGoogle();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sign-in failed.";
    // Ignore popup-closed-by-user errors
    if (!msg.includes("cancelled") && !msg.includes("popup-closed")) {
      error.value = msg;
    }
  } finally {
    isSigningIn.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-sm text-center"
    >
      <!-- Logo -->
      <div class="text-5xl mb-4">💰</div>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-1">
        Expense-me
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Track your finances across all your devices
      </p>

      <!-- Migration note -->
      <div
        class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-6 text-left"
      >
        <p class="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <span class="font-semibold">Already using Expense-me?</span> Sign in
          and your existing data will be automatically saved to your account.
        </p>
      </div>

      <!-- Error -->
      <div
        v-if="error"
        class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4 text-sm text-red-600 dark:text-red-400"
      >
        {{ error }}
      </div>

      <!-- Sign-in button -->
      <button
        @click="handleSignIn"
        :disabled="isSigningIn"
        class="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <!-- Google "G" SVG -->
        <svg
          v-if="!isSigningIn"
          class="w-5 h-5 shrink-0"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#4285F4"
            d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
          />
          <path
            fill="#34A853"
            d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
          />
          <path
            fill="#FBBC05"
            d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
          />
          <path
            fill="#EA4335"
            d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
          />
        </svg>
        <!-- Spinner -->
        <svg
          v-else
          class="w-5 h-5 animate-spin text-gray-400"
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
        <span>{{ isSigningIn ? "Signing in…" : "Continue with Google" }}</span>
      </button>

      <p class="text-xs text-gray-400 dark:text-gray-500 mt-6">
        Your data is stored securely and synced in real time.
      </p>
    </div>
  </div>
</template>
