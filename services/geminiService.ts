/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {GoogleGenAI, Type} from '@google/genai';

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  ai = new GoogleGenAI({apiKey: process.env.API_KEY});
} else {
  console.error(
    'API_KEY environment variable is not set. The application will run in demo mode.',
  );
}

const artModelName = 'gemini-2.5-flash';
const textModelName = 'gemini-2.5-flash';
/**
 * Art-direction toggle for ASCII art generation.
 * `true`: Slower, higher-quality results (allows the model to "think").
 * `false`: Faster, potentially lower-quality results (skips thinking).
 */
const ENABLE_THINKING_FOR_ASCII_ART = false;

export interface AsciiArtData {
  art: string;
  text?: string; // Text is now optional
}

/**
 * Streams a definition for a given topic from the Gemini API.
 * @param topic The word or term to define.
 * @returns An async generator that yields text chunks of the definition.
 */
export async function* streamDefinition(
  topic: string,
): AsyncGenerator<string, void, undefined> {
  if (!ai) {
    throw new Error('API_KEY_MISSING');
  }

  const prompt = `For the term "${topic}", provide a detailed, encyclopedia-style explanation. Identify and highlight the most important **key words** in your response by wrapping them in double asterisks, like **this**. Start with a concise, single-paragraph overview. After this overview, provide a list of key aspects as bullet points. Each bullet point should start with the '•' character, followed by a space. Do not use any other markdown, titles, or special formatting. The response should be plain text with only the specified formatting.`;

  try {
    const response = await ai.models.generateContentStream({
      model: textModelName,
      contents: prompt,
      config: {
        // Disable thinking for the lowest possible latency, as requested.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    for await (const chunk of response) {
      if (chunk && chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error('Error streaming from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Could not generate content for "${topic}". ${errorMessage}`);
  }
}

/**
 * Generates a single random word or concept using the Gemini API.
 * @returns A promise that resolves to a single random word.
 */
export async function getRandomWord(): Promise<string> {
  if (!ai) {
    throw new Error('API_KEY_MISSING');
  }

  const prompt = `Generate a single, random, interesting English word or a two-word concept. It can be a noun, verb, adjective, or a proper noun. Respond with only the word or concept itself, with no extra text, punctuation, or formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: textModelName,
      contents: prompt,
      config: {
        // Disable thinking for low latency.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error('Error getting random word from Gemini:', error);
    const errorMessage =
      error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Could not get random word: ${errorMessage}`);
  }
}

/**
 * Generates ASCII art and optionally text for a given topic.
 * @param topic The topic to generate art for.
 * @returns A promise that resolves to an object with art and optional text.
 */
export async function generateAsciiArt(topic: string): Promise<AsciiArtData> {
  if (!ai) {
    throw new Error('API_KEY_MISSING');
  }
  
  // Define the desired JSON output structure for more reliable responses.
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
  
  // A simpler prompt works better with a defined schema.
  const prompt = `Create a simple and recognizable ASCII art representation for the concept: "${topic}".`;

  const maxRetries = 1;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: artSchema,
      };
      if (!ENABLE_THINKING_FOR_ASCII_ART) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }

      const response = await ai.models.generateContent({
        model: artModelName,
        contents: prompt,
        config: config,
      });

      let jsonStr = response.text.trim();
      const parsedData = JSON.parse(jsonStr) as AsciiArtData;
      
      // Validate the response structure
      if (typeof parsedData.art !== 'string' || parsedData.art.trim().length === 0) {
        throw new Error('Invalid or empty ASCII art in response');
      }
      
      return {
        art: parsedData.art,
      };

    } catch (error) {
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : error);
      if (attempt === maxRetries) {
        throw new Error(`Could not generate ASCII art after ${maxRetries} attempts.`);
      }
    }
  }
  // This line should not be reachable due to the loop and throw logic.
  throw new Error('All ASCII art generation attempts failed');
}
