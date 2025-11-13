import React, { useState, useEffect, useRef } from 'react';
import { generateVideo, getVideosOperation } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { GenerateVideosOperation } from '@google/genai';

const POLLING_INTERVAL = 10000; // 10 seconds

const VideoGenerationPage: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('A majestic cinematic shot of a futuristic city with flying cars.');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isKeySelected, setIsKeySelected] = useState<boolean>(false);

  const pollingRef = useRef<number | null>(null);
  
  const checkApiKey = async () => {
    try {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setIsKeySelected(hasKey);
    } catch (e) {
      console.error("aistudio.hasSelectedApiKey not available.", e);
      setIsKeySelected(true); // Assume true if the check fails to not block the user.
    }
  };

  useEffect(() => {
    checkApiKey();
    // Cleanup polling on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleSelectKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      // Assume success and update UI immediately to avoid race conditions.
      setIsKeySelected(true); 
    } catch (e) {
      setError("Could not open API key selection dialog.");
      console.error(e);
    }
  };

  const pollOperation = async (operation: GenerateVideosOperation) => {
    if (!operation) return;

    pollingRef.current = window.setInterval(async () => {
      try {
        setLoadingMessage('Checking video status...');
        const updatedOperation = await getVideosOperation(operation);

        if (updatedOperation.done) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          const uri = updatedOperation.response?.generatedVideos?.[0]?.video?.uri;
          if (uri) {
            const apiKey = process.env.API_KEY;
            setVideoUrl(`${uri}&key=${apiKey}`);
            setLoadingMessage('Video is ready!');
          } else {
             setError("Video generation finished but no video URI was found.");
          }
          setIsLoading(false);
        } else {
            setLoadingMessage('Video is still processing. This can take a few minutes...');
        }
      } catch (err) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to check video status.');
        setIsLoading(false);
      }
    }, POLLING_INTERVAL);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    
    await checkApiKey();
    if (!isKeySelected) {
        setError("Please select an API key to generate videos.");
        return;
    }

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    setLoadingMessage('Starting video generation...');
    
    try {
      const initialOperation = await generateVideo(prompt, aspectRatio);
      if (initialOperation.done) {
          const uri = initialOperation.response?.generatedVideos?.[0]?.video?.uri;
          if (uri) {
            const apiKey = process.env.API_KEY;
            setVideoUrl(`${uri}&key=${apiKey}`);
          } else {
             setError("Video generation finished immediately but no video URI was found.");
          }
          setIsLoading(false);
      } else {
        setLoadingMessage('Generation started. Polling for results...');
        pollOperation(initialOperation);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      if (errorMessage.includes("API key not found")) {
        setIsKeySelected(false);
      }
      setIsLoading(false);
    }
  };

  if (!isKeySelected) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-20">
            <span className="material-symbols-outlined text-8xl text-yellow-500">key</span>
            <h1 className="mt-4 text-3xl font-bold text-gray-100">API Key Required for Veo</h1>
            <p className="mt-2 text-lg text-gray-400 max-w-lg">
                Video generation with Veo requires you to select your own API key. This helps manage resource usage for this powerful feature.
                Please ensure your project has billing enabled. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-blue-400 hover:underline">Learn more</a>.
            </p>
            <button
                onClick={handleSelectKey}
                className="mt-6 px-6 py-3 font-semibold rounded-full shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white"
            >
                Select API Key
            </button>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-8">
        <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Video Generation with Veo</h1>
            <p className="mt-2 text-md text-gray-400">Create short videos from a text description.</p>
        </div>

        <div className="w-full max-w-2xl space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div>
                <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">Prompt</label>
                <textarea id="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                    className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y"
                    disabled={isLoading}/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                <div className="flex flex-wrap gap-2">
                    {["16:9", "9:16"].map((ratio) => (
                        <button key={ratio} onClick={() => setAspectRatio(ratio)} disabled={isLoading}
                            className={`px-4 py-2 text-sm font-semibold rounded-full shadow-md transition-all duration-200 ease-in-out
                                ${aspectRatio === ratio ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}
                                disabled:opacity-50 disabled:cursor-not-allowed`}>
                            {ratio}
                        </button>
                    ))}
                </div>
            </div>
            <button onClick={handleGenerate} disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                {isLoading ? <><Spinner size="sm" /> Generating...</> : 'Generate Video'}
            </button>
        </div>
        
        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}

        <div className="w-full max-w-2xl">
            {isLoading && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg">
                    <Spinner size="lg" />
                    <p className="mt-4 text-gray-400">{loadingMessage}</p>
                </div>
            )}
            {videoUrl && (
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <video src={videoUrl} controls autoPlay loop className="rounded-md w-full h-auto" />
                </div>
            )}
        </div>
    </div>
  );
};

export default VideoGenerationPage;
