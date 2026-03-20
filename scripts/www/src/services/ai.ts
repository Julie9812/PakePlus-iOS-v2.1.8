import { GoogleGenAI } from "@google/genai";
import { AIConfig } from "../types";

const getGeminiAI = (config?: AIConfig) => {
  const apiKey = config?.provider === 'gemini' && config.apiKey ? config.apiKey : process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

const generateText = async (prompt: string, config?: AIConfig): Promise<string | null> => {
  if (!config || config.provider === 'gemini' || (!config.apiKey && !process.env.GEMINI_API_KEY)) {
    const ai = getGeminiAI(config);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || null;
  }

  if (config.provider === 'openai' || config.provider === 'custom') {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const model = config.model || 'gpt-4o';
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  if (config.provider === 'anthropic') {
    const model = config.model || 'claude-3-5-sonnet-20240620';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  }

  return null;
};

const generateJson = async (prompt: string, config?: AIConfig): Promise<any> => {
  if (!config || config.provider === 'gemini' || (!config.apiKey && !process.env.GEMINI_API_KEY)) {
    const ai = getGeminiAI(config);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return null;
    }
  }

  if (config.provider === 'openai' || config.provider === 'custom') {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const model = config.model || 'gpt-4o';
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    try {
      return JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch (e) {
      return null;
    }
  }

  if (config.provider === 'anthropic') {
    const model = config.model || 'claude-3-5-sonnet-20240620';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt + "\n\nIMPORTANT: You must return ONLY valid JSON. Do not include markdown formatting or any other text." }],
      }),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    try {
      const text = data.content?.[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      return null;
    }
  }

  return null;
};

export const processNote = async (content: string, config?: AIConfig) => {
  const prompt = `Analyze this note and return a JSON object with:
    1. "tags": string[] (relevant tags)
    2. "summary": string (a concise version)
    3. "type": "thought" | "reflection" | "inspiration" | "mistake"
    4. "star": string (Optional: If it's a reflection/mistake, reformat into STAR template: Situation, Task, Action, Result. Otherwise null)
    
    Note: ${content}`;

  const json = await generateJson(prompt, config);
  if (json) return json;
  
  return { tags: [], summary: content, type: 'thought', star: null };
};

export const checkGhostReminder = async (content: string, mistakes: string[], config?: AIConfig) => {
  if (mistakes.length === 0) return null;
  
  const prompt = `The user is typing: "${content}". 
    Here are their past mistakes/lessons: ${JSON.stringify(mistakes)}.
    If any past mistake is highly relevant to what they are typing, return a short, humorous warning (max 20 words). 
    Otherwise return "null".`;

  const text = await generateText(prompt, config);
  return text === "null" ? null : text;
};

export const generateImage = async (prompt: string, config?: AIConfig) => {
  // Image generation is currently only supported via Gemini in this implementation
  // If using another provider, we could fallback to DALL-E for OpenAI, but for now we'll just use Gemini or return null
  if (config && config.provider !== 'gemini' && config.apiKey) {
    if (config.provider === 'openai' || config.provider === 'custom') {
      try {
        const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/images/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt,
            n: 1,
            size: "1024x1024"
          }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.data?.[0]?.url || null;
        }
      } catch (e) {
        console.error("DALL-E generation failed", e);
      }
    }
    // Fallback or unsupported
    console.warn("Image generation might not be supported for this provider.");
  }

  // Default Gemini fallback
  const ai = getGeminiAI(config);
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K"
      }
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
