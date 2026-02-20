<script setup lang="ts">
import { watch, onMounted } from "vue";
import { RouterView } from "vue-router";
import Navbar from "./components/navbar/Navbar.vue";
import Login from "./views/Login.vue";
import { useSettings } from "./composables/useSettings";
import { useAuth } from "./composables/useAuth";
import { useSidebar } from "./composables/useSidebar";

const { theme, initTheme } = useSettings();
const { user, isLoadingAuth } = useAuth();
const { isCollapsed } = useSidebar();

onMounted(() => {
  initTheme();
});

watch(theme, () => {
  initTheme();
});
</script>

<template>
  <!-- Auth loading -->
  <div
    v-if="isLoadingAuth"
    class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"
  >
    <svg
      class="w-10 h-10 animate-spin text-blue-500"
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
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  </div>

  <!-- Not signed in -->
  <Login v-else-if="!user" />

  <!-- App -->
  <div v-else class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <Navbar />
    <!-- Offset for sidebar on desktop, top bar on mobile -->
    <main
      :class="[
        'transition-all duration-300 ease-in-out',
        'pt-14 md:pt-0',
        isCollapsed ? 'md:ml-16' : 'md:ml-60',
      ]"
    >
      <div class="p-4 sm:p-6 lg:p-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
