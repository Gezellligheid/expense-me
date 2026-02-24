<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import ExpenseModal from "../modals/ExpenseModal.vue";
import IncomeModal from "../modals/IncomeModal.vue";
import { useAuth } from "../../composables/useAuth";
import { useSidebar } from "../../composables/useSidebar";
import { useSimulation } from "../../composables/useSimulation";

const { user, signOut } = useAuth();
const {
  isCollapsed,
  isMobileOpen,
  toggleCollapsed,
  toggleMobile,
  closeMobile,
} = useSidebar();
const { isSimulating, startSimulation, rejectSimulation } = useSimulation();

const showExpenseModal = ref(false);
const showIncomeModal = ref(false);

const handleKeyboardShortcut = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    toggleCollapsed();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "e") {
    event.preventDefault();
    openExpenseModal();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "i") {
    event.preventDefault();
    openIncomeModal();
  }
  if (event.key === "Escape") {
    if (showExpenseModal.value) showExpenseModal.value = false;
    if (showIncomeModal.value) showIncomeModal.value = false;
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleKeyboardShortcut);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyboardShortcut);
});

const openExpenseModal = () => {
  closeMobile();
  showExpenseModal.value = true;
};

const openIncomeModal = () => {
  closeMobile();
  showIncomeModal.value = true;
};
</script>

<template>
  <!-- â”€â”€ Mobile top bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <header
    class="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-4"
  >
    <button
      @click="toggleMobile"
      class="p-2 -ml-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      aria-label="Open menu"
    >
      <!-- Hamburger -->
      <svg
        class="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>

    <router-link to="/" class="flex items-center gap-2">
      <span class="text-xl">💰</span>
      <span
        class="font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
        >Expense-me</span
      >
    </router-link>

    <!-- Quick-add on mobile top bar -->
    <div class="flex items-center gap-1">
      <button
        @click="openExpenseModal"
        class="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        title="Add Expense"
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
      </button>
    </div>
  </header>

  <!-- â”€â”€ Mobile overlay backdrop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <transition name="fade">
    <div
      v-if="isMobileOpen"
      class="md:hidden fixed inset-0 z-40 bg-black/50"
      @click="closeMobile"
    />
  </transition>

  <!-- â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <aside
    :class="[
      'fixed top-0 left-0 z-50 h-full flex flex-col',
      'bg-gray-950 border-r border-gray-800/60',
      'transition-all duration-300 ease-in-out',
      // desktop width
      isCollapsed ? 'md:w-16' : 'md:w-60',
      // mobile: slide in/out
      isMobileOpen
        ? 'translate-x-0 w-72'
        : '-translate-x-full md:translate-x-0',
      'shadow-xl',
    ]"
  >
    <!-- Edge collapse toggle (desktop only) -->
    <button
      @click="toggleCollapsed"
      :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      class="hidden md:flex absolute -right-3 top-14 z-10 w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors items-center justify-center shadow-md"
    >
      <svg
        class="w-3 h-3 transition-transform duration-300"
        :class="isCollapsed ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.5"
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </button>

    <!-- Logo + collapse toggle -->
    <div
      class="flex items-center h-16 px-3 border-b border-gray-800/60 shrink-0"
    >
      <router-link
        to="/"
        @click="closeMobile"
        class="flex items-center gap-2 overflow-hidden flex-1 min-w-0"
      >
        <span class="text-2xl shrink-0">💰</span>
        <span
          :class="[
            'font-bold text-lg bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          Expense-me
        </span>
      </router-link>
      <!-- collapse toggle removed from here, now on sidebar edge -->
      <!-- Close button (mobile only) -->
      <button
        @click="closeMobile"
        class="md:hidden shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-gray-200 hover:bg-gray-800 transition-colors"
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Quick-add buttons -->
    <div class="px-2 pt-4 pb-3 space-y-1 shrink-0 border-b border-gray-800/60">
      <button
        @click="openExpenseModal"
        :class="[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
          'text-gray-400 hover:text-white hover:bg-gray-800/70',
          'transition-colors duration-150 overflow-hidden',
          isCollapsed ? 'md:justify-center' : '',
        ]"
        :title="isCollapsed ? 'Add Expense' : undefined"
      >
        <svg
          class="w-5 h-5 shrink-0 text-red-400"
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
        <span
          :class="[
            'text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          Add Expense
        </span>
      </button>

      <button
        @click="openIncomeModal"
        :class="[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
          'text-gray-400 hover:text-white hover:bg-gray-800/70',
          'transition-colors duration-150 overflow-hidden',
          isCollapsed ? 'md:justify-center' : '',
        ]"
        :title="isCollapsed ? 'Add Income' : undefined"
      >
        <svg
          class="w-5 h-5 shrink-0 text-emerald-400"
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
        <span
          :class="[
            'text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          Add Income
        </span>
      </button>
    </div>

    <!-- Nav links -->
    <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
      <router-link
        to="/"
        @click="closeMobile"
        :class="[
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 group overflow-hidden',
          isCollapsed ? 'md:justify-center' : '',
        ]"
        exact-active-class="!bg-gradient-to-r !from-blue-500/20 !to-purple-500/20 !text-white !border-l-2 !border-blue-500"
        class="text-gray-400 hover:text-white hover:bg-gray-800/70 border-l-2 border-transparent"
        :title="isCollapsed ? 'Dashboard' : undefined"
      >
        <svg
          class="w-5 h-5 shrink-0"
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
        <span
          :class="[
            'text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          Dashboard
        </span>
      </router-link>

      <router-link
        to="/recurring"
        @click="closeMobile"
        :class="[
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 overflow-hidden',
          isCollapsed ? 'md:justify-center' : '',
        ]"
        active-class="!bg-gradient-to-r !from-blue-500/20 !to-purple-500/20 !text-white !border-l-2 !border-blue-500"
        class="text-gray-400 hover:text-white hover:bg-gray-800/70 border-l-2 border-transparent"
        :title="isCollapsed ? 'Recurring' : undefined"
      >
        <svg
          class="w-5 h-5 shrink-0"
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
        <span
          :class="[
            'text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          Recurring
        </span>
      </router-link>

      <router-link
        to="/projections"
        @click="closeMobile"
        :class="[
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 overflow-hidden',
          isCollapsed ? 'md:justify-center' : '',
        ]"
        active-class="!bg-gradient-to-r !from-blue-500/20 !to-purple-500/20 !text-white !border-l-2 !border-blue-500"
        class="text-gray-400 hover:text-white hover:bg-gray-800/70 border-l-2 border-transparent"
        :title="isCollapsed ? 'Projections' : undefined"
      >
        <svg
          class="w-5 h-5 shrink-0"
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
        <span
          :class="[
            'text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          Projections
        </span>
        <span
          :class="[
            'text-xs font-semibold px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 leading-none shrink-0 transition-all duration-200',
            isCollapsed ? 'md:hidden' : '',
          ]"
          >AI</span
        >
      </router-link>

      <router-link
        to="/settings"
        @click="closeMobile"
        :class="[
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 overflow-hidden',
          isCollapsed ? 'md:justify-center' : '',
        ]"
        active-class="!bg-gradient-to-r !from-blue-500/20 !to-purple-500/20 !text-white !border-l-2 !border-blue-500"
        class="text-gray-400 hover:text-white hover:bg-gray-800/70 border-l-2 border-transparent"
        :title="isCollapsed ? 'Settings' : undefined"
      >
        <svg
          class="w-5 h-5 shrink-0"
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
        <span
          :class="[
            'text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          Settings
        </span>
      </router-link>

      <!-- Simulation divider -->
      <div class="my-2 border-t border-gray-800/60" />

      <!-- Simulation toggle -->
      <button
        @click="isSimulating ? rejectSimulation() : startSimulation()"
        :class="[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 overflow-hidden border-l-2',
          isCollapsed ? 'md:justify-center' : '',
          isSimulating
            ? 'border-amber-500 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
            : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/70',
        ]"
        :title="
          isSimulating ? 'Exit Simulation (discard)' : 'Start Simulation Mode'
        "
      >
        <svg
          class="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 3v10.586l-3.707 3.707A1 1 0 006 19h12a1 1 0 00.707-1.707L15 13.586V3M9 3h6M9 3H7m8 0h2"
          />
        </svg>
        <span
          :class="[
            'text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          {{ isSimulating ? "Exit Simulation" : "Simulate" }}
        </span>
        <!-- Active indicator dot -->
        <span
          v-if="isSimulating"
          :class="[
            'ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0',
            isCollapsed ? 'md:hidden' : '',
          ]"
        />
      </button>
    </nav>

    <!-- User section at the bottom -->
    <div class="px-2 pb-4 pt-2 border-t border-gray-800/60 shrink-0">
      <div
        :class="[
          'flex items-center py-2.5 overflow-hidden transition-all duration-200',
          isCollapsed ? 'md:justify-center md:gap-0 md:px-0' : 'gap-3 px-3',
        ]"
      >
        <!-- Avatar -->
        <img
          v-if="user?.photoURL"
          :src="user.photoURL"
          :alt="user.displayName ?? 'User'"
          class="w-8 h-8 rounded-full border border-gray-700 object-cover shrink-0"
        />
        <div
          v-else
          class="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 font-semibold text-sm shrink-0"
        >
          {{
            (user?.displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()
          }}
        </div>
        <!-- Name + email -->
        <div
          :class="[
            'flex-1 min-w-0 transition-all duration-200 overflow-hidden',
            isCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-auto md:opacity-100',
          ]"
        >
          <p class="text-gray-200 text-sm font-medium truncate leading-tight">
            {{ user?.displayName ?? "User" }}
          </p>
          <p class="text-gray-500 text-xs truncate leading-tight">
            {{ user?.email }}
          </p>
        </div>
        <!-- Sign out -->
        <button
          @click="signOut"
          :class="[
            'shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-gray-200 hover:bg-gray-800 transition-colors',
            isCollapsed ? 'md:hidden' : '',
          ]"
          title="Sign out"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
            />
          </svg>
        </button>
      </div>
      <!-- Sign out shown separately when collapsed on desktop -->
      <button
        v-if="isCollapsed"
        @click="signOut"
        class="hidden md:flex w-full items-center justify-center py-2 rounded-xl text-gray-600 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        title="Sign out"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
          />
        </svg>
      </button>
    </div>
  </aside>

  <!-- Modals -->
  <ExpenseModal :is-open="showExpenseModal" @close="showExpenseModal = false" />
  <IncomeModal :is-open="showIncomeModal" @close="showIncomeModal = false" />
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
