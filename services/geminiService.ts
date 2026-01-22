
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
// Gemini 3 Flash is the recommended model for basic text and high-speed tasks.
const textModelName = 'gemini-3-flash-preview';
// Gemini 2.5 Flash Image is the default model for image generation tasks.
const imageModelName = 'gemini-2.5-flash-image';

export interface AsciiArtData {
  art: string;
  text?: string;
}

/**
 * Creates a user-friendly error message from a generic error object.
 */
const getApiErrorMessage = (error: unknown, context: string): string => {
  let message = 'An unknown error occurred.';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  if (message.includes('API key not valid')) {
    return `Configuration issue detected. Please check your environment settings.`;
  }
  if (message.includes('429')) {
    return 'The engine is cooling down. Please wait a moment before searching again.';
  }
  if (message.toUpperCase().includes('SAFETY')) {
    return `The content for "${context}" was restricted by safety filters.`;
  }
  if (message.includes('500') || message.includes('503')) {
    return 'The neural network is temporarily unavailable. Please try again shortly.';
  }

  return `Could not generate knowledge for "${context}". Check your connection.`;
};

/**
 * Streams a definition for a given topic from the Gemini API.
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
        thinkingConfig: { thinkingBudget: 0 }, // Minimize latency for streaming
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
 */
export async function getShortDefinition(topic: string): Promise<string> {
  try {
    const prompt = `Provide a very concise, single-sentence definition for the term: "${topic}". The definition should be short enough to fit in a tooltip.`;

    const response = await ai.models.generateContent({
        model: textModelName,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 100,
        },
    });

    return response.text?.trim() || 'No definition found.';
  } catch (error) {
    console.error(`Could not generate short definition for "${topic}":`, error);
    return 'Knowledge unavailable for this term.';
  }
}

/**
 * Generates ASCII art for a given topic from the Gemini API.
 */
export async function generateAsciiArt(topic: string, style: string = "Standard"): Promise<AsciiArtData> {
  try {
    const artSchema = {
      type: Type.OBJECT,
      properties: {
        art: {
          type: Type.STRING,
          description: `A clear, ${style} ASCII art representation of "${topic}". Use only standard characters. Use \\n for newlines.`
        }
      },
      required: ['art']
    };
    
    let styleInstructions = '';
    if (style === 'Minimalist') {
      styleInstructions = 'Use as few characters as possible to create a minimalist suggestion of the form.';
    } else if (style === 'Detailed') {
      styleInstructions = 'Use various characters (like @, #, %, *, ., etc.) for shading and high complexity to create depth and detail.';
    } else if (style === 'Cyberpunk') {
      styleInstructions = 'Use sharp edges, technical characters (like /, \\, |, #, [ ]), and dense geometric patterns.';
    } else {
      styleInstructions = 'Create a clear and recognizable representation using standard ASCII characters.';
    }

    const prompt = `Create a ${style} ASCII art representation for the concept: "${topic}". ${styleInstructions}`;

    const response = await ai.models.generateContent({
      model: textModelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: artSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const jsonStr = response.text?.trim() || '{}';
    const parsedData = JSON.parse(jsonStr);

    if (!parsedData.art) {
      throw new Error('Empty art response');
    }

    return {
      art: parsedData.art,
    };
  } catch (error) {
    console.error(`ASCII Generation failed:`, error);
    throw new Error(`Visual translation failed.`);
  }
}

/**
 * Generates an image for a given topic from the Gemini API.
 * Uses the nano-banana series model (gemini-2.5-flash-image) via generateContent.
 */
export async function generateImage(topic: string, aspectRatio: string = "16:9", style: string = "Cinematic"): Promise<string | null> {
  try {
    const prompt = `A high-quality, ${style} representation of: "${topic}". The image should be visually compelling, thematic, and atmospheric.`;

    const response = await ai.models.generateContent({
      model: imageModelName,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any
        }
      },
    });

    // Find the image part in the response candidates
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return part.inlineData.data; // Return base64 string
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`Image generation error:`, error);
    return null;
  }
}
