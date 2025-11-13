// @ts-nocheck
import {
    GoogleGenAI,
    Modality,
    Chat,
    GroundingChunk,
    GenerateVideosOperation,
    LiveSession,
    LiveServerMessage
} from "@google/genai";

/**
 * Formats API errors into a user-friendly string.
 * It specifically looks for JSON-formatted error messages from the SDK
 * and provides clearer feedback for common issues like 503 Service Unavailable.
 * @param error The error object caught from an API call.
 * @returns A user-friendly error message string.
 */
function formatApiError(error: unknown): string {
    const genericMessage = "An unexpected error occurred. Please check the console for details.";
    if (error instanceof Error) {
        // The Gemini SDK sometimes returns a JSON string in the error message
        try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.error) {
                const { code, message, status } = parsedError.error;
                if (code === 503 || status === "UNAVAILABLE") {
                    return `The service is currently unavailable. This is usually a temporary issue. Please try again in a few moments.`;
                }
                return message || genericMessage;
            }
        } catch (e) {
            // If parsing fails, it's not the JSON error we expected. Fallback to the original message.
            return error.message;
        }
        return error.message;
    }
    return genericMessage;
}

/**
 * Checks if an error from the API is a transient, retryable error (like 503).
 * @param error The error object to check.
 * @returns True if the error is retryable, otherwise false.
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        try {
            const parsedError = JSON.parse(error.message);
            if (parsedError.error) {
                const { code, status } = parsedError.error;
                return code === 503 || status === "UNAVAILABLE";
            }
        } catch (e) {
            // Not a JSON error, so not the specific retryable error we're looking for.
            return false;
        }
    }
    return false;
}


/**
 * Creates a new GoogleGenAI instance.
 * This function is called before every API request to ensure the most up-to-date
 * API key from the environment is used.
 * @throws {Error} if the API_KEY environment variable is not set.
 */
const createAiInstance = () => {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

// === TEXT TO SPEECH ===
export async function generateSpeech(
    text: string, 
    voice: string, 
    onAudioChunk: (base64AudioChunk: string) => void,
    onRetryAttempt: (attempt: number, maxRetries: number, delay: number) => void
): Promise<void> {
    const MAX_RETRIES = 3;
    const INITIAL_DELAY = 1000; // 1 second

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const ai = createAiInstance();
            const responseStream = await ai.models.generateContentStream({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voice },
                        },
                    },
                },
            });

            for await (const chunk of responseStream) {
                const base64Audio = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (base64Audio) {
                    onAudioChunk(base64Audio);
                }
            }
            return; // Success, exit the function
        } catch (error) {
            if (isRetryableError(error) && attempt < MAX_RETRIES) {
                const delay = INITIAL_DELAY * Math.pow(2, attempt);
                onRetryAttempt(attempt + 1, MAX_RETRIES, delay);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`Error in generateSpeech stream after ${attempt} attempts:`, error);
                throw new Error(`Failed to generate speech: ${formatApiError(error)}`);
            }
        }
    }
}


// === IMAGE GENERATION ===
export async function generateImage(prompt: string, aspectRatio: string): Promise<string> {
    try {
        const ai = createAiInstance();
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio,
            },
        });
        const base64ImageBytes: string | undefined = response.generatedImages?.[0]?.image.imageBytes;
        if (!base64ImageBytes) {
            throw new Error("API did not return image data. The prompt may have been blocked.");
        }
        return base64ImageBytes;
    } catch (error) {
        console.error("Error in generateImage:", error);
        throw new Error(`Failed to generate image: ${formatApiError(error)}`);
    }
}

// === LIVE CONVERSATION ===
interface LiveConnectCallbacks {
    onopen?: () => void;
    onmessage?: (message: LiveServerMessage) => void;
    onerror?: (e: ErrorEvent) => void;
    onclose?: (e: CloseEvent) => void;
}

export async function connectLive(callbacks: LiveConnectCallbacks): Promise<LiveSession> {
    try {
        const ai = createAiInstance();
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks,
            config: {
                responseModalities: [Modality.AUDIO],
                outputAudioTranscription: {},
                inputAudioTranscription: {},
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                },
            },
        });
        return sessionPromise;
    } catch (error) {
        console.error("Error in connectLive:", error);
        throw new Error(`Failed to connect to live session: ${formatApiError(error)}`);
    }
}

// === CHATBOT ===
export function createChatSession(): Chat {
    const ai = createAiInstance();
    const chat: Chat = ai.chats.create({
        model: 'gemini-2.5-flash',
    });
    return chat;
}

// === SPEECH TO TEXT ===
export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    try {
        const ai = createAiInstance();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: audioBase64,
                            mimeType: mimeType,
                        },
                    },
                    { text: "Transcribe this audio." },
                ],
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error in transcribeAudio:", error);
        throw new Error(`Failed to transcribe audio: ${formatApiError(error)}`);
    }
}

// === IMAGE ANALYSIS ===
export async function analyzeImage(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
    try {
        const ai = createAiInstance();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: imageBase64, mimeType } },
                    { text: prompt },
                ],
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error in analyzeImage:", error);
        throw new Error(`Failed to analyze image: ${formatApiError(error)}`);
    }
}

// === SEARCH GROUNDING ===
export async function groundedSearch(prompt: string): Promise<{ text: string, sources: GroundingChunk[] }> {
    try {
        const ai = createAiInstance();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        const text = response.text;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        return { text, sources };
    } catch (error) {
        console.error("Error in groundedSearch:", error);
        throw new Error(`Failed to perform grounded search: ${formatApiError(error)}`);
    }
}

// === MAPS GROUNDING ===
type Location = { latitude: number, longitude: number };

export async function groundedMaps(prompt: string, location: Location): Promise<{ text: string, sources: GroundingChunk[] }> {
    try {
        const ai = createAiInstance();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: {
                        latLng: {
                            latitude: location.latitude,
                            longitude: location.longitude
                        }
                    }
                }
            },
        });
        const text = response.text;
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        return { text, sources };
    } catch (error) {
        console.error("Error in groundedMaps:", error);
        throw new Error(`Failed to perform maps search: ${formatApiError(error)}`);
    }
}

// === COMPLEX REASONING ===
export async function complexReasoning(prompt: string): Promise<string> {
    try {
        const ai = createAiInstance();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error in complexReasoning:", error);
        throw new Error(`Failed to process complex reasoning prompt: ${formatApiError(error)}`);
    }
}

// === VIDEO GENERATION ===
export async function generateVideo(prompt: string, aspectRatio: string): Promise<GenerateVideosOperation> {
    try {
        const ai = createAiInstance();
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio
            }
        });
        return operation;
    } catch (error) {
        console.error("Error in generateVideo:", error);
        throw new Error(`Failed to start video generation: ${formatApiError(error)}`);
    }
}

export async function getVideosOperation(operation: GenerateVideosOperation): Promise<GenerateVideosOperation> {
    try {
        const ai = createAiInstance();
        const updatedOperation = await ai.operations.getVideosOperation({ operation: operation });
        return updatedOperation;
    } catch (error) {
        console.error("Error in getVideosOperation:", error);
        throw new Error(`Failed to get video operation status: ${formatApiError(error)}`);
    }
}

// === IMAGE EDITING ===
export async function editImage(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
    try {
        const ai = createAiInstance();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: imageBase64, mimeType } },
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData?.data) {
            return imagePart.inlineData.data;
        }

        throw new Error("API did not return an edited image. The prompt may have been blocked.");
    } catch (error) {
        console.error("Error in editImage:", error);
        throw new Error(`Failed to edit image: ${formatApiError(error)}`);
    }
}