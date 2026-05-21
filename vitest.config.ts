import { defineConfig } from "vitest/config";

/**
 * Vitest config raíz del monorepo. Cada package puede tener su propio
 * vitest.config.ts si necesita overrides (alias, setup files); si no, hereda
 * esta config descubriendo tests por el glob include.
 *
 * Decisiones:
 *  - environment "node" porque el server y el engine corren en Node;
 *    para tests de packages/web añadiremos un override "happy-dom" o
 *    "jsdom" cuando hagan falta (formatters son puros, no requieren DOM).
 *  - testTimeout 10s para tolerar scrypt en vault tests (KDF N=32768 son
 *    ~50-100ms por unlock; con varios casos no llega ni cerca al límite,
 *    pero damos margen).
 *  - coverage excluye .ts de tipos puros, configs y migraciones.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 10_000,
    include: ["packages/*/src/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/types.ts",
        "**/*.config.ts",
        "packages/server/drizzle/**",
        "packages/web/**", // por ahora; web tests vendrán con su propio config
      ],
    },
  },
});
