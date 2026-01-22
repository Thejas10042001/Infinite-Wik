
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';

// Basic check for API key
if (!process.env.API_KEY) {
  throw new Error('API_KEY is not configured.');
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const textModelName = 'gemini-3-flash-preview';
const imageModelName = 'gemini-2.5-flash-image';

export interface AsciiArtData {
  art: string;
  text?: string;
}

// Simple in-memory and session cache to save API quota
const CACHE_PREFIX = 'wiki_cache_v1_';

const getCache = (key: string) => {
  try {
    const data = sessionStorage.getItem(CACHE_PREFIX + key);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
};

const setCache = (key: string, value: any) => {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch (e) {}
};

/**
 * Enhanced exponential backoff with jitter.
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 2000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || '';
      const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many requests') || errorMessage.toLowerCase().includes('quota');
      const isOverloaded = errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded');

      if ((isRateLimit || isOverloaded) && attempt < maxRetries) {
        // Exponential backoff + Random Jitter (0-500ms) to prevent collisions
        const jitter = Math.random() * 500;
        const delay = (baseDelay * Math.pow(2, attempt)) + jitter; 
        console.warn(`Rate limit hit. Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const getApiErrorMessage = (error: unknown, context: string): string => {
  let message = 'An unknown error occurred.';
  if (error instanceof Error) message = error.message;
  else if (typeof error === 'string') message = error;

  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'The neural network is extremely busy right now. We are retrying, but the traffic is high. Please try again in a minute.';
  }
  if (message.toUpperCase().includes('SAFETY')) {
    return `The content for "${context}" was restricted by safety filters.`;
  }
  return `Could not generate knowledge for "${context}". Check your connection.`;
};

/**
 * Streams a definition for a given topic.
 */
export async function* streamDefinition(topic: string): AsyncGenerator<string, void, undefined> {
  // We can't easily cache a stream for partial reading, 
  // but we can cache the final result elsewhere if needed.
  try {
    const prompt = `For the term "${topic}", provide a detailed, encyclopedia-style explanation. Identify and highlight the most important **key words** in your response by wrapping them in double asterisks, like **this**. Start with a concise, single-paragraph overview. After this overview, provide a list of key aspects as bullet points. Each bullet point should start with the '•' character, followed by a space. Plain text only.`;

    const responseStream = await callWithRetry<AsyncGenerator<GenerateContentResponse>>(() => ai.models.generateContentStream({
      model: textModelName,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    }));

    for await (const chunk of responseStream) {
      if (chunk && chunk.text) yield chunk.text;
    }
  } catch (error) {
    throw new Error(getApiErrorMessage(error, topic));
  }
}

/**
 * Generates a concise tooltip definition.
 */
export async function getShortDefinition(topic: string): Promise<string> {
  const cacheKey = `def_${topic.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const prompt = `Provide a single-sentence definition for: "${topic}". Short enough for a tooltip.`;
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: textModelName,
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 100 },
    }));

    const result = response.text?.trim() || 'No definition found.';
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return 'Knowledge unavailable.';
  }
}

/**
 * Generates ASCII art for a given topic.
 */
export async function generateAsciiArt(topic: string, style: string = "Standard"): Promise<AsciiArtData> {
  const cacheKey = `ascii_${topic.toLowerCase()}_${style}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const artSchema = {
      type: Type.OBJECT,
      properties: {
        art: { type: Type.STRING, description: `A ${style} ASCII art representation of "${topic}".` }
      },
      required: ['art']
    };
    
    const styleInst = style === 'Minimalist' ? 'Minimal characters.' : style === 'Detailed' ? 'High complexity, shading.' : style === 'Cyberpunk' ? 'Technical, sharp edges.' : 'Standard clear art.';
    const prompt = `Create a ${style} ASCII art for: "${topic}". ${styleInst}`;

    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: textModelName,
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: artSchema, thinkingConfig: { thinkingBudget: 0 } },
    }));

    const parsedData = JSON.parse(response.text?.trim() || '{}');
    if (!parsedData.art) throw new Error('Empty art');
    
    setCache(cacheKey, parsedData);
    return parsedData;
  } catch (error) {
    throw new Error(`Visual translation failed.`);
  }
}

/**
 * Generates an image.
 */
export async function generateImage(topic: string, aspectRatio: string = "16:9", style: string = "Cinematic"): Promise<string | null> {
  const cacheKey = `img_${topic.toLowerCase()}_${aspectRatio}_${style}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const prompt = `A high-quality, ${style} representation of: "${topic}". Atmospheric and thematic.`;
    const response = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: imageModelName,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: aspectRatio as any } },
    }));

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const data = part.inlineData.data;
          setCache(cacheKey, data);
          return data;
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}
