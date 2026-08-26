import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverModule = require("./server.cjs") as { default?: unknown; app?: unknown };

export default serverModule.default ?? serverModule.app;
