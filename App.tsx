import React, { useState, useRef, useCallback, useEffect } from 'react';
import { streamTextToSpeech } from './services/geminiService';
import { decode, decodeAudioData, createWavBlob } from './utils/audioUtils';
import { chunkText } from './utils/textUtils';
import { getFriendlyErrorMessage } from './utils/errorUtils';
import Spinner from './components/Spinner';
import { STORY_TEXT, VOICES } from './constants';

type Status = 'idle' | 'generating' | 'ready' | 'playing' | 'error';

const LOCAL_STORAGE_KEY = 'storyteller-ai-story';

const StatusIndicator: React.FC<{ status: Status; error: string | null }> = ({ status, error }) => {
  let statusText = '';
  let bgColor = 'bg-gray-600';

  switch (status) {
    case 'idle':
      statusText = 'Ready';
      bgColor = 'bg-blue-500';
      break;
    case 'generating':
      statusText = 'Generating Audio...';
      bgColor = 'bg-yellow-500 animate-pulse';
      break;
    case 'ready':
      statusText = 'Audio Ready';
      bgColor = 'bg-green-500';
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
            {statusText}
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

const App: React.FC = () => {
  const [story, setStory] = useState<string>(() => {
    try {
      const savedStory = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return savedStory ? savedStory : STORY_TEXT;
    } catch (error) {
      console.warn("Could not read story from local storage:", error);
      return STORY_TEXT;
    }
  });
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0]);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const allAudioBytesRef = useRef<Uint8Array[]>([]);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, story);
    } catch (error) {
      console.warn("Could not save story to local storage:", error);
    }
  }, [story]);

  useEffect(() => {
    if (audioSourceRef.current) {
        audioSourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate]);

  const handleReset = useCallback(() => {
    isCancelledRef.current = true;
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        console.warn("Could not stop audio source, it may have already finished.", e);
      }
    }
    audioSourceRef.current = null;
    audioBufferRef.current = null;
    allAudioBytesRef.current = [];
    setStatus('idle');
  }, []);

  const handleGenerate = async () => {
    if (status === 'generating') return;
    handleReset();
    isCancelledRef.current = false;
    
    setStatus('generating');
    setError(null);
    
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    
    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    try {
      const textChunks = chunkText(story);
      if (textChunks.length === 0) {
        throw new Error("Input text is empty.");
      }
      
      for (const textChunk of textChunks) {
        if (isCancelledRef.current) break;
        
        for await (const base64Audio of streamTextToSpeech(textChunk, selectedVoice)) {
          if (isCancelledRef.current) break;
          const audioBytes = decode(base64Audio);
          allAudioBytesRef.current.push(audioBytes);
        }
      }
      
      if (isCancelledRef.current) {
        handleReset();
        return;
      }

      if (allAudioBytesRef.current.length === 0) {
        throw new Error("No audio data was generated. The text might be empty or contain only unsupported characters.");
      }
      
      setStatus('ready');

    } catch (err) {
      console.error("Audio Generation Error:", err);
      const friendlyMessage = getFriendlyErrorMessage(err);
      setError(`Failed to generate audio. ${friendlyMessage}`);
      setStatus('error');
      handleReset();
    }
  };

  const handlePlay = async () => {
    const audioContext = audioContextRef.current;
    if (!audioContext || status !== 'ready') return;
    
    setStatus('playing');

    try {
      if (!audioBufferRef.current) {
        let totalLength = 0;
        allAudioBytesRef.current.forEach(arr => { totalLength += arr.length; });
        const concatenatedData = new Uint8Array(totalLength);
        let offset = 0;
        allAudioBytesRef.current.forEach(arr => {
            concatenatedData.set(arr, offset);
            offset += arr.length;
        });
        audioBufferRef.current = await decodeAudioData(concatenatedData, audioContext, 24000, 1);
      }
  
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContext.destination);
      source.playbackRate.value = playbackRate;
      source.onended = () => {
        if (audioSourceRef.current === source) {
            audioSourceRef.current = null;
            setStatus('ready');
        }
      };
      source.start(0);
      audioSourceRef.current = source;
    } catch (err) {
        console.error("Playback Error:", err);
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(`Failed to play audio. ${friendlyMessage}`);
        setStatus('error');
        handleReset();
    }
  };

  const handleStop = () => {
    if (audioSourceRef.current) {
        audioSourceRef.current.onended = null; // Prevent onended from firing
        try { audioSourceRef.current.stop(); } catch(e) {}
        audioSourceRef.current = null;
    }
    setStatus('ready');
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setStatus('idle');
  };

  const handleDownload = () => {
    if (allAudioBytesRef.current.length === 0) {
      setError("No audio data available to download.");
      setStatus('error');
      return;
    }

    try {
      let totalLength = 0;
      allAudioBytesRef.current.forEach(arr => {
        totalLength += arr.length;
      });
      const concatenatedData = new Uint8Array(totalLength);
      let offset = 0;
      allAudioBytesRef.current.forEach(arr => {
        concatenatedData.set(arr, offset);
        offset += arr.length;
      });

      const wavBlob = createWavBlob(concatenatedData, 24000, 1, 16);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'storyteller-ai-audio.wav';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (downloadError) {
      console.error("Download Error:", downloadError);
      const friendlyMessage = getFriendlyErrorMessage(downloadError);
      setError(`Failed to create download file. ${friendlyMessage}`);
      setStatus('error');
    }
  };

  const isBusy = status === 'generating' || status === 'playing' || status === 'ready';
  const canDownload = status === 'ready' || status === 'playing';

  let mainButton;
  if (status === 'idle' || status === 'error') {
    mainButton = (
      <button
        onClick={handleGenerate}
        className="px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white"
      >
        Generate Audio
      </button>
    );
  } else if (status === 'generating') {
    mainButton = (
      <button
        onClick={handleCancel}
        className="px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-red-600 hover:bg-red-700 text-white"
      >
        Cancel
      </button>
    );
  } else if (status === 'ready') {
    mainButton = (
      <button
        onClick={handlePlay}
        className="px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white"
      >
        Play
      </button>
    );
  } else { // playing
    mainButton = (
      <button
        onClick={handleStop}
        className="px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-red-600 hover:bg-red-700 text-white"
      >
        Stop
      </button>
    );
  }

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
          <StatusIndicator status={status} error={error} />
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-4">
            <div>
              <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-2">
                Choose a Narrator's Voice
              </label>
              <select
                id="voice-select"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={isBusy}
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 disabled:opacity-50"
              >
                {VOICES.map((voice) => (
                  <option key={voice} value={voice}>{voice}</option>
                ))}
              </select>
            </div>
             <div>
                <label htmlFor="speed-control" className="block text-sm font-medium text-gray-300 mb-2">
                    Playback Speed: <span className="font-bold text-blue-400">{playbackRate.toFixed(2)}x</span>
                </label>
                <input
                    id="speed-control"
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.25"
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    disabled={status === 'generating'}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>
            <div>
              <label htmlFor="story-text" className="block text-sm font-medium text-gray-300 mb-2">
                Story Text
              </label>
              <textarea
                id="story-text"
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Enter the story you want to hear..."
                className="w-full h-64 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y disabled:opacity-50"
                disabled={isBusy}
              />
            </div>
          </div>
          
          <div className="flex justify-center items-center space-x-4">
            {mainButton}
             <button
                onClick={handleDownload}
                disabled={!canDownload}
                className="px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-purple-500 to-indigo-400 hover:from-purple-600 hover:to-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-600 disabled:to-gray-700 disabled:hover:scale-100"
              >
                Download Audio
              </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;