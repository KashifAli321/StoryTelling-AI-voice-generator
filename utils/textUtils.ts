const MAX_CHUNK_LENGTH = 4500; // Gemini TTS has a 5000 character limit, being safe.

/**
 * Splits a long string of text into smaller chunks that are less than MAX_CHUNK_LENGTH.
 * It tries to split along sentence boundaries to make the TTS sound more natural.
 * @param text The full string to be chunked.
 * @returns An array of text chunks.
 */
export function chunkText(text: string): string[] {
  if (!text) {
    return [];
  }

  // Use regex to split text into sentences, keeping the delimiter.
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
  
  if (sentences.length === 0) {
    // Handle cases where there are no sentence delimiters or text is very short.
    return text.length > 0 ? [text] : [];
  }
  
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    // If a single sentence is longer than the max length, we must split it.
    if (sentence.length > MAX_CHUNK_LENGTH) {
        // First, push whatever is in currentChunk.
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = "";
        }
        // Then, split the long sentence into smaller parts.
        let tempSentence = sentence;
        while (tempSentence.length > MAX_CHUNK_LENGTH) {
            chunks.push(tempSentence.substring(0, MAX_CHUNK_LENGTH));
            tempSentence = tempSentence.substring(MAX_CHUNK_LENGTH);
        }
        currentChunk = tempSentence; // The remainder of the long sentence.
        continue;
    }

    if (currentChunk.length + sentence.length > MAX_CHUNK_LENGTH) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
    
    currentChunk += sentence;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}