// Netlify V2 function wrapper for the Nitro SSR server.
// Nitro (preset: "netlify") builds the server entry to dist/server/main.mjs.
// Netlify's esbuild bundler follows the relative import and inlines all deps.
export { default } from "../../dist/server/main.mjs";
