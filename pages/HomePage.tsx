
import React from 'react';
import FeatureCard from '../components/FeatureCard';
import { FEATURES } from '../constants';

const HomePage: React.FC = () => {
  const featureList = FEATURES.filter(f => f.path !== '/');

  return (
    <div className="flex flex-col items-center">
      <header className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
          Gemini Feature Gallery
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
          Explore a collection of demos showcasing the versatile capabilities of the Google Gemini API.
        </p>
      </header>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {featureList.map((feature) => (
          <FeatureCard
            key={feature.path}
            path={feature.path}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
