<script setup lang="ts">
import { watch, onMounted } from "vue";
import { RouterView } from "vue-router";
import Navbar from "./components/navbar/Navbar.vue";
import { useSettings } from "./composables/useSettings";

const { theme, initTheme } = useSettings();

onMounted(() => {
  initTheme();
});

watch(theme, () => {
  initTheme();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <Navbar />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <RouterView />
    </main>
  </div>
</template>
