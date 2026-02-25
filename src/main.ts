import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router from "./router/router";

// Register the service worker (public/sw.js) for PWA / offline support.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}

const app = createApp(App);
app.use(router);
app.mount("#app");
