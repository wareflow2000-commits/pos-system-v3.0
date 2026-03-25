
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
};

export const playSuccessSound = () => {
  playTone(880, 0.2); // High beep
  setTimeout(() => playTone(1100, 0.3), 200);
};

export const playErrorSound = () => {
  playTone(200, 0.4, 'sawtooth'); // Low buzz
};

export const playScanSound = () => {
  playTone(600, 0.1); // Short beep
};
