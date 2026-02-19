<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import ExpenseModal from "../modals/ExpenseModal.vue";
import IncomeModal from "../modals/IncomeModal.vue";

const showAddMenu = ref(false);
const showExpenseModal = ref(false);
const showIncomeModal = ref(false);
const addMenuRef = ref<HTMLElement | null>(null);

const toggleAddMenu = () => {
  showAddMenu.value = !showAddMenu.value;
};

const handleClickOutside = (event: MouseEvent) => {
  if (addMenuRef.value && !addMenuRef.value.contains(event.target as Node)) {
    showAddMenu.value = false;
  }
};

const handleKeyboardShortcut = (event: KeyboardEvent) => {
  // Ctrl+E or Cmd+E to add expense
  if ((event.ctrlKey || event.metaKey) && event.key === "e") {
    event.preventDefault();
    openExpenseModal();
  }
  // Ctrl+I or Cmd+I to add income
  if ((event.ctrlKey || event.metaKey) && event.key === "i") {
    event.preventDefault();
    openIncomeModal();
  }
  // ESC to close modals
  if (event.key === "Escape") {
    if (showExpenseModal.value) showExpenseModal.value = false;
    if (showIncomeModal.value) showIncomeModal.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleKeyboardShortcut);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleKeyboardShortcut);
});

const openExpenseModal = () => {
  showAddMenu.value = false;
  showExpenseModal.value = true;
};

const openIncomeModal = () => {
  showAddMenu.value = false;
  showIncomeModal.value = true;
};

const closeExpenseModal = () => {
  showExpenseModal.value = false;
};

const closeIncomeModal = () => {
  showIncomeModal.value = false;
};
</script>

<template>
  <nav class="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo/Brand -->
        <div class="flex items-center">
          <router-link to="/" class="flex items-center gap-2 group">
            <h1
              class="text-white text-2xl font-bold tracking-tight group-hover:text-blue-100 transition-colors"
            >
              💰 Expense-me
            </h1>
          </router-link>
        </div>

        <!-- Navigation Links -->
        <div class="hidden md:flex items-center space-x-6">
          <router-link
            to="/"
            exact-active-class="!text-white bg-white/20 rounded-lg px-2 py-1"
            class="text-white/80 hover:text-white transition-colors duration-200 flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span class="font-medium">Dashboard</span>
          </router-link>

          <router-link
            to="/recurring"
            active-class="!text-white bg-white/20 rounded-lg px-2 py-1"
            class="text-white/80 hover:text-white transition-colors duration-200 flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span class="font-medium">Recurring</span>
          </router-link>

          <a
            href="#"
            class="text-white hover:text-blue-200 transition-colors duration-200 flex items-center gap-2"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="font-medium">History</span>
          </a>

          <router-link
            to="/projections"
            active-class="!text-white bg-white/20 rounded-lg px-2 py-1"
            class="text-white/80 hover:text-white transition-colors duration-200 flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
              />
            </svg>
            <span class="font-medium">Projections</span>
          </router-link>

          <router-link
            to="/settings"
            active-class="!text-white bg-white/20 rounded-lg px-2 py-1"
            class="text-white/80 hover:text-white transition-colors duration-200 flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span class="font-medium">Settings</span>
          </router-link>
        </div>

        <!-- Add Button (with dropdown) -->
        <div class="relative" ref="addMenuRef">
          <button
            @click="toggleAddMenu"
            class="bg-white text-blue-600 hover:bg-blue-50 font-semibold py-2 px-4 rounded-lg shadow-md transition-all duration-200 flex items-center gap-2 hover:scale-105"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add New</span>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="showAddMenu"
            class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border border-gray-100"
          >
            <button
              @click="openExpenseModal"
              class="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors duration-150 flex items-center gap-3"
            >
              <svg
                class="w-5 h-5 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <div>
                <div class="font-semibold text-gray-800">Add Expense</div>
                <div class="text-xs text-gray-500">Record a payment</div>
              </div>
            </button>

            <button
              @click="openIncomeModal"
              class="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors duration-150 flex items-center gap-3"
            >
              <svg
                class="w-5 h-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <div class="font-semibold text-gray-800">Add Income</div>
                <div class="text-xs text-gray-500">Record earnings</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <div class="md:hidden px-4 pb-4 space-y-1">
      <router-link
        to="/"
        exact-active-class="bg-white/20 font-semibold"
        class="block text-white hover:text-blue-200 py-2 px-3 rounded-lg"
        >Dashboard</router-link
      >
      <router-link
        to="/recurring"
        active-class="bg-white/20 font-semibold"
        class="block text-white hover:text-blue-200 py-2 px-3 rounded-lg"
        >Recurring</router-link
      >
      <a
        href="#"
        class="block text-white hover:text-blue-200 py-2 px-3 rounded-lg"
        >History</a
      >
      <router-link
        to="/projections"
        active-class="bg-white/20 font-semibold"
        class="block text-white hover:text-blue-200 py-2 px-3 rounded-lg"
        >Projections</router-link
      >
      <router-link
        to="/settings"
        active-class="bg-white/20 font-semibold"
        class="block text-white hover:text-blue-200 py-2 px-3 rounded-lg"
        >Settings</router-link
      >
    </div>
  </nav>

  <!-- Modals -->
  <ExpenseModal :is-open="showExpenseModal" @close="closeExpenseModal" />
  <IncomeModal :is-open="showIncomeModal" @close="closeIncomeModal" />
</template>

<style scoped>
/* Custom styles if needed */
</style>
