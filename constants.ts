export const FEATURES = [
  {
    path: '/',
    title: 'Home',
    description: 'Welcome to the Gemini Feature Gallery.',
    icon: 'home',
    model: ''
  },
  {
    path: '/chatbot',
    title: 'AI Chatbot',
    description: 'Engage in a multi-turn conversation with an AI assistant.',
    icon: 'smart_toy',
    model: 'gemini-2.5-flash'
  },
  {
    path: '/live-conversation',
    title: 'Live Conversation',
    description: 'Have a real-time voice conversation with Gemini.',
    icon: 'record_voice_over',
    model: 'gemini-2.5-flash-native-audio-preview-09-2025'
  },
  {
    path: '/speech-to-text',
    title: 'Speech to Text',
    description: 'Record audio and get a transcription from Gemini.',
    icon: 'speech_to_text',
    model: 'gemini-2.5-flash'
  },
  {
    path: '/image-generation',
    title: 'Image Generation',
    description: 'Create high-quality images from text prompts.',
    icon: 'image',
    model: 'imagen-4.0-generate-001'
  },
  {
    path: '/image-analysis',
    title: 'Image Analysis',
    description: 'Upload an image and ask questions about it.',
    icon: 'image_search',
    model: 'gemini-2.5-flash'
  },
  {
    path: '/image-editing',
    title: 'Image Editing',
    description: 'Use text prompts to edit your images with Nano Banana.',
    icon: 'auto_fix_high',
    model: 'gemini-2.5-flash-image'
  },
  {
    path: '/video-generation',
    title: 'Video Generation',
    description: 'Generate a short video from a text prompt using Veo.',
    icon: 'movie',
    model: 'veo-3.1-fast-generate-preview'
  },
  {
    path: '/search-grounding',
    title: 'Search Grounding',
    description: 'Get up-to-date answers grounded in Google Search.',
    icon: 'travel_explore',
    model: 'gemini-2.5-flash'
  },
  {
    path: '/maps-grounding',
    title: 'Maps Grounding',
    description: 'Find places and get location-based information.',
    icon: 'location_on',
    model: 'gemini-2.5-flash'
  },
  {
    path: '/complex-reasoning',
    title: 'Complex Reasoning',
    description: 'Challenge Gemini with complex problems.',
    icon: 'psychology',
    model: 'gemini-2.5-pro'
  },
];

export const VOICES = [
  { name: 'Kore', displayName: 'Kore (Female)' },
  { name: 'Puck', displayName: 'Puck (Male)' },
  { name: 'Zephyr', displayName: 'Zephyr (Female)' },
  { name: 'Fenrir', displayName: 'Fenrir (Male)' },
  { name: 'Charon', displayName: 'Charon (Male)' },
];