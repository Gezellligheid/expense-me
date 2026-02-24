<script setup lang="ts">
import { watch, onMounted } from "vue";
import { RouterView } from "vue-router";
import Navbar from "./components/navbar/Navbar.vue";
import Login from "./views/Login.vue";
import { useSettings } from "./composables/useSettings";
import { useAuth } from "./composables/useAuth";
import { useSidebar } from "./composables/useSidebar";
import { useSimulation } from "./composables/useSimulation";

const { theme, initTheme } = useSettings();
const { user, isLoadingAuth } = useAuth();
const { isCollapsed } = useSidebar();
const { isSimulating, acceptSimulation, rejectSimulation } = useSimulation();

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
    <!-- Simulation grayscale overlay: covers all content; sim-entry items render above it -->
    <transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isSimulating" class="sim-grayscale-overlay" />
    </transition>

    <Navbar />
    <!-- Offset for sidebar on desktop, top bar on mobile -->
    <main
      :class="[
        'transition-all duration-300 ease-in-out',
        'pt-14 md:pt-0',
        isCollapsed ? 'md:ml-16' : 'md:ml-60',
      ]"
    >
      <!-- Simulation banner -->
      <transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="-translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-full opacity-0"
      >
        <div
          v-if="isSimulating"
          class="sticky top-0 z-30 flex items-center gap-3 px-4 py-2.5 bg-amber-500 text-white shadow-lg flex-wrap"
        >
          <span class="text-lg">🧪</span>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm leading-tight">Simulation Mode</p>
            <p class="text-amber-100 text-xs leading-tight hidden sm:block">
              New changes are highlighted. Calculations reflect simulated data.
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="rejectSimulation"
              class="px-3 py-1.5 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Discard
            </button>
            <button
              @click="acceptSimulation"
              class="px-3 py-1.5 text-sm font-semibold bg-white text-amber-600 hover:bg-amber-50 rounded-lg transition-colors shadow-sm"
            >
              ✓ Accept Changes
            </button>
          </div>
        </div>
      </transition>

      <div class="p-4 sm:p-6 lg:p-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
