export type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface Note {
  id: string;
  content: string;
  details?: string;
  createdAt: number;
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

export type ActionType = 'ADD_NOTE' | 'SET_TIMER' | 'GET_WEATHER' | 'OPEN_APP' | 'NONE';

export interface AssistantResponse {
  text: string;
  action: {
    type: ActionType;
    payload?: any;
  };
}
