import React, { useEffect } from 'react';
import Layout from './components/Layout';
import TextToSpeechPage from './pages/TextToSpeechPage';

const App: React.FC = () => {
  useEffect(() => {
    document.title = 'Text to Speech | Gemini';
  }, []);

  return (
    <Layout>
      <TextToSpeechPage />
    </Layout>
  );
};

export default App;
