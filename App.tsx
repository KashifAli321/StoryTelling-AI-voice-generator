import React, { useState, useRef, useCallback } from 'react';
import { streamTextToSpeech } from './services/geminiService';
import { decode, decodeAudioData, concatenateAudioBuffers, audioBufferToWav } from './utils/audioUtils';
import Spinner from './components/Spinner';
import { STORY_TEXT, VOICES } from './constants';

type Status = 'idle' | 'generating' | 'playing' | 'error';

type StatusIndicatorProps = {
  status: Status;
  error: string | null;
  progress: { current: number; total: number } | null;
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, progress }) => {
  let statusText = '';
  let bgColor = 'bg-gray-600';
  let progressText = '';

  if (status === 'generating' && progress && progress.total > 0) {
    progressText = `(${progress.current}/${progress.total} paragraphs)`;
  }

  switch (status) {
    case 'idle':
      statusText = 'Ready';
      bgColor = 'bg-blue-500';
      break;
    case 'generating':
      statusText = 'Generating Audio...';
      bgColor = 'bg-yellow-500 animate-pulse';
      break;
    case 'playing':
      statusText = 'Playing...';
      bgColor = 'bg-green-500';
      break;
    case 'error':
      statusText = 'Error';
      bgColor = 'bg-red-500';
      break;
  }

  return (
    <div className="w-full p-4 rounded-lg bg-gray-800 border border-gray-700 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 text-sm font-semibold text-white rounded-full ${bgColor}`}>
            {statusText} {progressText}
          </span>
          {status === 'generating' && <Spinner />}
        </div>
      </div>
      {status === 'error' && error && (
        <p className="mt-3 text-sm text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>
      )}
    </div>
  );
};

const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 inline-block" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const processChunkWithRetries = async (
    chunkText: string,
    selectedVoice: string,
    audioContext: AudioContext,
    originalIndex: number,
    maxRetries: number = 3
  ) => {
    let lastError: Error | null = null;
    let delay = 1000; // start with 1 second delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!chunkText.trim()) {
          return { buffer: null, index: originalIndex };
        }
        for await (const base64Audio of streamTextToSpeech(chunkText, selectedVoice)) {
           if (base64Audio) {
             const audioBytes = decode(base64Audio);
             const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
             return { buffer: audioBuffer, index: originalIndex }; // Success
           }
        }
        return { buffer: null, index: originalIndex }; // No audio yielded, but no error
      } catch (err) {
        lastError = err as Error;
        console.warn(`Attempt ${attempt} for paragraph ${originalIndex + 1} failed:`, lastError.message);
        if (attempt < maxRetries) {
          console.log(`Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    }
    // If all retries failed, throw an error to be caught by the main handler.
    console.error(`All ${maxRetries} attempts failed for paragraph ${originalIndex + 1}.`);
    throw new Error(`Failed on paragraph ${originalIndex + 1} after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown'}`);
};


const App: React.FC = () => {
  const [story, setStory] = useState<string>(STORY_TEXT);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0]);
  const [pitch, setPitch] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [downloadableAudio, setDownloadableAudio] = useState<Blob | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const generationCancelledRef = useRef(false);

  const stopPlayback = useCallback(() => {
    generationCancelledRef.current = true;
    if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {
          console.warn("Could not stop audio source, it may have already finished.", e);
        }
        audioSourceRef.current = null;
    }
    setDownloadableAudio(null);
    if (status === 'playing' || status === 'generating') {
      setStatus('idle');
      setProgress(null);
    }
  }, [status]);

  const handleDownload = () => {
    if (!downloadableAudio) return;
    const url = URL.createObjectURL(downloadableAudio);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'storyteller-ai-audio.wav';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleGenerateAndPlay = async () => {
    if (status === 'generating' || status === 'playing') {
      stopPlayback();
      return;
    }

    generationCancelledRef.current = false;
    setStatus('generating');
    setError(null);
    setDownloadableAudio(null);
    setProgress(null);

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    
    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    try {
      const chunks = story.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 0);
      if (chunks.length === 0 && story.trim().length > 0) {
        chunks.push(story);
      }
      setProgress({ current: 0, total: chunks.length });

      const CONCURRENCY_LIMIT = 8;
      const generatedAudioData = new Array(chunks.length);

      for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
        if (generationCancelledRef.current) break;

        const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
        
        const promises = batch.map((chunkText, batchIndex) => {
          const originalIndex = i + batchIndex;
          if (generationCancelledRef.current) {
            return Promise.resolve({ buffer: null, index: originalIndex });
          }
          return processChunkWithRetries(chunkText, selectedVoice, audioContext, originalIndex);
        });
        
        const results = await Promise.all(promises);

        results.forEach(result => {
          if (result && result.buffer) {
            generatedAudioData[result.index] = result.buffer;
          }
        });
        
        setProgress({ current: Math.min(i + CONCURRENCY_LIMIT, chunks.length), total: chunks.length });
      }

      if (generationCancelledRef.current) {
        setStatus('idle');
        setProgress(null);
        return;
      }
      
      const allAudioBuffers = generatedAudioData.filter(Boolean) as AudioBuffer[];

      if (allAudioBuffers.length === 0) {
          throw new Error("No audio data was generated. The API might have returned an empty response for the provided text.");
      }

      const concatenatedBuffer = concatenateAudioBuffers(allAudioBuffers, audioContext);
      const wavBlob = audioBufferToWav(concatenatedBuffer);
      setDownloadableAudio(wavBlob);
      
      setProgress(null);
      setStatus('playing');

      const source = audioContext.createBufferSource();
      source.buffer = concatenatedBuffer;
      
      source.playbackRate.value = speed;
      source.detune.value = pitch * 600;

      source.connect(audioContext.destination);
      source.start(audioContext.currentTime);
      audioSourceRef.current = source;

      source.onended = () => {
        if (audioSourceRef.current === source) {
            setStatus('idle');
            audioSourceRef.current = null;
        }
      };

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate audio. ${errorMessage}`);
      setStatus('error');
      setDownloadableAudio(null);
      setProgress(null);
    }
  };

  const isProcessing = status === 'generating' || status === 'playing';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            Storyteller AI
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Bringing stories to life with Gemini's text-to-speech.
          </p>
        </header>

        <main className="space-y-6">
          <StatusIndicator status={status} error={error} progress={progress} />
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-2 border-b border-gray-700 pb-2">Voice Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-2">
                    Narrator
                  </label>
                  <select
                    id="voice-select"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    disabled={isProcessing}
                    className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300"
                  >
                    {VOICES.map((voice) => (
                      <option key={voice} value={voice}>{voice}</option>
                    ))}
                  </select>
                </div>
            </div>
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label htmlFor="pitch-slider" className="block text-sm font-medium text-gray-300">
                        Pitch
                    </label>
                    <span className="text-sm font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded">{pitch.toFixed(1)}</span>
                </div>
                <input
                    id="pitch-slider"
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label htmlFor="speed-slider" className="block text-sm font-medium text-gray-300">
                        Speed
                    </label>
                    <span className="text-sm font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded">{speed.toFixed(1)}x</span>
                </div>
                <input
                    id="speed-slider"
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
              <label htmlFor="story-text" className="block text-sm font-medium text-gray-300 mb-2">
                Story Text
              </label>
              <textarea
                id="story-text"
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Enter the story you want to hear..."
                className="w-full h-64 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y"
                disabled={isProcessing}
              />
          </div>
          
          <div className="flex justify-center items-center gap-4">
            <button
              onClick={handleGenerateAndPlay}
              className={`px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105
                ${isProcessing 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white'
                }
                ${status === 'generating' ? 'cursor-pointer' : 'cursor-pointer'}
              `}
            >
              {isProcessing ? 'Stop' : 'Generate & Play'}
            </button>
            <button
              onClick={handleDownload}
              disabled={!downloadableAudio || status === 'generating'}
              className={`flex items-center px-6 py-3 font-semibold rounded-full shadow-md transition-all duration-300 ease-in-out transform hover:scale-105
                ${!downloadableAudio || status === 'generating'
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                }
              `}
              aria-label="Download generated audio"
            >
              <DownloadIcon />
              Download
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;