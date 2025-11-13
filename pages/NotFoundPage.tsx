
import React from 'react';

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <span className="material-symbols-outlined text-8xl text-red-500">
        error
      </span>
      <h1 className="mt-4 text-4xl font-bold text-gray-100">404 - Page Not Found</h1>
      <p className="mt-2 text-lg text-gray-400">
        Sorry, the page you are looking for does not exist.
      </p>
      <a 
        href="/#" 
        className="mt-6 px-6 py-3 font-semibold rounded-full shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white"
      >
        Go Back to Home
      </a>
    </div>
  );
};

export default NotFoundPage;
