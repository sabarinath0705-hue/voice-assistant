export type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface Note {
  id: string;
  content: string;
  details?: string;
  createdAt: number;
}

export interface Alarm {
  id: string;
  time: string; // HH:mm
  active: boolean;
}

export interface HourlyForecast {
  time: string;
  temp: number;
  condition: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  location: string;
  precipitation: number;
  hourly: HourlyForecast[];
}

export interface HistoryEvent {
  id: string;
  command: string;
  response: string;
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

export type ActionType = 'ADD_NOTE' | 'ADD_TASK' | 'COMPLETE_TASK' | 'LIST_TASKS' | 'SET_TIMER' | 'SET_ALARM' | 'GET_WEATHER' | 'OPEN_APP' | 'PLAY_MUSIC' | 'SCHEDULE_MEETING' | 'SEND_EMAIL' | 'NONE';

export interface AssistantResponse {
  text: string;
  action: {
    type: ActionType;
    payload?: any;
  };
}
