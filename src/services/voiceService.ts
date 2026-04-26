export class VoiceService {
  private recognition: any = null;
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    
    // Attempt to find a "cool" voice
    const initVoices = () => {
      const voices = this.synth.getVoices();
      this.voice = voices.find(v => v.name.includes('Google US English')) || voices[0];
    };
    
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = initVoices;
    }
    initVoices();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
    }
  }

  listen(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject("STT not supported");

      this.recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        resolve(text);
      };

      this.recognition.onerror = (event: any) => {
        reject(event.error);
      };

      this.recognition.start();
    });
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) utterance.voice = this.voice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => resolve();
      this.synth.speak(utterance);
    });
  }

  stop() {
    if (this.recognition) this.recognition.stop();
    this.synth.cancel();
  }
}

export const voiceService = new VoiceService();
