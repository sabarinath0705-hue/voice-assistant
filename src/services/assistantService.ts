import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ActionType } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const addNoteTool: FunctionDeclaration = {
  name: "add_note",
  description: "Adds a new note or reminder to the assistant's memory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: "The content of the note to save."
      }
    },
    required: ["content"]
  }
};

const getWeatherTool: FunctionDeclaration = {
  name: "get_weather",
  description: "Gets the current weather for a specific location.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: "The city or location to check weather for."
      }
    },
    required: ["location"]
  }
};

const setTimerTool: FunctionDeclaration = {
  name: "set_timer",
  description: "Sets a countdown timer.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      durationSeconds: {
        type: Type.NUMBER,
        description: "Duration of the timer in seconds."
      }
    },
    required: ["durationSeconds"]
  }
};

export async function processVoiceCommand(command: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: command,
      config: {
        systemInstruction: `You are Aura, a helpful and futuristic voice assistant. 
        Your personality is elegant, intelligent, and slightly witty.
        Keep responses concise and conversational (max 2 sentences).
        If the user wants to save something, use add_note.
        If they ask about weather, use get_weather.
        If they want a timer, use set_timer.`,
        tools: [{ functionDeclarations: [addNoteTool, getWeatherTool, setTimerTool] }]
      }
    });

    const text = response.text || "";
    const functionCalls = response.functionCalls;

    let action: { type: ActionType; payload: any } = { type: 'NONE', payload: null };

    if (functionCalls) {
      const call = functionCalls[0];
      if (call.name === 'add_note') {
        action = { type: 'ADD_NOTE', payload: call.args };
      } else if (call.name === 'get_weather') {
        action = { type: 'GET_WEATHER', payload: call.args };
      } else if (call.name === 'set_timer') {
        action = { type: 'SET_TIMER', payload: call.args };
      }
    }

    return { text, action };
  } catch (err) {
    console.error("AI Error:", err);
    return { text: "I'm sorry, I couldn't process that right now.", action: { type: 'NONE' as const } };
  }
}
