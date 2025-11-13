
import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import Spinner from '../components/Spinner';

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

const ImageGenerationPage: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('A photorealistic image of a futuristic city skyline at dusk, with flying vehicles and neon lights.');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    try {
      const base64Image = await generateImage(prompt, aspectRatio);
      setGeneratedImage(`data:image/png;base64,${base64Image}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = 'generated-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col items-center space-y-8">
        <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Image Generation</h1>
            <p className="mt-2 text-md text-gray-400">Create stunning visuals from a simple text description.</p>
        </div>

        <div className="w-full max-w-2xl space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div>
                <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">
                    Prompt
                </label>
                <textarea
                    id="prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A cute cat wearing a wizard hat"
                    className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y"
                    disabled={isLoading}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Aspect Ratio
                </label>
                <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => setAspectRatio(ratio)}
                            disabled={isLoading}
                            className={`px-4 py-2 text-sm font-semibold rounded-full shadow-md transition-all duration-200 ease-in-out
                                ${aspectRatio === ratio
                                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        >
                            {ratio}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
                {isLoading ? <><Spinner size="sm" /> Generating...</> : 'Generate Image'}
            </button>
        </div>
        
        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}

        <div className="w-full max-w-2xl">
            {isLoading && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg">
                    <Spinner size="lg" />
                    <p className="mt-4 text-gray-400">Generating your image, please wait...</p>
                </div>
            )}
            {generatedImage && (
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <img src={generatedImage} alt="Generated from prompt" className="rounded-md w-full h-auto" />
                    <button
                        onClick={handleDownload}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-full shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 bg-green-600 hover:bg-green-700 text-white"
                    >
                         <span className="material-symbols-outlined">download</span>
                        Download Image
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default ImageGenerationPage;
