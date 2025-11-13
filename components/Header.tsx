import React from 'react';

const Header: React.FC = () => {
    return (
        <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
            <nav className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-2">
                        <span className="material-symbols-outlined text-3xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
                            graphic_eq
                        </span>
                        <span className="text-xl font-bold text-gray-100">Text to Speech</span>
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Header;
