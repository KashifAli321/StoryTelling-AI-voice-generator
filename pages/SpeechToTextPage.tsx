import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { blobToBase64 } from '../utils/fileUtils';
import Spinner from '../components/Spinner';

type RecordingStatus = 'idle' | 'recording' | 'processing' | 'error' | 'success';

const SpeechToTextPage: React.FC = () => {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [transcript, setTranscript] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        setStatus('recording');
        setError(null);
        setTranscript('');
        audioChunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = handleStop;
            mediaRecorderRef.current.start();
        } catch (err) {
            console.error(err);
            setError('Microphone access was denied. Please allow microphone permissions in your browser settings.');
            setStatus('error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            // Stop media stream tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setStatus('processing');
        }
    };

    const handleStop = async () => {
        if (audioChunksRef.current.length === 0) {
            setError("No audio was recorded.");
            setStatus('error');
            return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
            const audioBase64 = await blobToBase64(audioBlob);
            const result = await transcribeAudio(audioBase64, audioBlob.type);
            setTranscript(result);
            setStatus('success');
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during transcription.');
            setStatus('error');
        }
    };
    
    const isRecording = status === 'recording';

    return (
        <div className="flex flex-col items-center space-y-8">
            <div className="text-center">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Speech to Text</h1>
                <p className="mt-2 text-md text-gray-400">Record your voice and get a real-time transcription.</p>
            </div>

            <div className="w-full max-w-2xl space-y-6">
                <div className="flex justify-center">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={status === 'processing'}
                        className={`relative flex items-center justify-center h-24 w-24 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105
                            ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                            disabled:opacity-50 disabled:cursor-not-allowed`}
                        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                        {isRecording && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                        <span className="material-symbols-outlined text-5xl text-white">
                            {isRecording ? 'stop_circle' : 'mic'}
                        </span>
                    </button>
                </div>
                 <div className="text-center text-lg font-semibold">
                    {status === 'idle' && "Press the button to start recording"}
                    {status === 'recording' && "Recording..."}
                    {status === 'processing' && "Processing audio..."}
                    {status === 'success' && "Transcription complete"}
                    {status === 'error' && "An error occurred"}
                </div>

                {status === 'processing' && (
                    <div className="flex justify-center">
                        <Spinner />
                    </div>
                )}
                
                {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}
                
                {transcript && (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-2">Transcript:</h3>
                        <p className="text-gray-300 whitespace-pre-wrap">{transcript}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpeechToTextPage;
