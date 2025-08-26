/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This is a Vercel Serverless Function that acts as a proxy to the Gemini API.
// It allows the API key to be stored securely as a server-side environment variable.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { type, topic } = req.query;

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
  }

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "topic" query parameter.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const textModelName = 'gemini-2.5-flash';
    const artModelName = 'gemini-2.5-flash';

    if (type === 'definition') {
      const prompt = `For the term "${topic}", provide a detailed, encyclopedia-style explanation. Identify and highlight the most important **key words** in your response by wrapping them in double asterisks, like **this**. Start with a concise, single-paragraph overview. After this overview, provide a list of key aspects as bullet points. Each bullet point should start with the '•' character, followed by a space. Do not use any other markdown, titles, or special formatting. The response should be plain text with only the specified formatting.`;

      const responseStream = await ai.models.generateContentStream({
        model: textModelName,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      for await (const chunk of responseStream) {
        if (chunk && chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } else if (type === 'art') {
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
      res.status(200).json(parsedData);
    } else {
      res.status(400).json({ error: 'Invalid "type" query parameter. Use "definition" or "art".' });
    }
  } catch (error) {
    console.error(`Error processing request for topic "${topic}":`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    res.status(500).json({ error: errorMessage });
  }
}