
import React from 'react';

interface FeatureCardProps {
  path: string;
  icon: string;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ path, icon, title, description }) => {
  return (
    <a 
      href={`#${path}`}
      className="group block p-6 bg-gray-800 border border-gray-700 rounded-xl shadow-lg hover:bg-gray-700/50 transition-all duration-300 ease-in-out transform hover:-translate-y-1"
    >
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 text-white">
            <span className="material-symbols-outlined text-3xl">
              {icon}
            </span>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-100 group-hover:text-teal-300 transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
};

export default FeatureCard;
