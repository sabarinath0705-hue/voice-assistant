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
import { AppState, Note, Alarm, WeatherData, HistoryEvent } from './types.ts';

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [transcript, setTranscript] = useState<string>("");
  const [response, setResponse] = useState<string>("Hello, I am Zephyr. How can I assist you today?");
  const [notes, setNotes] = useState<Note[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Persistence: Load on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('aura_notes');
    if (savedNotes) setNotes(JSON.parse(savedNotes));

    const savedWeather = localStorage.getItem('aura_weather');
    if (savedWeather) setWeather(JSON.parse(savedWeather));

    const savedHistory = localStorage.getItem('aura_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedAlarms = localStorage.getItem('aura_alarms');
    if (savedAlarms) setAlarms(JSON.parse(savedAlarms));

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
    localStorage.setItem('aura_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('aura_alarms', JSON.stringify(alarms));
  }, [alarms]);

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

  // Alarm logic
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const currentHHmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      setAlarms(prev => {
        let triggered = false;
        const nextAlarms = prev.map(alarm => {
          if (alarm.active && alarm.time === currentHHmm) {
            triggered = true;
            return { ...alarm, active: false }; // Deactivate once triggered
          }
          return alarm;
        });

        if (triggered) {
          voiceService.speak("Alarm! Your scheduled alarm is ringing.");
          confetti({
            particleCount: 100,
            spread: 120,
            origin: { y: 0.3 }
          });
        }

        return triggered ? nextAlarms : prev;
      });
    };

    const interval = setInterval(checkAlarms, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [alarms]);

  const handleInteraction = async () => {
    if (state !== 'idle') return;

    try {
      setState('listening');
      const text = await voiceService.listen();
      setTranscript(text);
      
      setState('processing');
      const result = await processVoiceCommand(text);
      setResponse(result.text);

      // Add to History
      const newEvent: HistoryEvent = {
        id: Math.random().toString(36).substr(2, 9),
        command: text,
        response: result.text,
        timestamp: Date.now()
      };
      setHistory(prev => [newEvent, ...prev].slice(0, 50));

      // Handle Actions
      if (result.action) {
        switch (result.action.type) {
          case 'ADD_NOTE':
            const newNote: Note = {
              id: Math.random().toString(36).substr(2, 9),
              content: result.action.payload.content,
              details: result.action.payload.details,
              createdAt: Date.now()
            };
            setNotes(prev => [newNote, ...prev]);
            break;
          case 'GET_WEATHER':
            // Mock weather fetch with expanded data
            const baseTemp = 22 + Math.floor(Math.random() * 10);
            setWeather({
              temp: baseTemp,
              condition: 'Partly Cloudy',
              location: result.action.payload.location,
              precipitation: Math.floor(Math.random() * 60),
              hourly: Array.from({ length: 5 }).map((_, i) => ({
                time: `${(new Date().getHours() + i + 1) % 24}:00`,
                temp: baseTemp + Math.floor(Math.random() * 4) - 2,
                condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)]
              }))
            });
            break;
          case 'SET_TIMER':
            setActiveTimer(result.action.payload.durationSeconds);
            break;
          case 'SET_ALARM': {
            // Basic parsing of string time e.g. "07:00 AM" to "07:00"
            const rawTime = result.action.payload.time;
            const match = rawTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (match) {
              let h = parseInt(match[1]);
              const m = match[2].padStart(2, '0');
              const period = match[3]?.toUpperCase();
              if (period === 'PM' && h < 12) h += 12;
              if (period === 'AM' && h === 12) h = 0;
              const hhmm = `${h.toString().padStart(2, '0')}:${m}`;
              
              const newAlarm: Alarm = {
                id: Math.random().toString(36).substr(2, 9),
                time: hhmm,
                active: true
              };
              setAlarms(prev => [newAlarm, ...prev]);
              setResponse(`Alarm set for ${rawTime}.`);
            }
            break;
          }
          case 'OPEN_APP': {
            const app = result.action.payload.appName?.toLowerCase();
            const appMap: Record<string, string> = {
              'spotify': 'https://open.spotify.com',
              'maps': 'https://maps.google.com',
              'google maps': 'https://maps.google.com',
              'youtube': 'https://youtube.com',
              'calendar': 'https://calendar.google.com',
              'gmail': 'https://mail.google.com',
              'github': 'https://github.com',
              'whatsapp': 'https://web.whatsapp.com',
              'twitter': 'https://twitter.com',
              'facebook': 'https://facebook.com',
              'instagram': 'https://instagram.com'
            };
            if (app && appMap[app]) {
              window.open(appMap[app], '_blank');
            } else if (app) {
              window.open(`https://www.google.com/search?q=${encodeURIComponent(app)}`, '_blank');
            }
            break;
          }
          case 'PLAY_MUSIC': {
            const service = result.action.payload.service || 'Spotify';
            if (service === 'YouTube Music') {
              window.open('https://music.youtube.com', '_blank');
            } else {
              window.open('https://open.spotify.com', '_blank');
            }
            break;
          }
          case 'SCHEDULE_MEETING': {
            const meetingTitle = encodeURIComponent(result.action.payload.title || 'Meeting');
            const meetingDate = encodeURIComponent(result.action.payload.date || '');
            window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${meetingTitle}&details=Scheduled%20via%20Zephyr%20Assistant.%20Stated%20time:%20${meetingDate}`, '_blank');
            break;
          }
          case 'SEND_EMAIL': {
            const to = encodeURIComponent(result.action.payload.to || '');
            const subject = encodeURIComponent(result.action.payload.subject || 'Hello from Zephyr');
            const body = encodeURIComponent(result.action.payload.body || '');
            window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
            break;
          }
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
    <div className="min-h-screen relative flex flex-col items-center justify-between font-sans overflow-hidden bg-[#0A0A0A]">
      {/* Immersive Background */}
      <div className="atmosphere" />
      
      {/* Header */}
      <header className="w-full max-w-7xl z-10 px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl tech-border flex items-center justify-center bg-white/[0.02]">
            <div className="w-4 h-4 rounded-full bg-aura-accent shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-medium tracking-tight text-white/90">Zephyr <span className="text-aura-accent ml-1 text-xs opacity-50 font-mono italic">v2.4.0</span></h1>
            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium leading-none mt-1">Autonomous Assistant OS</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden lg:flex flex-col items-end">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-1">System Entropy</p>
            <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: ['20%', '45%', '30%'] }} 
                transition={{ duration: 5, repeat: Infinity }} 
                className="h-full bg-aura-primary" 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-white/50">
            <div className="flex flex-col items-end">
              <span className="text-xl font-mono tracking-tighter text-white font-medium">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-[9px] uppercase tracking-widest opacity-50 font-mono">
                {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <History 
              className={`w-5 h-5 cursor-pointer transition-colors ${showHistory ? 'text-aura-accent' : 'hover:text-white'}`} 
              onClick={() => setShowHistory(!showHistory)}
            />
            <Settings className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
          </div>
        </div>
      </header>

      {/* Main Intelligent Interaction Stage */}
      <main className="flex-1 w-full flex flex-col items-center justify-center z-10 px-8">
        <div className="relative group" onClick={handleInteraction}>
          {/* Orbital Command Hub */}
          <div className="relative w-[340px] h-[340px] flex items-center justify-center">
            {/* Outer Rotating Rings */}
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border border-dashed border-white/10 rounded-full" 
            />
            <motion.div 
              animate={{ rotate: -360 }} 
              transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
              className="absolute inset-8 border border-white/5 rounded-full" 
            />
            
            {/* Core Orb */}
            <motion.div
              animate={{
                scale: state === 'listening' ? [1, 1.1, 1] : state === 'processing' ? [1, 0.95, 1] : 1,
              }}
              className={`w-56 h-56 rounded-full glass orb-glow flex items-center justify-center relative z-20 tech-border cursor-pointer transition-all duration-500 ${state !== 'idle' ? 'border-aura-accent/40 bg-aura-accent/5 shadow-[0_0_100px_rgba(6,182,212,0.15)]' : 'border-white/10 hover:border-white/20'}`}
            >
              <AnimatePresence mode="wait">
                {state === 'idle' ? (
                  <motion.div key="mic" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <Mic className="w-12 h-12 text-white/70" />
                  </motion.div>
                ) : state === 'listening' ? (
                  <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1.5 items-center">
                    {[0, 1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        animate={{ height: [12, 48, 12], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                        className="w-1 bg-aura-accent rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div key="processing" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <div className="w-12 h-12 border-2 border-aura-secondary border-t-transparent rounded-full" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Orbiting Satellite Widgets (Status indicators) */}
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white/20 rounded-full blur-[2px]" />
            </motion.div>
          </div>
          
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-center w-64">
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-aura-accent uppercase tracking-[0.3em] font-mono"
            >
              {state === 'listening' ? 'Acquiring Signal' : state === 'processing' ? 'Processing Logic' : state === 'speaking' ? 'Relaying Output' : 'Awaiting Voice'}
            </motion.p>
          </div>
        </div>

        {/* Intelligence Output Display */}
        <div className="mt-32 w-full max-w-3xl">
          <div className="flex flex-col items-center gap-6">
            <p className="text-white/30 italic text-sm font-light tracking-wide bg-white/5 px-4 py-1.5 rounded-full tech-border">
              {transcript ? `"${transcript}"` : '"Open Spotify and play music"'}
            </p>
            <motion.div 
              key={response}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="text-3xl md:text-4xl font-light leading-tight tracking-tight text-white/90">
                {response}
              </h2>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Modular Utility Rail */}
      <footer className="w-full max-w-7xl z-10 px-8 pb-10 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Module: Weather */}
        <div className="glass tech-border rounded-2xl p-5 flex flex-col gap-4 group transition-all hover:bg-white/[0.05]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center tech-border">
                <Cloud className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Atmosphere</p>
                <h3 className="text-base font-medium">{weather ? `${weather.temp}°C, ${weather.condition}` : '24°C, Cloudy'}</h3>
              </div>
            </div>
            <div className="text-right font-mono">
              <p className="text-[9px] text-white/20 uppercase">Humidity</p>
              <p className="text-xs text-blue-400">{weather?.precipitation || 12}%</p>
            </div>
          </div>
          <div className="flex justify-between items-center bg-black/40 rounded-xl p-2 border border-white/5">
            {(weather?.hourly || Array.from({length: 4}).map((_, i) => ({ time: `${14 + i}:00`, temp: 24 - i }))).slice(0, 4).map((h: any, i) => (
              <div key={i} className="text-center px-2">
                <p className="text-[8px] text-white/30 mb-0.5">{h.time}</p>
                <p className="text-[10px] font-mono font-medium">{h.temp}°</p>
              </div>
            ))}
          </div>
        </div>

        {/* Module: Memory (Notes) */}
        <div className="glass tech-border rounded-2xl p-5 flex flex-col gap-3 group transition-all hover:bg-white/[0.05]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center tech-border">
                <StickyNote className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Cognition</p>
                <h3 className="text-base font-medium">Memory Cache</h3>
              </div>
            </div>
            <span className="text-[10px] font-mono text-white/20">{notes.length} Ent.</span>
          </div>
          <div className="flex-1 bg-black/40 rounded-xl p-3 border border-white/5">
             <h4 className="text-xs font-medium text-white/80 line-clamp-1 mb-1">{notes.length > 0 ? notes[0].content : 'No active notes'}</h4>
             <p className="text-[10px] text-white/30 line-clamp-2 leading-relaxed">{notes.length > 0 && notes[0].details ? notes[0].details : 'Your saved tactical data and voice intents will appear here.'}</p>
          </div>
        </div>

        {/* Module: Temporal (Alarms/Timer) */}
        <div className="glass tech-border rounded-2xl p-5 flex flex-col gap-3 group transition-all hover:bg-white/[0.05]">
           <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center tech-border ${activeTimer !== null ? 'animate-pulse border-cyan-500/30' : ''}`}>
                <Clock className={`w-5 h-5 ${activeTimer !== null ? 'text-cyan-400' : 'text-white/30'}`} />
              </div>
              <div>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Temporal</p>
                <h3 className="text-base font-medium">System Alarms</h3>
              </div>
            </div>
            <div className="flex-1 bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
              {activeTimer !== null ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] uppercase text-white/20 mb-1">Active Timer</p>
                    <p className="text-xl font-mono text-cyan-400 tracking-tighter">
                      {Math.floor(activeTimer / 60)}:{(activeTimer % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                  <Timer className="w-5 h-5 text-cyan-400 animate-spin-slow" />
                </div>
              ) : alarms.length > 0 ? (
                <div className="flex items-center justify-between">
                   <div>
                    <p className="text-[9px] uppercase text-white/20 mb-1">Upcoming Alarm</p>
                    <p className="text-xl font-mono text-white/80 tracking-tighter">{alarms[0].time}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                </div>
              ) : (
                <p className="text-[10px] text-white/30 italic">No active temporal anchors.</p>
              )}
            </div>
        </div>

        {/* Module: Quick Actions */}
        <div className="glass tech-border rounded-2xl p-5 flex flex-col gap-4">
           <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Quick Deployment</p>
           <div className="grid grid-cols-2 gap-2">
              <button onClick={() => window.open('https://open.spotify.com', '_blank')} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg text-[10px] border border-white/5 transition-colors flex items-center justify-center gap-2">
                <Volume2 className="w-3 h-3 text-aura-accent" /> Spotify
              </button>
              <button onClick={() => window.open('https://calendar.google.com', '_blank')} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg text-[10px] border border-white/5 transition-colors flex items-center justify-center gap-2">
                <Clock className="w-3 h-3 text-aura-primary" /> Calendar
              </button>
              <button onClick={() => window.open('https://maps.google.com', '_blank')} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg text-[10px] border border-white/5 transition-colors flex items-center justify-center gap-2">
                <Cloud className="w-3 h-3 text-blue-400" /> Maps
              </button>
              <button onClick={() => setShowHistory(true)} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg text-[10px] border border-white/5 transition-colors flex items-center justify-center gap-2">
                <History className="w-3 h-3 text-aura-secondary" /> Logs
              </button>
           </div>
        </div>
      </footer>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 h-full w-full max-w-md glass z-50 p-8 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold">Interaction History</h2>
              <button 
                onClick={() => setShowHistory(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {history.length === 0 ? (
                <p className="text-white/30 text-center py-12 italic">No history yet. Start speaking!</p>
              ) : (
                history.map((event) => (
                  <div key={event.id} className="border-b border-white/5 pb-4">
                    <p className="text-xs text-white/30 mb-2 font-mono">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                    <p className="text-white/80 font-medium mb-1">
                      <span className="text-aura-secondary mr-2">You:</span>
                      {event.command}
                    </p>
                    <p className="text-white/60 text-sm italic">
                      <span className="text-aura-primary mr-2">Zephyr:</span>
                      {event.response}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

