import { createApp } from "vue";
import router from "../src/router/router";
import App from "../src/App.vue";
import "../src/style.css";

export async function onRenderClient() {
  const app = createApp(App);
  app.use(router);
  await router.isReady();
  app.mount("#app");
}
