import React, { useState, useRef } from 'react';
import { analyzeImage } from '../services/geminiService';
import { blobToBase64 } from '../utils/fileUtils';
import Spinner from '../components/Spinner';
import MarkdownRenderer from '../components/MarkdownRenderer';

const ImageAnalysisPage: React.FC = () => {
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const [prompt, setPrompt] = useState<string>("What's in this picture?");
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit
          setError("Image size exceeds 4MB. Please choose a smaller file.");
          return;
      }
      setImage({ file, preview: URL.createObjectURL(file) });
      setAnalysis('');
      setError('');
    }
  };

  const handleAnalyze = async () => {
    if (!image || !prompt.trim()) {
      setError('Please select an image and enter a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis('');

    try {
      const imageBase64 = await blobToBase64(image.file);
      const result = await analyzeImage(imageBase64, image.file.type, prompt);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-8">
        <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Image Analysis</h1>
            <p className="mt-2 text-md text-gray-400">Ask questions about the content of your images.</p>
        </div>

        <div className="w-full max-w-2xl space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    1. Upload an Image
                </label>
                <div 
                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="space-y-1 text-center">
                        <span className="material-symbols-outlined text-5xl text-gray-500">
                            cloud_upload
                        </span>
                        <div className="flex text-sm text-gray-400">
                            <p className="pl-1">{image ? `Selected: ${image.file.name}` : 'Click to upload a file'}</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 4MB</p>
                    </div>
                </div>
                <input ref={fileInputRef} onChange={handleImageChange} type="file" accept="image/*" className="hidden" />
            </div>

            {image && (
                 <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <img src={image.preview} alt="Upload preview" className="rounded-md max-h-64 mx-auto" />
                </div>
            )}
            
            {image && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                     <div>
                        <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">
                            2. Ask a question
                        </label>
                        <input
                            id="prompt-input"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300"
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? <><Spinner size="sm" /> Analyzing...</> : 'Analyze Image'}
                    </button>
                </div>
            )}
        </div>

        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}
        
        {analysis && (
            <div className="w-full max-w-2xl bg-gray-800 p-4 rounded-lg border border-gray-700">
                 <MarkdownRenderer content={analysis} />
            </div>
        )}
    </div>
  );
};

export default ImageAnalysisPage;