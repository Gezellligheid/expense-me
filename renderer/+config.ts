// Renderer config for Vike 0.4.x  no extension dependency.
// The meta block defines the `ssr` setting so Vike accepts it;
// ssr:false means the Page component is client-only (SPA mode).

const config = {
  meta: {
    ssr: {
      env: { config: true },
      effect: ({
        configValue,
      }: {
        configDefinedAt: string;
        configValue: unknown;
      }) => {
        if (typeof configValue !== "boolean") return undefined;
        return {
          meta: {
            Page: {
              env: configValue
                ? { server: true, client: true }
                : { client: true },
            },
          },
        };
      },
    },
  },
  ssr: false,
};

export default config;
