declare module 'react-native-background-timer' {
  const BackgroundTimer: {
    setTimeout(callback: (...args: any[]) => void, timeout: number): number;
    clearTimeout(id: number): void;
    setInterval(callback: (...args: any[]) => void, timeout: number): number;
    clearInterval(id: number): void;
    start(delay?: number): void;
    stop(): void;
    runBackgroundTimer(callback: (...args: any[]) => void, delay: number): void;
    stopBackgroundTimer(): void;
  };
  export default BackgroundTimer;
}
