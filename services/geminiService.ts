/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from '@google/genai';

// Basic check for API key to prevent app crash and provide a clear error.
if (!process.env.API_KEY) {
  throw new Error('API_KEY is not configured. Please check your environment variables to continue.');
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const textModelName = 'gemini-2.5-flash';
const artModelName = 'gemini-2.5-flash';
const imageModelName = 'imagen-4.0-generate-001';


export interface AsciiArtData {
  art: string;
  text?: string;
}

/**
 * Creates a user-friendly error message from a generic error object.
 * @param error The error object caught.
 * @param context The topic or context in which the error occurred.
 * @returns A user-friendly error string.
 */
const getApiErrorMessage = (error: unknown, context: string): string => {
  let message = 'An unknown error occurred.';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  // Check for common API error patterns to provide better user feedback.
  if (message.includes('API key not valid')) {
    return `There is an issue with the application's configuration. Please contact support.`;
  }
  if (message.includes('429')) { // Too Many Requests
    return 'The service is currently busy. Please try again in a few moments.';
  }
  if (message.toUpperCase().includes('SAFETY')) { // Content blocked by safety settings
    return `The response for "${context}" was blocked due to safety filters. Please try a different topic.`;
  }
  if (message.includes('400 Bad Request')) {
    return `The request was invalid. Please try rephrasing your search.`;
  }
  if (message.includes('500') || message.includes('503')) { // Server errors
    return 'The service is temporarily unavailable. Please try again later.';
  }

  // Default error for failed generation
  return `Could not generate content for "${context}". Please check your internet connection and try again.`;
};


/**
 * Streams a definition for a given topic from the Gemini API.
 * @param topic The word or term to define.
 * @returns An async generator that yields text chunks of the definition.
 */
export async function* streamDefinition(
  topic: string,
): AsyncGenerator<string, void, undefined> {
  try {
    const prompt = `For the term "${topic}", provide a detailed, encyclopedia-style explanation. Identify and highlight the most important **key words** in your response by wrapping them in double asterisks, like **this**. Start with a concise, single-paragraph overview. After this overview, provide a list of key aspects as bullet points. Each bullet point should start with the '•' character, followed by a space. Do not use any other markdown, titles, or special formatting. The response should be plain text with only the specified formatting.`;

    const responseStream = await ai.models.generateContentStream({
      model: textModelName,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    for await (const chunk of responseStream) {
      if (chunk && chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error(`Could not generate content for "${topic}":`, error);
    throw new Error(getApiErrorMessage(error, topic));
  }
}

/**
 * Generates a concise, one-sentence definition for a given topic.
 * @param topic The word or term to define.
 * @returns A promise that resolves to the definition string.
 */
export async function getShortDefinition(topic: string): Promise<string> {
  try {
    const prompt = `Provide a very concise, single-sentence definition for the term: "${topic}". The definition should be short enough to fit in a tooltip.`;

    const response = await ai.models.generateContent({
        model: textModelName,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 50, // Keep it short
        },
    });

    return response.text.trim();
  } catch (error) {
    console.error(`Could not generate short definition for "${topic}":`, error);
    // Return a generic error message instead of throwing, so the UI doesn't break.
    return 'Could not load definition.';
  }
}


/**
 * Generates ASCII art for a given topic from the Gemini API.
 * @param topic The topic to generate art for.
 * @returns A promise that resolves to an object with art.
 */
export async function generateAsciiArt(topic: string): Promise<AsciiArtData> {
  try {
    const artSchema = {
      type: Type.OBJECT,
      properties: {
        art: {
          type: Type.STRING,
          description: `A clear, simple, and recognizable ASCII art representation of the concept "${topic}". The art should be easy for a person to understand and visually connect to the topic. For example, for "tree", draw a simple tree. For "ocean", draw waves. The art must be a single string with \\n for newlines.`
        }
      },
      required: ['art']
    };
    const prompt = `Create a simple and recognizable ASCII art representation for the concept: "${topic}".`;

    const response = await ai.models.generateContent({
      model: artModelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: artSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const jsonStr = response.text.trim();
    const parsedData = JSON.parse(jsonStr);

    if (typeof parsedData.art !== 'string' || parsedData.art.trim().length === 0) {
      throw new Error('Invalid or empty ASCII art in response from server');
    }

    return {
      art: parsedData.art,
    };
  } catch (error) {
    console.error(`Could not generate ASCII art for "${topic}":`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`Could not generate ASCII art. ${errorMessage}`);
  }
}

/**
 * Generates an image for a given topic from the Gemini API.
 * @param topic The topic to generate an image for.
 * @returns A promise that resolves to the base64 encoded image string, or null on failure.
 */
export async function generateImage(topic: string): Promise<string | null> {
  try {
    const prompt = `A high-quality, artistic photograph representing the concept of: "${topic}". The image should be visually compelling and symbolic of the topic.`;

    const response = await ai.models.generateImages({
      model: imageModelName,
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
        aspectRatio: '16:9',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages[0].image.imageBytes;
    }
    return null;
  } catch (error) {
    console.error(`Could not generate image for "${topic}":`, error);
    // Return null instead of throwing to prevent crashing the entire content load.
    return null;
  }
}