
/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 encoded string.
 * @returns A Uint8Array containing the decoded bytes.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer for playback with the Web Audio API.
 * The browser's native `decodeAudioData` is for encoded formats (like mp3/wav), not raw PCM.
 * @param data The raw audio data as a Uint8Array.
 * @param ctx The AudioContext to use for creating the buffer.
 * @param sampleRate The sample rate of the audio (e.g., 24000).
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @returns A Promise that resolves to an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // The raw data is 16-bit PCM, so we need to create a view of the buffer as Int16Array.
  const dataInt16 = new Int16Array(data.buffer);
  
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // The PCM data is signed 16-bit, from -32768 to 32767.
      // Web Audio API requires float values between -1.0 and 1.0.
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


/**
 * Concatenates multiple AudioBuffer objects into a single AudioBuffer.
 * @param buffers An array of AudioBuffer objects to concatenate.
 * @param context The AudioContext to use for creating the new buffer.
 * @returns A single AudioBuffer containing the combined audio.
 */
export function concatenateAudioBuffers(buffers: AudioBuffer[], context: AudioContext): AudioBuffer {
  if (buffers.length === 0) {
    return context.createBuffer(1, 1, context.sampleRate);
  }
  const numberOfChannels = buffers[0].numberOfChannels;
  const sampleRate = buffers[0].sampleRate;
  
  const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);
  const result = context.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      result.copyToChannel(buffer.getChannelData(channel), channel, offset);
    }
    offset += buffer.length;
  }
  return result;
}

/**
 * Converts an AudioBuffer to a Blob in WAV file format.
 * @param buffer The AudioBuffer to convert.
 * @returns A Blob representing the WAV file.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const channelData = buffer.getChannelData(0); // Assuming mono for this app
  const pcmData = new Int16Array(channelData.length);

  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const dataSize = pcmData.length * (bitsPerSample / 8);
  const bufferSize = 44 + dataSize;
  const view = new DataView(new ArrayBuffer(bufferSize));

  let offset = 0;

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;

  // fmt sub-chunk
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // subchunk1 size (16 for PCM)
  view.setUint16(offset, 1, true); offset += 2; // audio format (1 = PCM)
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * numChannels * (bitsPerSample / 8), true); offset += 4; // byte rate
  view.setUint16(offset, numChannels * (bitsPerSample / 8), true); offset += 2; // block align
  view.setUint16(offset, bitsPerSample, true); offset += 2;

  // data sub-chunk
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;
  
  // Write PCM data
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
      view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([view.buffer], { type: 'audio/wav' });
}
