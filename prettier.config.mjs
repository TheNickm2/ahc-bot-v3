import sapphirePrettierConfig from '@sapphire/prettier-config';

/** @type {import("prettier").Config} */
const config = {
  ...sapphirePrettierConfig,
  trailingComma: "all",
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  printWidth: 150,
  useTabs: false,
};

export default config;
