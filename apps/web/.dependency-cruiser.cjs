/**
 * The dependency rule (docs/ARCHITECTURE.md):
 *   domain  <-  application  <-  infrastructure / ui / app
 * A violation fails `pnpm arch` and CI.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment: "domain imports only other domain code, zod and shared/lib.",
      severity: "error",
      from: { path: "^src/modules/[^/]+/domain/" },
      to: {
        pathNot: [
          "^src/modules/[^/]+/domain/",
          "^src/shared/lib/(result|errors|dates)\\.ts$",
          "node_modules/zod/",
        ],
      },
    },
    {
      name: "application-depends-on-domain-only",
      severity: "error",
      from: { path: "^src/modules/[^/]+/application/" },
      to: {
        path: [
          "/infrastructure/",
          "/ui/",
          "^src/app/",
          "^src/server/",
          "node_modules/(next|react|react-dom|@supabase/[^/]+|@ai-sdk/[^/]+|ai)/",
        ],
      },
    },
    {
      name: "ui-never-imports-infrastructure",
      severity: "error",
      from: { path: ["/ui/", "^src/app/"] },
      to: { path: "/infrastructure/" },
    },
    {
      name: "infrastructure-never-imports-ui",
      severity: "error",
      from: { path: "/infrastructure/" },
      to: { path: ["/ui/", "^src/app/"] },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    exclude: { path: ["\\.test\\.ts$", "\\.next/"] },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
