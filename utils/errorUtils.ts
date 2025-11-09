/**
 * Translates a caught error object into a user-friendly string.
 * @param error The catched error, expected to be of type `unknown`.
 * @returns A string with a user-friendly error message.
 */
export const getFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('api_key environment variable is not set')) {
        return 'The API key is missing. Please ensure it is configured correctly before using the application.';
    }

    // Check for common API key issues
    if (message.includes('api key not valid') || message.includes('permission denied')) {
      return 'Invalid API Key. Please ensure your API key is correct and has the necessary permissions.';
    }

    // Check for quota issues
    if (message.includes('quota') || message.includes('rate limit')) {
      return 'API quota exceeded. Please check your usage limits in your Google AI Studio dashboard.';
    }

    // Check for billing issues
    if (message.includes('billing')) {
        return 'There might be an issue with your billing account. Please ensure it is active and properly configured.';
    }

    // Check for server errors
    if (message.includes('server error') || message.includes('500') || message.includes('503')) {
      return 'The AI service is temporarily unavailable. Please try again later.';
    }
    
    // Check for model availability issues
    if (message.includes('model is not supported') || message.includes('not found')) {
        return 'The selected voice model is currently unavailable or not supported. Please try another voice.';
    }

    // For generic network errors or other client-side issues
    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'A network error occurred. Please check your internet connection.';
    }
    
    // Return the original message if it's none of the above but still an Error instance
    return error.message;
  }
  
  // Fallback for non-Error types
  return 'An unexpected error occurred. Please check the console for details.';
};
