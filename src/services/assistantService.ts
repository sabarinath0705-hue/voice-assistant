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
        description: "The main content or title of the note."
      },
      details: {
        type: Type.STRING,
        description: "Additional details or extensive description for the note."
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

const scheduleMeetingTool: FunctionDeclaration = {
  name: "schedule_meeting",
  description: "Schedules a meeting in the calendar.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Title of the meeting."
      },
      date: {
        type: Type.STRING,
        description: "Date and time of the meeting (e.g. tomorrow at 10am)."
      }
    },
    required: ["title"]
  }
};

const sendEmailTool: FunctionDeclaration = {
  name: "send_email",
  description: "Drafts or sends an email.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: {
        type: Type.STRING,
        description: "Recipient email or name."
      },
      subject: {
        type: Type.STRING,
        description: "Subject of the email."
      },
      body: {
        type: Type.STRING,
        description: "Content of the email."
      }
    },
    required: ["to"]
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
        If they want a timer, use set_timer.
        If they want to schedule a meeting, use schedule_meeting.
        If they want to send an email, use send_email.`,
        tools: [{ functionDeclarations: [addNoteTool, getWeatherTool, setTimerTool, scheduleMeetingTool, sendEmailTool] }]
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
      } else if (call.name === 'schedule_meeting') {
        action = { type: 'SCHEDULE_MEETING', payload: call.args };
      } else if (call.name === 'send_email') {
        action = { type: 'SEND_EMAIL', payload: call.args };
      }
    }

    return { text, action };
  } catch (err) {
    console.error("AI Error:", err);
    return { text: "I'm sorry, I couldn't process that right now.", action: { type: 'NONE' as const } };
  }
}
