import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PomodoroTracker, InvalidConfigError, TaskNotFoundError, TaskError } from "./app";

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

describe("PomodoroTracker", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("should initialize with default durations and 'stopped' state", () => {
    const tracker = new PomodoroTracker();
    expect(tracker.state).toBe("stopped");
    expect(tracker.mode).toBe("pomodoro");
    expect(tracker.timeLeft).toBe(25 * 60);
  });

  it("should throw InvalidConfigError for non-positive durations", () => {
    expect(() => new PomodoroTracker(0, 5, 15)).toThrow(InvalidConfigError);
    expect(() => new PomodoroTracker(25, -5, 15)).toThrow(InvalidConfigError);
  });

  it("should start the timer and decrement timeLeft", () => {
    const tracker = new PomodoroTracker(10, 5, 15);
    const onTick = vi.fn();
    const onComplete = vi.fn();

    tracker.start(onTick, onComplete);
    expect(tracker.state).toBe("running");
    expect(onTick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(tracker.timeLeft).toBe(9);
    expect(onTick).toHaveBeenCalledWith(9);

    vi.advanceTimersByTime(5000);
    expect(tracker.timeLeft).toBe(4);
    expect(onTick).toHaveBeenCalledWith(4);
  });

  it("should pause the timer and maintain timeLeft", () => {
    const tracker = new PomodoroTracker(10, 5, 15);
    const onTick = vi.fn();
    const onComplete = vi.fn();

    tracker.start(onTick, onComplete);
    vi.advanceTimersByTime(3000);
    expect(tracker.timeLeft).toBe(7);

    tracker.pause();
    expect(tracker.state).toBe("paused");
    vi.advanceTimersByTime(5000); // Should not decrement while paused
    expect(tracker.timeLeft).toBe(7);
  });

  it("should resume the timer from the paused state", () => {
    const tracker = new PomodoroTracker(10, 5, 15);
    const onTick = vi.fn();
    const onComplete = vi.fn();

    tracker.start(onTick, onComplete);
    vi.advanceTimersByTime(3000);
    tracker.pause();
    expect(tracker.timeLeft).toBe(7);

    tracker.resume(onTick, onComplete);
    expect(tracker.state).toBe("running");
    vi.advanceTimersByTime(1000);
    expect(tracker.timeLeft).toBe(6);
    expect(onTick).toHaveBeenCalledWith(6);
  });

  it("should stop the timer and reset timeLeft to initial mode duration", () => {
    const tracker = new PomodoroTracker(10, 5, 15);
    const onTick = vi.fn();
    const onComplete = vi.fn();

    tracker.start(onTick, onComplete);
    vi.advanceTimersByTime(3000);
    expect(tracker.timeLeft).toBe(7);

    tracker.stop();
    expect(tracker.state).toBe("stopped");
    expect(tracker.timeLeft).toBe(10);
    vi.advanceTimersByTime(5000); // Should not decrement after stopping
    expect(tracker.timeLeft).toBe(10);
  });

  it("should call onComplete when timer finishes and update daily stats", () => {
    const tracker = new PomodoroTracker(3, 5, 15);
    const onTick = vi.fn();
    const onComplete = vi.fn();

    tracker.start(onTick, onComplete);
    vi.advanceTimersByTime(3000);

    // On completion the tracker stops and resets timeLeft for the next run.
    expect(tracker.timeLeft).toBe(3);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(tracker.state).toBe("stopped");
    expect(tracker.sessions.length).toBe(1);
    expect(tracker.sessions[0].duration).toBe(3);
    expect(tracker.getDailyStats(new Date())?.pomodorosCompleted).toBe(1);
    expect(tracker.getDailyStats(new Date())?.focusTimeMinutes).toBe(0); // 3 seconds is 0 minutes
  });

  it("should add a task and retrieve it", () => {
    const tracker = new PomodoroTracker();
    const taskName = "Buy groceries";
    const task = tracker.addTask(taskName);

    expect(task).toHaveProperty("id");
    expect(task.name).toBe(taskName);
    expect(task.completed).toBe(false);
    expect(tracker.tasks).toContainEqual(task);
  });

  it("should throw TaskError when adding a task with an empty name", () => {
    const tracker = new PomodoroTracker();
    expect(() => tracker.addTask("")).toThrow(TaskError);
    expect(() => tracker.addTask("   ")).toThrow(TaskError);
  });

  it("should update an existing task", () => {
    const tracker = new PomodoroTracker();
    const task = tracker.addTask("Original Name");
    const updatedTask = tracker.updateTask(task.id, { name: "New Name", completed: true });

    expect(updatedTask.name).toBe("New Name");
    expect(updatedTask.completed).toBe(true);
    expect(tracker.tasks.find((t) => t.id === task.id)).toEqual(updatedTask);
  });

  it("should throw TaskNotFoundError when updating a non-existent task", () => {
    const tracker = new PomodoroTracker();
    expect(() => tracker.updateTask("non-existent-id", { name: "New Name" })).toThrow(TaskNotFoundError);
  });

  it("should delete a task", () => {
    const tracker = new PomodoroTracker();
    const task1 = tracker.addTask("Task 1");
    const task2 = tracker.addTask("Task 2");

    tracker.deleteTask(task1.id);
    expect(tracker.tasks).not.toContainEqual(task1);
    expect(tracker.tasks).toContainEqual(task2);
    expect(tracker.tasks.length).toBe(1);
  });

  it("should throw TaskNotFoundError when deleting a non-existent task", () => {
    const tracker = new PomodoroTracker();
    tracker.addTask("Existing Task");
    expect(() => tracker.deleteTask("non-existent-id")).toThrow(TaskNotFoundError);
  });

  it("should toggle task completion status", () => {
    const tracker = new PomodoroTracker();
    const task = tracker.addTask("Toggle me");
    expect(task.completed).toBe(false);

    const toggledTask1 = tracker.toggleTaskCompletion(task.id);
    expect(toggledTask1.completed).toBe(true);

    const toggledTask2 = tracker.toggleTaskCompletion(task.id);
    expect(toggledTask2.completed).toBe(false);
  });

  it("should throw TaskNotFoundError when toggling completion of a non-existent task", () => {
    const tracker = new PomodoroTracker();
    expect(() => tracker.toggleTaskCompletion("non-existent-id")).toThrow(TaskNotFoundError);
  });

  it("should set mode and reset time accordingly", () => {
    const tracker = new PomodoroTracker(10, 20, 30);
    expect(tracker.mode).toBe("pomodoro");
    expect(tracker.timeLeft).toBe(10);

    tracker.setMode("shortBreak");
    expect(tracker.mode).toBe("shortBreak");
    expect(tracker.timeLeft).toBe(20);

    tracker.setMode("longBreak");
    expect(tracker.mode).toBe("longBreak");
    expect(tracker.timeLeft).toBe(30);

    tracker.setMode("pomodoro");
    expect(tracker.mode).toBe("pomodoro");
    expect(tracker.timeLeft).toBe(10);
  });

  it("should save and load tasks from localStorage", () => {
    const tracker1 = new PomodoroTracker();
    tracker1.addTask("Task A");
    tracker1.addTask("Task B");

    const tracker2 = new PomodoroTracker(); // Should load state from localStorage
    expect(tracker2.tasks.length).toBe(2);
    expect(tracker2.tasks[0].name).toBe("Task A");
    expect(tracker2.tasks[1].name).toBe("Task B");
  });

  it("should save and load sessions from localStorage", () => {
    const tracker1 = new PomodoroTracker(1, 1, 1);
    const onTick = vi.fn();
    const onComplete = vi.fn();

    tracker1.start(onTick, onComplete);
    vi.advanceTimersByTime(1000);

    const tracker2 = new PomodoroTracker(); // Should load state from localStorage
    expect(tracker2.sessions.length).toBe(1);
    expect(tracker2.sessions[0].mode).toBe("pomodoro");
    expect(tracker2.sessions[0].duration).toBe(1);
  });

  it("should save and load daily stats from localStorage", () => {
    const tracker1 = new PomodoroTracker(1, 1, 1);
    const onTick = vi.fn();
    const onComplete = vi.fn();

    tracker1.start(onTick, onComplete);
    vi.advanceTimersByTime(1000);

    const tracker2 = new PomodoroTracker(); // Should load state from localStorage
    const today = new Date();
    const stats = tracker2.getDailyStats(today);
    expect(stats).toBeDefined();
    expect(stats?.pomodorosCompleted).toBe(1);
    expect(stats?.focusTimeMinutes).toBe(0); // 1 second is 0 minutes
  });

  it("should handle corrupted localStorage data gracefully for tasks", () => {
    localStorage.setItem('pomodoroTasks', 'invalid json');
    const tracker = new PomodoroTracker();
    expect(tracker.tasks).toEqual([]);
  });

  it("should handle corrupted localStorage data gracefully for daily stats", () => {
    localStorage.setItem('pomodoroDailyStats', 'invalid json');
    const tracker = new PomodoroTracker();
    expect(tracker.dailyStats).toEqual([]);
  });

  it("should handle corrupted localStorage data gracefully for sessions", () => {
    localStorage.setItem('pomodoroSessions', 'invalid json');
    const tracker = new PomodoroTracker();
    expect(tracker.sessions).toEqual([]);
  });
});
