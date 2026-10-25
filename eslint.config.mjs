import base from "@chrisgriffin/config/eslint"
import globals from "globals"

export default [
  ...base,
  {
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.jest },
    },
  },
]
