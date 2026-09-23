import nestjsConfig from "@repo/eslint-config/nestjs";

export default [
  ...nestjsConfig,
  {
    ignores: ["src/generated/**", "dist/**"],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // node:test의 describe·it은 Promise를 돌려주지만 러너가 기다린다.
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
];
