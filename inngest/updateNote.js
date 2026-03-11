import generateStyledHTML from "./utils/html.js";
import noteEventEmitter from "../utils/eventEmitter.js";
import Note from "../models/note.model.js";
import Quiz from "../models/quiz.model.js";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


/**
 * Advanced multi-step agent function to update a note based on user instructions.
 * Acts as a senior editor that can add, remove, or restructure.
 * 
 * @param {Object} params
 * @param {Object} params.input - { instruction, currentHtml }
 * @param {Object} params.ctx - Inngest context including onboardingData
 */
export async function updateNote({ input, ctx }) {
    const { instruction, currentHtml } = input;
    const { onboardingData, userId } = ctx;
    const userClass = onboardingData?.userClass || "general learner";

    const emitProgress = (message) => {
        if (userId) {
            noteEventEmitter.emit('progress', { userId, message });
        }
    };

    if (!currentHtml) {
        throw new Error("Cannot update: existing note content is empty.");
    }

    // ✔ STEP 1 — Agentic Analysis
    const plan = await ctx.step.run("analyze-update", async () => {
        emitProgress("Processing your instructions and auditing the note content...");

        const prompt = `
      You are an expert educational editor. 
      Target User Context: ${userClass}.
      User Instruction: "${instruction}"
      
      Review the current note:
      ${currentHtml.substring(0, 1500)}...
      
      TASKS:
      1. Determine if the user wants to remove sections or content.
      2. Determine if the user wants to add or change content/complexity.
      3. Create a JSON plan:
      {
        "intent": "restructure" | "tone_change" | "add_content" | "general",
        "shouldRegenerateContent": boolean,
        "reasoning": "string"
      }
    `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const res = response.choices[0].message.content;

        try {
            return JSON.parse(res);
        } catch (e) {
            return { intent: "general", shouldRegenerateContent: true, reasoning: "General instruction detected." };
        }
    });

    // ✔ STEP 2 — Processing the Logic (Agent Selection)
    let updatedContent = currentHtml;

    // Logic: Handle Removals (Legacy placeholders)
    updatedContent = updatedContent.replace(/\[IMAGE_\d+\]/g, "");
    updatedContent = updatedContent.replace(/<div style="text-align: center; margin: 25px 0;[\s\S]*?<\/div>/g, "");
    updatedContent = updatedContent.replace(/\[VIDEO_\d+\]/g, "");
    updatedContent = updatedContent.replace(/<div style="margin: 30px 0; border: 1px solid #e0e0e0;[\s\S]*?<\/div>/g, "");

    // Logic: Handle Additions / Changes
    if (plan.shouldRegenerateContent) {
        updatedContent = await ctx.step.run("edit-text", async () => {
            emitProgress(`Rewriting sections for ${userClass} level...`);

            const res = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user", content: `
          Modify the following educational HTML content based on this instruction: "${instruction}".
          Target Level: ${userClass}.
          
          RULES:
          - Focus ONLY on the text content and structure.
          - If restructuring, ensure the flow is logical for a ${userClass}.
          - Return ONLY the updated HTML partial.
          
          CONTENT:
          ${updatedContent}
        ` }],
            });
            return res.choices[0].message.content;
        });
    }

    // ✔ STEP 2 — Final Render
    const finalHtml = await ctx.step.run("finalize-edit", async () => {
        emitProgress("Finishing the final polish...");

        return generateStyledHTML({
            content: updatedContent,
        });
    });

    // ✔ STEP 2.5 — Generate/Update Tag
    const tag = await ctx.step.run("generate-tag", async () => {
        emitProgress("Updating category...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
                role: "user",
                content: `Based on this updated content, provide a 1-2 word educational category or subject tag (e.g., "Physics", "World History", "Organic Chemistry"). Return ONLY the tag text.\n\nCONTENT:\n${updatedContent.substring(0, 500)}`
            }],
        });
        return response.choices[0].message.content.trim() || "General";
    });

    // ✔ STEP 3 — Generate Quiz
    const quiz = await ctx.step.run("generate-quiz", async () => {
        emitProgress("Re-generating quiz for you based on the changes...");

        const prompt = `
      Based on the following updated educational content, generate 10 multiple-choice questions.
      Each question should have 4 options, 1 correct answer, and a clear explanation for the correct answer.
      
      Format the response as a JSON array of objects:
      [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctAnswer": "string",
          "explanation": "string"
        }
      ]
      
      CONTENT:
      ${updatedContent.substring(0, 2000)}
    `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const res = response.choices[0].message.content;

        try {
            const quizData = JSON.parse(res.replace(/```json|```/g, "").trim());

            const noteId = input.noteId || ctx.noteId;

            // Save or Update quiz in database
            if (userId && quizData.length > 0 && noteId) {
                // For updates, we can either create a new quiz or update the existing one linked to the note.
                // To keep it simple and consistent with createNote, let's create a new one and update the note reference.
                const newQuiz = await Quiz.create({
                    userId,
                    noteTitle: instruction.substring(0, 50),
                    noteId: noteId,
                    questions: quizData
                });

                // Update note with new quizId and tag
                await Note.findByIdAndUpdate(noteId, {
                    quizId: newQuiz._id,
                    content: finalHtml,
                    tag: tag
                });
            }

            return quizData;
        } catch (e) {
            console.error("Failed to parse or save quiz JSON:", e);
            return [];
        }
    });

    emitProgress("Edit complete!");

    return {
        status: "updated",
        html: finalHtml,
        message: "I have updated the note you requested. What would you love for me to do next?",
        quiz,
        plan: plan.reasoning,
        suggestions: [
            "Should I explain any part in simpler terms?",
            "Add more detail to the new sections?",
            "Create a study schedule based on this note?"
        ]
    };
}
