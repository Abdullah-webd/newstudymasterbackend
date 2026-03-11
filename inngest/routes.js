import { Inngest } from "inngest";
import { createNote } from "./createNote.js";
import { updateNote } from "./updateNote.js";

// Initialize Inngest client
export const inngest = new Inngest({ id: "study-master-app" });

/**
 * Main orchestration function for the Note Agent
 */
export const runNoteAgent = inngest.createFunction(
    { id: "run-note-agent", name: "Run Note Agent" },
    { event: "api/note.requested" },
    async ({ event, step }) => {
        try {
            const { input, onboardingData } = event.data;
            const userRequest = input.message || input.userRequest;

            if (!userRequest) {
                return {
                    status: "error",
                    message: "No request provided. Please tell me what note you want to create or update.",
                };
            }

            // Agent Logic Branching: Decide whether to create or update
            const decision = await step.run("decide-action", async () => {
                // Enhanced decision logic: check for existing HTML or explicit update intent
                const isUpdate = input.currentHtml || /update|change|modify|fix|edit|remove|add|rewrite|extend/i.test(userRequest);

                if (isUpdate && !input.currentHtml) {
                    // Fallback: If it sounds like an update but no HTML exists, treat as a new creation with extra context
                    return { action: "create" };
                }

                return { action: isUpdate ? "update" : "create" };
            });

            if (decision.action === "error") {
                return { status: "error", message: decision.reason };
            }

            // Execute the chosen agent logic with user context
            const ctx = { step, ai: step.ai, onboardingData, userId: event.data.userId, noteId: input.noteId };

            if (decision.action === "create") {
                return await createNote({ input: userRequest, ctx });
            } else {
                return await updateNote({
                    input: { instruction: userRequest, currentHtml: input.currentHtml, noteId: input.noteId },
                    ctx
                });
            }
        } catch (error) {
            console.error("Inngest Note Agent Error:", error);

            return {
                status: "error",
                message: "A general error occurred while generating notes error",
            };
        }
    }
);

