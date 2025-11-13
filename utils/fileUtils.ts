/**
 * Converts a Blob object to a base64 encoded string.
 * This is used to prepare file uploads (images, audio) for the Gemini API.
 * @param blob The Blob to convert.
 * @returns A Promise that resolves to the base64 string, without the data URI prefix.
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // The result includes the data URI prefix (e.g., "data:image/png;base64,"),
        // which should be stripped before sending to the API.
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
};