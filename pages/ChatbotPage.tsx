import React, { useState, useRef, useEffect } from 'react';
import { createChatSession } from '../services/geminiService';
import { Chat } from '@google/genai';
import Spinner from '../components/Spinner';
import MarkdownRenderer from '../components/MarkdownRenderer';

type Message = {
  sender: 'user' | 'model';
  content: string;
};

const ChatbotPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatRef.current = createChatSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatRef.current) return;
    
    const userMessage: Message = { sender: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
        const responseStream = await chatRef.current.sendMessageStream({ message: input });
        
        let modelResponse = '';
        setMessages(prev => [...prev, { sender: 'model', content: '' }]);

        for await (const chunk of responseStream) {
            modelResponse += chunk.text;
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = modelResponse;
                return newMessages;
            });
        }

    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to get response: ${errorMessage}`);
        setMessages(prev => prev.slice(0, -1)); // Remove the placeholder
    } finally {
        setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  };

  return (
    <div className="flex flex-col items-center h-[calc(100vh-10rem)]">
        <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">AI Chatbot</h1>
            <p className="mt-2 text-md text-gray-400">Have a conversation with a helpful Gemini assistant.</p>
        </div>
        <div className="flex flex-col w-full max-w-3xl flex-grow bg-gray-800 border border-gray-700 rounded-lg shadow-2xl">
            <div className="flex-grow p-4 overflow-y-auto">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Ask me anything to start the conversation!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, index) => (
                             <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                                {msg.sender === 'model' && 
                                    <span className="flex-shrink-0 material-symbols-outlined text-xl text-teal-300">smart_toy</span>
                                }
                                <div className={`max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-800 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                    <MarkdownRenderer content={msg.content} />
                                </div>
                             </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 material-symbols-outlined text-xl text-teal-300">smart_toy</span>
                                <div className="max-w-md p-3 rounded-lg bg-gray-700 text-gray-200">
                                    <Spinner size="sm" color="text-gray-400" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            {error && <p className="text-sm text-red-400 bg-red-900/50 p-2 mx-4 rounded-md">{error}</p>}
            <div className="p-4 border-t border-gray-700 flex items-center gap-4">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="flex-grow p-3 bg-gray-900 border border-gray-600 rounded-full shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-300"
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-in-out bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Send message"
                >
                    <span className="material-symbols-outlined">send</span>
                </button>
            </div>
        </div>
    </div>
  );
};

export default ChatbotPage;