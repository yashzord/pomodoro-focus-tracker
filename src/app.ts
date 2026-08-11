export type PomodoroState = 'stopped' | 'running' | 'paused';
export type PomodoroMode = 'pomodoro' | 'shortBreak' | 'longBreak';

export interface Task {
  id: string;
  name: string;
  completed: boolean;
}

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  startTime: Date;
  endTime: Date | null;
  duration: number; // in seconds
  mode: PomodoroMode;
}

export interface DailyStats {
  date: Date;
  pomodorosCompleted: number;
  focusTimeMinutes: number;
}

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class InvalidConfigError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

export class TaskError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'TaskError';
  }
}

export class TaskNotFoundError extends TaskError {
  constructor(taskId: string) {
    super(`Task with ID '${taskId}' not found.`);
    this.name = 'TaskNotFoundError';
  }
}

export class PomodoroTracker {
  private timerId: number | null = null;
  private idCounter = 0;
  private _state: PomodoroState = 'stopped';
  private _mode: PomodoroMode = 'pomodoro';
  private _timeLeft: number;
  private _pomodoroDuration: number;
  private _shortBreakDuration: number;
  private _longBreakDuration: number;
  private _tasks: Task[] = [];
  private _dailyStats: DailyStats[] = [];
  private _sessions: PomodoroSession[] = [];
  private _currentSession: PomodoroSession | null = null;

  constructor(
    pomodoroDuration: number = 25 * 60,
    shortBreakDuration: number = 5 * 60,
    longBreakDuration: number = 15 * 60
  ) {
    if (pomodoroDuration <= 0 || shortBreakDuration <= 0 || longBreakDuration <= 0) {
      throw new InvalidConfigError('Durations must be positive numbers.');
    }
    this._pomodoroDuration = pomodoroDuration;
    this._shortBreakDuration = shortBreakDuration;
    this._longBreakDuration = longBreakDuration;
    this._timeLeft = this._pomodoroDuration;
    this.loadState();
  }

  // Date.now() alone collides when two entities are created in the same
  // millisecond; a per-instance counter keeps ids unique.
  private nextId(): string {
    return `${Date.now().toString(36)}-${(this.idCounter++).toString(36)}`;
  }

  get state(): PomodoroState { return this._state; }
  get mode(): PomodoroMode { return this._mode; }
  get timeLeft(): number { return this._timeLeft; }
  get tasks(): Task[] { return [...this._tasks]; }
  get dailyStats(): DailyStats[] { return [...this._dailyStats]; }
  get sessions(): PomodoroSession[] { return [...this._sessions]; }

  private saveState(): void {
    localStorage.setItem('pomodoroTasks', JSON.stringify(this._tasks));
    localStorage.setItem('pomodoroDailyStats', JSON.stringify(this._dailyStats.map(s => ({ ...s, date: s.date.toISOString() }))));
    localStorage.setItem('pomodoroSessions', JSON.stringify(this._sessions.map(s => ({
      ...s,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime ? s.endTime.toISOString() : null
    }))));
  }

  private loadState(): void {
    try {
      const storedTasks = localStorage.getItem('pomodoroTasks');
      this._tasks = storedTasks ? JSON.parse(storedTasks) : [];
    } catch (e) {
      console.error('Error parsing stored tasks, resetting:', e);
      this._tasks = [];
    }

    try {
      const storedStats = localStorage.getItem('pomodoroDailyStats');
      this._dailyStats = storedStats ? JSON.parse(storedStats).map((s: any) => ({ ...s, date: new Date(s.date) })) : [];
    } catch (e) {
      console.error('Error parsing stored daily stats, resetting:', e);
      this._dailyStats = [];
    }

    try {
      const storedSessions = localStorage.getItem('pomodoroSessions');
      this._sessions = storedSessions ? JSON.parse(storedSessions).map((s: any) => ({
        ...s,
        startTime: new Date(s.startTime),
        endTime: s.endTime ? new Date(s.endTime) : null
      })) : [];
    } catch (e) {
      console.error('Error parsing stored sessions, resetting:', e);
      this._sessions = [];
    }
  }

  private updateDailyStats(): void {
    this._dailyStats = []; // Recalculate daily stats from sessions
    const dailyStatsMap = new Map<string, DailyStats>();

    this._sessions.forEach(session => {
      if (session.mode === 'pomodoro' && session.endTime) {
        const dateKey = session.startTime.toISOString().split('T')[0];
        let stats = dailyStatsMap.get(dateKey);
        if (!stats) {
          stats = { date: new Date(dateKey), pomodorosCompleted: 0, focusTimeMinutes: 0 };
          dailyStatsMap.set(dateKey, stats);
        }
        stats.pomodorosCompleted += 1;
        stats.focusTimeMinutes += Math.floor(session.duration / 60);
      }
    });
    this._dailyStats = Array.from(dailyStatsMap.values());
    this.saveState();
  }

  getDailyStats(date: Date): DailyStats | undefined {
    const dateKey = date.toISOString().split('T')[0];
    return this._dailyStats.find(s => s.date.toISOString().split('T')[0] === dateKey);
  }

  start(onTick: (timeLeft: number) => void, onComplete: () => void, taskId: string | null = null): void {
    if (this._state === 'running') return;

    this._state = 'running';
    this._currentSession = {
      id: this.nextId(),
      taskId: taskId,
      startTime: new Date(),
      endTime: null,
      duration: 0,
      mode: this._mode
    };

    this.timerId = setInterval(() => {
      this._timeLeft--;
      if (this._currentSession) {
        this._currentSession.duration++;
      }
      onTick(this._timeLeft);

      if (this._timeLeft <= 0) {
        // Capture the session before stop(), which discards _currentSession —
        // otherwise completed sessions are never recorded.
        const completedSession = this._currentSession;
        this._currentSession = null;
        this.stop();
        if (completedSession) {
          completedSession.endTime = new Date();
          this._sessions.push(completedSession);
          this.updateDailyStats();
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

  resume(onTick: (timeLeft: number) => void, onComplete: () => void): void {
    if (this._state !== 'paused') return;
    this.start(onTick, onComplete, this._currentSession?.taskId);
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this._state === 'running' || this._state === 'paused') {
      if (this._currentSession) {
        // If stopped before completion, don't count it as a full session
        // Optionally, could save partial sessions or discard.
        // For now, we discard if not completed.
        this._currentSession = null;
      }
    }
    this._state = 'stopped';
    this.resetTime();
  }

  resetTime(): void {
    switch (this._mode) {
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

  setMode(mode: PomodoroMode): void {
    this.stop(); // Stop any running timer first
    this._mode = mode;
    this.resetTime();
  }

  addTask(name: string): Task {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new TaskError('Task name cannot be empty.');
    }
    const newTask: Task = { id: this.nextId(), name: trimmedName, completed: false };
    this._tasks.push(newTask);
    this.saveState();
    return newTask;
  }

  updateTask(id: string, updates: Partial<Task>): Task {
    const taskIndex = this._tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) {
      throw new TaskNotFoundError(id);
    }
    this._tasks[taskIndex] = { ...this._tasks[taskIndex], ...updates };
    this.saveState();
    return this._tasks[taskIndex];
  }

  deleteTask(id: string): void {
    const initialLength = this._tasks.length;
    this._tasks = this._tasks.filter(t => t.id !== id);
    if (this._tasks.length === initialLength) {
      throw new TaskNotFoundError(id);
    }
    this.saveState();
  }

  toggleTaskCompletion(id: string): Task {
    const task = this._tasks.find(t => t.id === id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }
    task.completed = !task.completed;
    this.saveState();
    return task;
  }
}
