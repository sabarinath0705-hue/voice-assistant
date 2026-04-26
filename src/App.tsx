import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Cloud, 
  Clock, 
  StickyNote, 
  Timer,
  ChevronRight,
  Settings,
  History,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { voiceService } from './services/voiceService.ts';
import { processVoiceCommand } from './services/assistantService.ts';
import { AppState, Note, WeatherData } from './types.ts';

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [transcript, setTranscript] = useState<string>("");
  const [response, setResponse] = useState<string>("Hello, I am Aura. How can I assist you today?");
  const [notes, setNotes] = useState<Note[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTimer, setActiveTimer] = useState<number | null>(null);

  // Persistence: Load on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('aura_notes');
    if (savedNotes) setNotes(JSON.parse(savedNotes));

    const savedWeather = localStorage.getItem('aura_weather');
    if (savedWeather) setWeather(JSON.parse(savedWeather));

    const savedTimer = localStorage.getItem('aura_timer');
    if (savedTimer) {
      const { seconds, timestamp } = JSON.parse(savedTimer);
      const elapsed = Math.floor((Date.now() - timestamp) / 1000);
      const remaining = seconds - elapsed;
      if (remaining > 0) {
        setActiveTimer(remaining);
      } else {
        localStorage.removeItem('aura_timer');
      }
    }
  }, []);

  // Persistence: Save on change
  useEffect(() => {
    localStorage.setItem('aura_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    if (weather) localStorage.setItem('aura_weather', JSON.stringify(weather));
  }, [weather]);

  useEffect(() => {
    if (activeTimer !== null) {
      localStorage.setItem('aura_timer', JSON.stringify({
        seconds: activeTimer,
        timestamp: Date.now()
      }));
    } else {
      localStorage.removeItem('aura_timer');
    }
  }, [activeTimer]);

  // Time ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Timer countdown logic
  useEffect(() => {
    if (activeTimer !== null && activeTimer > 0) {
      const t = setTimeout(() => setActiveTimer(prev => prev! - 1), 1000);
      return () => clearTimeout(t);
    } else if (activeTimer === 0) {
      voiceService.speak("Your timer is up!");
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      setActiveTimer(null);
    }
  }, [activeTimer]);

  const handleInteraction = async () => {
    if (state !== 'idle') return;

    try {
      setState('listening');
      const text = await voiceService.listen();
      setTranscript(text);
      
      setState('processing');
      const result = await processVoiceCommand(text);
      setResponse(result.text);

      // Handle Actions
      if (result.action) {
        switch (result.action.type) {
          case 'ADD_NOTE':
            const newNote: Note = {
              id: Math.random().toString(36).substr(2, 9),
              content: result.action.payload.content,
              createdAt: Date.now()
            };
            setNotes(prev => [newNote, ...prev]);
            break;
          case 'GET_WEATHER':
            // Mock weather fetch
            setWeather({
              temp: 22 + Math.floor(Math.random() * 10),
              condition: 'Sunny',
              location: result.action.payload.location
            });
            break;
          case 'SET_TIMER':
            setActiveTimer(result.action.payload.durationSeconds);
            break;
        }
      }

      setState('speaking');
      await voiceService.speak(result.text);
      setState('idle');
    } catch (err) {
      console.error(err);
      setState('idle');
      setResponse("I didn't quite catch that. Could you try again?");
      voiceService.speak("I didn't quite catch that. Could you try again?");
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-between p-8 font-sans overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,#1a1a2e_0%,#000_100%)]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_0%_100%,#4c1d95_0%,transparent_50%)] opacity-30" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_100%_100%,#db2777_0%,transparent_50%)] opacity-20" />

      {/* Header */}
      <header className="w-full max-w-6xl z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-aura-primary to-aura-secondary flex items-center justify-center">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Aura</h1>
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Assistant OS</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-white/40">
          <Clock className="w-5 h-5 mr-1" />
          <span className="text-sm font-mono tracking-tighter">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <Settings className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
        </div>
      </header>

      {/* Main Stage */}
      <main className="flex-1 w-full flex flex-col items-center justify-center z-10 py-12">
        <div className="relative group cursor-pointer" onClick={handleInteraction}>
          {/* Orb Animation */}
          <motion.div
            animate={{
              scale: state === 'listening' ? [1, 1.2, 1] : state === 'processing' ? [1, 0.9, 1] : 1,
              rotate: state === 'processing' ? 360 : 0
            }}
            transition={{
              duration: state === 'listening' ? 1.5 : 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={`w-64 h-64 rounded-full glass orb-glow flex items-center justify-center relative transition-all duration-700 ${state !== 'idle' ? 'border-aura-secondary/50' : 'border-white/10'}`}
          >
            {/* Inner dynamic layers */}
            <motion.div 
              animate={{ 
                opacity: state === 'listening' ? [0.2, 0.6, 0.2] : 0.1,
                scale: state === 'listening' ? [0.8, 1.1, 0.8] : 0.9
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-4 rounded-full bg-aura-secondary blur-2xl" 
            />
            <motion.div 
              animate={{ 
                opacity: state === 'speaking' ? [0.2, 0.5, 0.2] : 0.1,
                scale: state === 'speaking' ? [0.9, 1.05, 0.9] : 0.8
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-8 rounded-full bg-aura-primary blur-3xl shadow-[0_0_100px_rgba(139,92,246,0.5)]" 
            />

            <AnimatePresence mode="wait">
              {state === 'idle' ? (
                <motion.div key="mic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Mic className="w-16 h-16 text-white/80" />
                </motion.div>
              ) : state === 'listening' ? (
                <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1 items-end h-8">
                  {[0, 1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      animate={{ height: [8, 32, 8] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1.5 bg-white rounded-full"
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <History className="w-16 h-16 text-aura-secondary opacity-50" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center w-full">
            <p className="text-white/60 text-sm font-medium tracking-wide">
              {state === 'listening' ? 'Listening...' : state === 'processing' ? 'Thinking...' : state === 'speaking' ? 'Speaking...' : 'Tap for Command'}
            </p>
          </div>
        </div>

        {/* Text Area */}
        <div className="mt-24 w-full max-w-2xl text-center">
          <p className="text-white/40 italic text-sm mb-2">{transcript || '"Tell me a joke"'}</p>
          <motion.h2 
            key={response}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-medium leading-relaxed bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent"
          >
            {response}
          </motion.h2>
        </div>
      </main>

      {/* Widgets Grid */}
      <footer className="w-full max-w-6xl z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Weather Widget */}
        <div className="glass rounded-3xl p-6 flex items-center justify-between group hover:border-white/20 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Weather</p>
              <h3 className="text-lg font-semibold">{weather ? `${weather.temp}°C, ${weather.condition}` : '24°C, Cloud'}</h3>
              <p className="text-xs text-white/30">{weather?.location || 'San Francisco'}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" />
        </div>

        {/* Notes Widget */}
        <div className="glass rounded-3xl p-6 flex items-center justify-between group hover:border-white/20 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-aura-secondary/10 flex items-center justify-center">
              <StickyNote className="w-6 h-6 text-aura-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Notes</p>
              <h3 className="text-lg font-semibold">{notes.length > 0 ? notes[0].content : 'No active notes'}</h3>
              <p className="text-xs text-white/30">{notes.length} saved intents</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" />
        </div>

        {/* Timers/Clock Widget */}
        <div className={`glass rounded-3xl p-6 flex items-center justify-between group hover:border-white/20 transition-all ${activeTimer !== null ? 'border-aura-accent/30' : ''}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl bg-aura-accent/10 flex items-center justify-center ${activeTimer !== null ? 'animate-pulse' : ''}`}>
              <Timer className={`w-6 h-6 ${activeTimer !== null ? 'text-aura-accent' : 'text-white/40'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Active Timer</p>
              <h3 className="text-lg font-semibold font-mono tracking-tighter">
                {activeTimer !== null ? `${Math.floor(activeTimer / 60)}:${(activeTimer % 60).toString().padStart(2, '0')}` : '00:00:00'}
              </h3>
              <p className="text-xs text-white/30">{activeTimer !== null ? 'Countdown active' : 'None set'}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" />
        </div>
      </footer>

      {/* Floating Info */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hidden xl:flex flex-col gap-6">
        <InfoTooltip icon={<Info className="w-5 h-5" />} label="Voice Active" />
        <InfoTooltip icon={<MicOff className="w-5 h-5" />} label="STT Idle" />
      </div>
    </div>
  );
}

function InfoTooltip({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="w-12 h-12 glass rounded-full flex items-center justify-center relative group cursor-help">
      <div className="text-white/40">{icon}</div>
      <span className="absolute right-14 bg-black border border-white/10 px-3 py-1 rounded text-[10px] uppercase tracking-widest text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </div>
  );
}

