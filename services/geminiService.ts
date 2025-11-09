import { GoogleGenAI, Modality } from "@google/genai";

let ai: GoogleGenAI | null = null;
let initializationError: Error | null = null;

// Gracefully handle initialization
try {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
} catch (e) {
    initializationError = e instanceof Error ? e : new Error(String(e));
    console.error("Failed to initialize Gemini Service:", initializationError);
}


const model = "gemini-2.5-flash-preview-tts";

export async function* streamTextToSpeech(text: string, voiceName: string) {
    if (initializationError) {
        throw initializationError;
    }
    if (!ai) {
        // This case should ideally not be reached if initializationError is handled, but as a safeguard:
        throw new Error("Gemini AI client is not initialized.");
    }
    if (!text.trim()) {
        return;
    }
    
    const responseStream = await ai.models.generateContentStream({
        model: model,
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
    });

    let hasYielded = false;
    for await (const chunk of responseStream) {
        const base64Audio = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            hasYielded = true;
            yield base64Audio;
        }
    }

    if (!hasYielded) {
        // This can happen if the text is empty, contains only unsupported characters, or if there's an API issue.
        console.warn("Gemini API did not return any audio data for the provided text chunk.");
    }
}