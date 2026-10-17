import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  ...next,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
