import React, { useState } from 'react';
import { groundedSearch } from '../services/geminiService';
import Spinner from '../components/Spinner';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { GroundingChunk } from '@google/genai';

const SearchGroundingPage: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('Who won the latest Formula 1 race and what were the key moments?');
    const [result, setResult] = useState<string>('');
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult('');
        setSources([]);

        try {
            const { text, sources } = await groundedSearch(prompt);
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
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Search Grounding</h1>
                <p className="mt-2 text-md text-gray-400">Get up-to-date answers grounded in Google Search.</p>
            </div>

            <div className="w-full max-w-2xl space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div>
                    <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">
                        Ask a question
                    </label>
                    <textarea
                        id="prompt-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., What are the latest trends in AI?"
                        className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y"
                        disabled={isLoading}
                    />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isLoading ? <><Spinner size="sm" /> Generating...</> : 'Get Answer'}
                </button>
            </div>

            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-2xl">{error}</p>}
            
            {(result || isLoading) && (
                 <div className="w-full max-w-2xl space-y-6">
                    {isLoading && <div className="flex justify-center"><Spinner /></div>}
                    {result && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <MarkdownRenderer content={result} />
                        </div>
                    )}
                    {sources.length > 0 && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <h3 className="text-lg font-semibold mb-2 text-gray-200">Sources:</h3>
                            <ul className="list-disc list-inside space-y-2">
                                {sources.map((source, index) => source.web && (
                                    <li key={index}>
                                        <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                            {source.web.title || source.web.uri}
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

export default SearchGroundingPage;