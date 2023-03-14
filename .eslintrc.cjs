module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    // "plugin:@typescript-eslint/stylistic",
  ],
  overrides: [
    {
      files: ["**/*.spec.{js,ts}"],
      extends: ["plugin:playwright/playwright-test"],
    },
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-empty-function": "off",
    // Use consistent import {type TypeThing} from 'some-path';
    // The type specifier helps compilers that transform modules in isolation (i.e. without type knowledge, such as swc)
    // The `verbatimModulesSyntax` in tsconfig also enables this, but the linting is nice for auto-fixing
    // @see https://main--typescript-eslint.netlify.app/blog/consistent-type-imports-and-exports-why-and-how#benefits-of-enforcing-type-only-importsexports
    "@typescript-eslint/consistent-type-exports": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    // Similar to the comments about import type specifiers, this rule ensures that no side-effects are left behind,
    // in cases like import {type Thing, type OtherThing} from 'lib'
    // ...which gets transformed to import {} from 'lib' unser verbatimModulesSyntax
    // This is different from import type {Thing, OtherThing} from 'lib
    // ...which gets transformed to being blank
    // This behaviour makes sense (sometimes you want to keep side-effects), but can also be unexpected and easy to miss, so better flag it in linting
    // @see https://main--typescript-eslint.netlify.app/blog/consistent-type-imports-and-exports-why-and-how#verbatim-module-syntax
    "@typescript-eslint/no-import-type-side-effects": "error",
    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        checksVoidReturn: {
          // Allow () => void to also be () => Promise<void>
          arguments: false,
          attributes: false,
        },
      },
    ],
  },
};
