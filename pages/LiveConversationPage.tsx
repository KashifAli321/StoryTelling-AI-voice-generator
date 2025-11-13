
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { connectLive } from '../services/geminiService';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { LiveServerMessage, LiveSession, Blob as GenaiBlob } from '@google/genai';

type ConversationStatus = 'idle' | 'connecting' | 'active' | 'error';
type TranscriptionEntry = { speaker: 'user' | 'model'; text: string };

const LiveConversationPage: React.FC = () => {
    const [status, setStatus] = useState<ConversationStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<TranscriptionEntry[]>([]);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRefs = useRef<{ input: AudioContext | null; output: AudioContext | null }>({ input: null, output: null });
    const audioStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTimeRef = useRef(0);
    const transcriptionRefs = useRef({ input: '', output: '' });
    
    useEffect(() => {
        return () => {
            // Cleanup on component unmount
            stopConversation();
        };
    }, []);

    const stopConversation = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                session.close();
            }).catch(console.error);
            sessionPromiseRef.current = null;
        }

        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        
        audioContextRefs.current.input?.close();
        audioContextRefs.current.output?.close();
        audioContextRefs.current = { input: null, output: null };

        setStatus('idle');
    }, []);

    const handleMessage = async (message: LiveServerMessage) => {
        // Handle Transcription
        let inputUpdated = false;
        let outputUpdated = false;
        if (message.serverContent?.inputTranscription) {
            transcriptionRefs.current.input += message.serverContent.inputTranscription.text;
            inputUpdated = true;
        }
        if (message.serverContent?.outputTranscription) {
            transcriptionRefs.current.output += message.serverContent.outputTranscription.text;
            outputUpdated = true;
        }

        if (inputUpdated || outputUpdated) {
             setTranscript(prev => {
                const newTranscript = [...prev];
                if (inputUpdated) {
                    const last = newTranscript[newTranscript.length - 1];
                    if (last?.speaker === 'user') {
                        last.text = transcriptionRefs.current.input;
                    } else {
                        newTranscript.push({ speaker: 'user', text: transcriptionRefs.current.input });
                    }
                }
                if (outputUpdated) {
                     const last = newTranscript[newTranscript.length - 1];
                     if (last?.speaker === 'model') {
                        last.text = transcriptionRefs.current.output;
                    } else {
                        newTranscript.push({ speaker: 'model', text: transcriptionRefs.current.output });
                    }
                }
                return newTranscript;
            });
        }
        
        if (message.serverContent?.turnComplete) {
            transcriptionRefs.current = { input: '', output: '' };
        }
        
        // Handle Audio
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && audioContextRefs.current.output) {
            const outputAudioContext = audioContextRefs.current.output;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            audioSourcesRef.current.add(source);
        }

        if (message.serverContent?.interrupted) {
            for (const source of audioSourcesRef.current.values()) {
                source.stop();
                audioSourcesRef.current.delete(source);
            }
            nextStartTimeRef.current = 0;
        }
    };


    const startConversation = async () => {
        setStatus('connecting');
        setError(null);
        setTranscript([]);
        
        try {
            audioContextRefs.current.input = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRefs.current.output = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            sessionPromiseRef.current = connectLive({
                onopen: () => {
                    setStatus('active');
                    const inputAudioContext = audioContextRefs.current.input!;
                    const source = inputAudioContext.createMediaStreamSource(audioStreamRef.current!);
                    scriptProcessorRef.current = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob: GenaiBlob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContext.destination);
                },
                onmessage: handleMessage,
                onerror: (e) => {
                    console.error('Live session error:', e);
                    setError('A connection error occurred.');
                    setStatus('error');
                    stopConversation();
                },
                onclose: () => {
                    console.log('Live session closed.');
                    stopConversation();
                },
            });

            await sessionPromiseRef.current;

        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to start conversation. Please grant microphone permissions. Error: ${message}`);
            setStatus('error');
            stopConversation();
        }
    };

    const isProcessing = status === 'connecting' || status === 'active';

    return (
        <div className="flex flex-col items-center space-y-8">
            <div className="text-center">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Live Conversation</h1>
                <p className="mt-2 text-md text-gray-400">Speak directly with Gemini and get real-time voice responses.</p>
            </div>

            <div className="w-full max-w-2xl space-y-6">
                <div className="flex justify-center">
                    <button
                        onClick={isProcessing ? stopConversation : startConversation}
                        className={`relative flex items-center justify-center h-24 w-24 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105
                            ${isProcessing ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`
                        }
                        aria-label={isProcessing ? 'Stop conversation' : 'Start conversation'}
                    >
                        {status === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                        <span className="material-symbols-outlined text-5xl text-white">
                            {isProcessing ? 'mic_off' : 'mic'}
                        </span>
                    </button>
                </div>
                <div className="text-center text-lg font-semibold">
                    {status === 'idle' && "Press the button to start"}
                    {status === 'connecting' && "Connecting..."}
                    {status === 'active' && "Listening..."}
                    {status === 'error' && "Connection Failed"}
                </div>

                {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}

                <div className="h-96 bg-gray-800 border border-gray-700 rounded-lg p-4 overflow-y-auto space-y-4">
                    {transcript.length === 0 && <p className="text-gray-500 text-center mt-4">Conversation transcript will appear here...</p>}
                    {transcript.map((entry, index) => (
                        <div key={index} className={`flex flex-col ${entry.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-blue-800 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                <p className="text-sm">{entry.text}</p>
                            </div>
                            <span className="text-xs text-gray-500 mt-1 capitalize">{entry.speaker}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveConversationPage;
