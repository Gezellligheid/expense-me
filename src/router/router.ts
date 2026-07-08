import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("../views/Home.vue"),
  },
  {
    path: "/recurring",
    name: "recurring",
    component: () => import("../components/RecurringTransactions.vue"),
  },
  {
    path: "/projections",
    name: "projections",
    component: () => import("../views/Projections.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../views/Settings.vue"),
  },
  {
    path: "/wrapped",
    name: "wrapped",
    component: () => import("../views/Wrapped.vue"),
  },
  {
    path: "/quick-add",
    name: "quick-add",
    component: () => import("../views/QuickAdd.vue"),
  },
  {
    path: "/bank/callback",
    name: "bank-callback",
    component: () => import("../views/BankCallback.vue"),
  },
  {
    path: "/privacy",
    name: "privacy",
    component: () => import("../views/Privacy.vue"),
  },
  {
    path: "/terms",
    name: "terms",
    component: () => import("../views/Terms.vue"),
  },
];

/** Routes reachable without signing in (e.g. legal pages reviewers/users need pre-login). */
export const PUBLIC_ROUTE_NAMES = new Set(["privacy", "terms"]);

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
