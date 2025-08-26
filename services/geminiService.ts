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

export interface AsciiArtData {
  art: string;
  text?: string;
}

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
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`Could not generate content for "${topic}". ${errorMessage}`);
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
