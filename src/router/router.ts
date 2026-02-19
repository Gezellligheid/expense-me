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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
