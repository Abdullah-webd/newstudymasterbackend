import { serve } from "inngest/express";
import { inngest, runNoteAgent } from "./routes.js";

// Export serve function for Express
export const inngestServe = serve({
    client: inngest,
    functions: [runNoteAgent],
});
