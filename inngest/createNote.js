import generateStyledHTML from "./utils/html.js";
import Quiz from "../models/quiz.model.js";
import Note from "../models/note.model.js";
import Activity from "../models/activity.model.js";
import noteEventEmitter from "../utils/eventEmitter.js";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Enhanced multi-step agent function to create a note
 * @param {Object} params
 * @param {string} params.input - User request
 * @param {Object} params.ctx - Inngest context including onboardingData
 */
export async function createNote({ input, ctx }) {
    const { onboardingData, userId } = ctx;
    const userClass = onboardingData?.userClass || "general learner";

    const emitProgress = (message) => {
        if (userId) {
            noteEventEmitter.emit('progress', { userId, message });
        }
    };

    // ✔ STEP 1 — Analyze
    await ctx.step.run("analyze-request", async () => {
        emitProgress("Analyzing topic and target audience...");
    });

    // ✔ STEP 2 — Generate Base Note
    const baseContent = await ctx.step.run("generate-base-note", async () => {
        emitProgress("Structuring notes and outlining key sections...");

        const prompt = `
      Generate detailed structured study notes on the following topic.
      Topic: "${input}"
      Target Audience: ${userClass}.
      
      Requirements:
      1. Clear title (using <h1>)
      2. Section headings (using <h2>)
      3. Subsections (using <h3>)
      4. Detailed bullet points (<ul>, <li>)
      5. Key concepts explained clearly with technical terms in bold (<strong>)
      6. Important definitions in a separate paragraph or box style
      7. Examples where necessary to illustrate points
      8. Summary section at the end
      
      Tone: Professional, educational, and tailored to a ${userClass} level.
      Format: Return ONLY the structured HTML content. Do NOT include <html> or <body> tags.
    `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });
        return response.choices[0].message.content;
    });

    // ✔ STEP 4 — Convert to styled HTML
    const finalHtml = await ctx.step.run("finalize-html", async () => {
        emitProgress("Formatting HTML structure and applying modern styling...");
        return generateStyledHTML({
            content: baseContent,
        });
    });

    // ✔ STEP 5 — Generate Tag
    const tag = await ctx.step.run("generate-tag", async () => {
        emitProgress("Categorizing your notes...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
                role: "user",
                content: `Based on this content, provide a 1-2 word educational category or subject tag (e.g., "Physics", "World History", "Organic Chemistry"). Return ONLY the tag text.\n\nCONTENT:\n${baseContent.substring(0, 500)}`
            }],
        });
        return response.choices[0].message.content.trim() || "General";
    });

    // ✔ STEP 5 — Save Note to DB (Moved up)
    const noteId = userId ? await ctx.step.run("save-note", async () => {
        emitProgress("Finalizing notes and saving to your library...");
        const note = await Note.create({
            userId,
            title: input.substring(0, 100),
            content: finalHtml,
            tag: tag,
            chatHistory: [
                { role: 'user', message: input },
                { role: 'assistant', message: "I have generated the notes for you." }
            ]
        });
        return note._id;
    }) : null;

    // ✔ STEP 5 — Generate Quiz
    const quiz = await ctx.step.run("generate-quiz", async () => {
        emitProgress("Generating a quick quiz for you...");

        const prompt = `
      Based on the following educational content, generate 10 multiple-choice questions.
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
      ${baseContent.substring(0, 2000)}
    `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const res = response.choices[0].message.content;

        try {
            const quizData = JSON.parse(res.replace(/```json|```/g, "").trim());

            // Save quiz to database
            if (userId && quizData.length > 0) {
                const newQuiz = await Quiz.create({
                    userId,
                    noteTitle: input.substring(0, 50),
                    noteId: noteId,
                    questions: quizData
                });

                // Update note with quizId
                if (noteId) {
                    await Note.findByIdAndUpdate(noteId, { quizId: newQuiz._id });
                }
            }

            return quizData;
        } catch (e) {
            console.error("Failed to parse quiz JSON:", e);
            return [];
        }
    });

    // ✔ STEP 6 — Record Activity
    if (userId) {
        await ctx.step.run("record-activity", async () => {
            await Activity.create({
                userId,
                type: 'note_creation',
                metadata: { noteTitle: input.substring(0, 50) },
                status: 'completed',
                endTime: Date.now(),
                duration: 60 // Estimate/Fixed for creation
            });
        });
    }

    // ✔ STEP 6 — Return
    emitProgress("Your personalized note and quiz are ready!");

    return {
        status: "created",
        html: finalHtml,
        message: "I have generated the notes you requested. They are now available in the Notes View Panel.",
        quiz,
        suggestions: [
            `How would this change for a more advanced student?`,
            `Can you add more details to the process sections?`,
            `Summarize the key takeaways for me.`,
        ],
    };
}
