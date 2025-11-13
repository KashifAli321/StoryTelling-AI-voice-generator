import React, { useState } from 'react';
import { complexReasoning } from '../services/geminiService';
import Spinner from '../components/Spinner';
import MarkdownRenderer from '../components/MarkdownRenderer';

const DEFAULT_PROMPT = `Solve the following logic puzzle. Provide a step-by-step explanation of your reasoning.

There are five houses in a row, each a different color. In each house lives a person of a different nationality. Each person drinks a different beverage, smokes a different brand of cigar, and keeps a different pet.

Clues:
1. The Brit lives in the red house.
2. The Swede keeps dogs as pets.
3. The Dane drinks tea.
4. The green house is on the immediate left of the white house.
5. The owner of the green house drinks coffee.
6. The person who smokes Pall Mall rears birds.
7. The owner of the yellow house smokes Dunhill.
8. The man living in the house right in the center drinks milk.
9. The Norwegian lives in the first house.
10. The man who smokes Blends lives next to the one who keeps cats.
11. The man who keeps horses lives next to the man who smokes Dunhill.
12. The owner who smokes Bluemasters drinks beer.
13. The German smokes Prince.
14. The Norwegian lives next to the blue house.
15. The man who smokes Blends has a neighbor who drinks water.

Question: Who owns the fish?`;


const ComplexReasoningPage: React.FC = () => {
    const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
    const [result, setResult] = useState<string>('');
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

        try {
            const response = await complexReasoning(prompt);
            setResult(response);
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
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">Complex Reasoning</h1>
                <p className="mt-2 text-md text-gray-400">Challenge Gemini Pro with difficult logic and reasoning problems.</p>
            </div>

            <div className="w-full max-w-4xl space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
                <div>
                    <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-300 mb-2">
                        Enter your complex problem
                    </label>
                    <textarea
                        id="prompt-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter a logic puzzle, a coding challenge, or a complex question..."
                        className="w-full h-64 p-3 bg-gray-900 border border-gray-600 rounded-md shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300 resize-y font-mono text-sm"
                        disabled={isLoading}
                    />
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 px-6 py-3 text-lg font-bold rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isLoading ? <><Spinner size="sm" /> Thinking...</> : 'Solve'}
                </button>
            </div>

            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md w-full max-w-4xl">{error}</p>}
            
            {(result || isLoading) && (
                 <div className="w-full max-w-4xl space-y-6">
                    {isLoading && <div className="flex justify-center"><Spinner /></div>}
                    {result && (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                           <MarkdownRenderer content={result} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ComplexReasoningPage;