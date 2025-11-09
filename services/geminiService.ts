import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = "gemini-2.5-flash-preview-tts";

export async function* streamTextToSpeech(text: string, voiceName: string) {
    if (!text.trim()) {
        return;
    }
    
    const response: GenerateContentResponse = await ai.models.generateContent({
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

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
        yield base64Audio;
    } else {
        // This can happen if the text is empty, contains only unsupported characters, or if there's an API issue.
        console.warn("Gemini API did not return any audio data for the provided text chunk.");
    }
}