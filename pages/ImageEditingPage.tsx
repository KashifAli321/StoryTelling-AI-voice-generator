import React, { useState, useRef } from 'react';
import { editImage } from '../services/geminiService';
import { blobToBase64 } from '../utils/fileUtils';
import Spinner from '../components/Spinner';

const ImageEditingPage: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<{ file: File; preview: string } | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("Add a retro, vintage filter to this image.");
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
      setOriginalImage({ file, preview: URL.createObjectURL(file) });
      setEditedImage(null);
      setError('');
    }
  };

  const handleEdit = async () => {
    if (!originalImage || !prompt.trim()) {
      setError('Please select an image and enter an editing prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const imageBase64 = await blobToBase64(originalImage.file);
      const resultBase64 = await editImage(imageBase64, originalImage.file.type, prompt);
      setEditedImage(`data:${originalImage.file.type};base64,${resultBase64}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during editing.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center space-y-8">
        <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Image Editing</h1>
            <p className="mt-2 text-md text-gray-400">Use text prompts to magically edit your images.</p>
        </div>

        <div className="w-full max-w-4xl space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    1. Upload an Image to Edit
                </label>
                <div 
                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="space-y-1 text-center">
                        <span className="material-symbols-outlined text-5xl text-gray-500">
                            add_photo_alternate
                        </span>
                        <div className="flex text-sm text-gray-400">
                            <p className="pl-1">{originalImage ? `Selected: ${originalImage.file.name}` : 'Click to upload'}</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, etc. up to 4MB</p>
                    </div>
                </div>
                <input ref={fileInputRef} onChange={handleImageChange} type="file" accept="image/*" className="hidden" />
            </div>
            
            {originalImage && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                     <div>
                        <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">
                            2. Describe your edit
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
                        onClick={handleEdit}
                        disabled={isLoading}
                        className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? <><Spinner size="sm" /> Editing...</> : 'Apply Edit'}
                    </button>
                </div>
            )}
        </div>

        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-4xl">{error}</p>}
        
        {isLoading && (
            <div className="w-full max-w-4xl flex flex-col items-center justify-center p-8 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg">
                <Spinner size="lg" />
                <p className="mt-4 text-gray-400">Applying your edits, please wait...</p>
            </div>
        )}

        {(originalImage || editedImage) && !isLoading && (
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                {originalImage && (
                     <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-semibold text-center mb-2">Original</h3>
                        <img src={originalImage.preview} alt="Original" className="rounded-md w-full h-auto" />
                    </div>
                )}
                {editedImage && (
                     <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-semibold text-center mb-2">Edited</h3>
                        <img src={editedImage} alt="Edited" className="rounded-md w-full h-auto" />
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default ImageEditingPage;