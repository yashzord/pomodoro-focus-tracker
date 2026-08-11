export type PomodoroState = 'stopped' | 'running' | 'paused';
export type PomodoroMode = 'pomodoro' | 'shortBreak' | 'longBreak';

export interface Task {
  id: string;
  name: string;
  completed: boolean;
}

export interface DailyStats {
  date: string;
  pomodorosCompleted: number;
  focusTimeMinutes: number;
}

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class PomodoroTracker {
  private timerId: number | null = null;
  private _state: PomodoroState = 'stopped';
  private _mode: PomodoroMode = 'pomodoro';
  private _timeLeft: number;
  private _pomodoroDuration: number;
  private _shortBreakDuration: number;
  private _longBreakDuration: number;
  private _tasks: Task[] = [];
  private _dailyStats: DailyStats[] = [];

  constructor(
    pomodoroDuration: number = 25 * 60,
    shortBreakDuration: number = 5 * 60,
    longBreakDuration: number = 15 * 60
  ) {
    if (pomodoroDuration <= 0 || shortBreakDuration <= 0 || longBreakDuration <= 0) {
      throw new AppError('Durations must be positive numbers.');
    }
    this._pomodoroDuration = pomodoroDuration;
    this._shortBreakDuration = shortBreakDuration;
    this._longBreakDuration = longBreakDuration;
    this._timeLeft = this._pomodoroDuration;
    this.loadState();
  }

  get state(): PomodoroState { return this._state; }
  get mode(): PomodoroMode { return this._mode; }
  get timeLeft(): number { return this._timeLeft; }
  get tasks(): Task[] { return [...this._tasks]; }
  get dailyStats(): DailyStats[] { return [...this._dailyStats]; }

  private saveState(): void {
    localStorage.setItem('pomodoroTasks', JSON.stringify(this._tasks));
    localStorage.setItem('pomodoroDailyStats', JSON.stringify(this._dailyStats));
  }

  private loadState(): void {
    const storedTasks = localStorage.getItem('pomodoroTasks');
    if (storedTasks) {
      this._tasks = JSON.parse(storedTasks);
    }
    const storedStats = localStorage.getItem('pomodoroDailyStats');
    if (storedStats) {
      this._dailyStats = JSON.parse(storedStats);
    }
  }

  private updateDailyStats(pomodorosCompleted: number, focusTimeMinutes: number): void {
    const today = new Date().toISOString().split('T')[0];
    let statsForToday = this._dailyStats.find(s => s.date === today);
    if (statsForToday) {
      statsForToday.pomodorosCompleted += pomodorosCompleted;
      statsForToday.focusTimeMinutes += focusTimeMinutes;
    } else {
      this._dailyStats.push({ date: today, pomodorosCompleted, focusTimeMinutes });
    }
    this.saveState();
  }

  start(onTick: (timeLeft: number) => void, onComplete: () => void): void {
    if (this._state === 'running') return;
    this._state = 'running';
    this.timerId = setInterval(() => {
      this._timeLeft--;
      onTick(this._timeLeft);
      if (this._timeLeft <= 0) {
        this.stop();
        if (this._mode === 'pomodoro') {
          this.updateDailyStats(1, Math.floor(this._pomodoroDuration / 60));
        }
        onComplete();
      }
    }, 1000) as unknown as number;
  }

  pause(): void {
    if (this._state !== 'running') return;
    clearInterval(this.timerId!);
    this._state = 'paused';
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this._state = 'stopped';
  }

  reset(): void {
    this.stop();
    this.setMode(this._mode);
  }

  setMode(mode: PomodoroMode): void {
    this.stop();
    this._mode = mode;
    switch (mode) {
      case 'pomodoro':
        this._timeLeft = this._pomodoroDuration;
        break;
      case 'shortBreak':
        this._timeLeft = this._shortBreakDuration;
        break;
      case 'longBreak':
        this._timeLeft = this._longBreakDuration;
        break;
    }
  }

  addTask(name: string): void {
    if (!name.trim()) {
      throw new AppError('Task name cannot be empty.');
    }
    this._tasks.push({ id: Date.now().toString(), name, completed: false });
    this.saveState();
  }

  toggleTaskCompletion(id: string): void {
    const task = this._tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      this.saveState();
    }
  }

  deleteTask(id: string): void {
    this._tasks = this._tasks.filter(t => t.id !== id);
    this.saveState();
  }
}
