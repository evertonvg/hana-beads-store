const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "ui",
        "layout",
        "home",
        "shop",
        "product",
        "cart",
        "auth",
        "checkout",
        "payment",
        "account",
        "orders",
        "custom-orders",
        "legal",
        "returns",
        "lgpd",
        "data",
        "deps",
        "tooling",
        "e2e",
        "db",
        "spec",
      ],
    ],
  },
};

export default config;
