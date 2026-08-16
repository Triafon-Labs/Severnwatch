// Keeps commit messages parseable by commit-and-tag-version so releases
// get the right semver bump instead of always falling back to patch.
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "docs",
        "chore",
        "style",
        "test",
        "build",
        "ci",
        "revert",
      ],
    ],
  },
};
