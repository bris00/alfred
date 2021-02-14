const path = require("path");

module.exports = {
    rootDir: path.join(__dirname, ".."),
    roots: ["<rootDir>/src/"],
    testMatch: ["<rootDir>/src/**/*.test.ts"],
    transform: {
        "^.+\\.tsx?$": "esbuild-jest",
    },
};
