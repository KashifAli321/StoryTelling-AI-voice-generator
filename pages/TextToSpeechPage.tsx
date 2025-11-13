import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData, audioBufferToWav, concatenateAudioBuffers } from '../utils/audioUtils';
import Spinner from '../components/Spinner';
import { VOICES } from '../constants';

/**
 * Splits a long string of text into smaller chunks without breaking words or sentences.
 * @param text The full text to chunk.
 * @param maxLength The maximum length of each chunk.
 * @returns An array of text chunks.
 */
function chunkText(text: string, maxLength = 4500): string[] {
    const chunks: string[] = [];
    if (!text) {
        return [];
    }
    let remainingText = text.trim();

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        let chunkSlice = remainingText.substring(0, maxLength);
        let splitIndex = -1;

        const sentenceEndings = ['.', '!', '?', '\n'];
        let lastPunctuationIndex = -1;
        sentenceEndings.forEach(p => {
            lastPunctuationIndex = Math.max(lastPunctuationIndex, chunkSlice.lastIndexOf(p));
        });

        if (lastPunctuationIndex > -1) {
            splitIndex = lastPunctuationIndex + 1;
        } else {
            const lastSpaceIndex = chunkSlice.lastIndexOf(' ');
            if (lastSpaceIndex > -1) {
                splitIndex = lastSpaceIndex + 1;
            }
        }

        if (splitIndex === -1) {
            splitIndex = maxLength;
        }

        chunks.push(remainingText.substring(0, splitIndex).trim());
        remainingText = remainingText.substring(splitIndex).trim();
    }

    return chunks.filter(chunk => chunk.length > 0);
}


const TextToSpeechPage: React.FC = () => {
    const [text, setText] = useState<string>("Hello! I am Gemini. I can convert text into natural-sounding speech. Try typing something and I'll read it for you.");
    const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        return () => {
            // Clean up AudioContext and URL object on component unmount
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);


    const handleGenerateSpeech = async () => {
        if (!text.trim()) {
            setError('Please enter some text.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setProgressMessage('Preparing to generate...');
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }

        const allFinalBuffers: AudioBuffer[] = [];

        try {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            // Ensure context is running, especially after being suspended by the browser
            if (audioContextRef.current.state === 'suspended') {
                 await audioContextRef.current.resume();
            }
            const audioContext = audioContextRef.current;
            
            const textChunks = chunkText(text);

            const handleRetry = (attempt: number, maxRetries: number, delay: number) => {
                setProgressMessage(`Service is unavailable. Retrying in ${delay / 1000}s... (Attempt ${attempt} of ${maxRetries})`);
            };
            
            for (let i = 0; i < textChunks.length; i++) {
                const chunk = textChunks[i];
                setProgressMessage(`Generating audio for chunk ${i + 1} of ${textChunks.length}...`);
                
                const collectedBuffersForChunk: AudioBuffer[] = [];
                const handleAudioChunk = async (base64AudioChunk: string) => {
                    const audioBufferChunk = await decodeAudioData(decode(base64AudioChunk), audioContext, 24000, 1);
                    collectedBuffersForChunk.push(audioBufferChunk);
                };

                await generateSpeech(chunk, selectedVoice, handleAudioChunk, handleRetry);

                if (collectedBuffersForChunk.length > 0) {
                    const chunkAudioBuffer = concatenateAudioBuffers(collectedBuffersForChunk, audioContext);
                    allFinalBuffers.push(chunkAudioBuffer);
                }
            }

            if (allFinalBuffers.length > 0) {
                setProgressMessage('Finalizing audio file...');
                const finalAudioBuffer = concatenateAudioBuffers(allFinalBuffers, audioContext);
                const wavBlob = audioBufferToWav(finalAudioBuffer);
                const url = URL.createObjectURL(wavBlob);
                setAudioUrl(url);
            } else {
                throw new Error("API did not return any audio data. The prompt may have been blocked.");
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };

    const handleDownload = () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = 'gemini-speech.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    
    return (
        <div className="flex flex-col items-center space-y-8">
            <div className="text-center">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Text to Speech</h1>
                <p className="mt-2 text-md text-gray-400">Convert your text into high-quality spoken audio with Gemini.</p>
            </div>

            <div className="w-full max-w-2xl space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div>
                    <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">
                        Enter Text
                    </label>
                    <textarea
                        id="prompt-input"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type something here..."
                        className="w-full h-32 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y"
                        disabled={isLoading}
                    />
                </div>
                
                <div>
                    <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-2">
                        Select a Voice
                    </label>
                    <select
                        id="voice-select"
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        disabled={isLoading}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300"
                    >
                        {VOICES.map((voice) => (
                            <option key={voice.name} value={voice.name}>
                                {voice.displayName}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleGenerateSpeech}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isLoading ? <><Spinner size="sm" /> Generating...</> : 'Generate Speech'}
                </button>
                {isLoading && <p className="text-center text-gray-400 pt-4">{progressMessage}</p>}
            </div>
            
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}

            {audioUrl && !isLoading && (
                <div className="w-full max-w-2xl bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-4">
                    <audio controls autoPlay src={audioUrl} className="w-full">
                        Your browser does not support the audio element.
                    </audio>
                    <button
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-full shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 bg-green-600 hover:bg-green-700 text-white"
                    >
                         <span className="material-symbols-outlined">download</span>
                        Download WAV
                    </button>
                </div>
            )}
        </div>
    );
};

export default TextToSpeechPage;