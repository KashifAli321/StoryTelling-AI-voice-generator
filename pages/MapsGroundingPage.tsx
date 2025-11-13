import React, { useState } from 'react';
import { groundedMaps } from '../services/geminiService';
import Spinner from '../components/Spinner';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { GroundingChunk } from '@google/genai';

type Location = { latitude: number, longitude: number };

const MapsGroundingPage: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('What are some good cafes near me with outdoor seating?');
    const [location, setLocation] = useState<Location | null>(null);
    const [result, setResult] = useState<string>('');
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleGetLocation = () => {
        setIsLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                setIsLoading(false);
            },
            (err) => {
                setError(`Could not get location: ${err.message}. Please enable location services.`);
                setIsLoading(false);
            }
        );
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        if (!location) {
            setError('Please provide your location first.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult('');
        setSources([]);

        try {
            const { text, sources } = await groundedMaps(prompt, location);
            setResult(text);
            setSources(sources);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center space-y-8">
            <div className="text-center">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Maps Grounding</h1>
                <p className="mt-2 text-md text-gray-400">Find places and get answers grounded in Google Maps.</p>
            </div>

            <div className="w-full max-w-2xl space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">1. Share Your Location</label>
                    <button
                        onClick={handleGetLocation}
                        disabled={isLoading}
                        className="w-full flex justify-center items-center gap-2 px-6 py-3 font-semibold rounded-full shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">my_location</span>
                        {location ? 'Location Acquired' : 'Get Current Location'}
                    </button>
                    {location && <p className="text-xs text-green-400 text-center">Location shared: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>}
                </div>
                 <div>
                    <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">
                        2. Ask a question
                    </label>
                    <textarea
                        id="prompt-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Where's the closest park?"
                        className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y"
                        disabled={isLoading}
                    />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !location}
                    className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isLoading ? <><Spinner size="sm" /> Finding places...</> : 'Get Answer'}
                </button>
            </div>

            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}
            
             {(result || (isLoading && !location)) && (
                 <div className="w-full max-w-2xl space-y-6">
                    {isLoading && <div className="flex justify-center"><Spinner /></div>}
                    {result && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <MarkdownRenderer content={result} />
                        </div>
                    )}
                    {sources.length > 0 && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <h3 className="text-lg font-semibold mb-2 text-gray-200">Places Mentioned:</h3>
                            <ul className="space-y-2">
                                {sources.map((source, index) => source.maps && (
                                    <li key={index} className="flex items-start gap-2">
                                        <span className="material-symbols-outlined text-teal-400 mt-1">pin_drop</span>
                                        <a href={source.maps.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                            {source.maps.title || 'View on Google Maps'}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MapsGroundingPage;