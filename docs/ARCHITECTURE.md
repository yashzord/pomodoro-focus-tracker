# Architecture — Pomodoro Focus & Task Tracker

## Architecture Document: Pomodoro Focus & Task Tracker

This document outlines the architecture for the "Pomodoro Focus & Task Tracker" web application, a client-side tool for managing pomodoro sessions and daily tasks.

## System Overview

The application is a single-page web application served from a static host. The `index.html` file contains the entire user interface, including styles, and bootstraps the application logic via `main.ts`. `main.ts` acts as the DOM manipulation layer, interacting with the core application logic provided by `app.ts`.

```
index.html
    ├── <style> (inline CSS)
    ├── <script type="module" src="./src/main.ts"></script>
    └── HTML Structure
            ↓
src/main.ts (DOM Layer, Event Handling)
            ↓
src/app.ts (Core Logic, Business Rules)
```

## Logic Core Design (`src/app.ts`)

The `src/app.ts` module provides the core business logic, entirely self-contained without external dependencies.

**Exported Types:**

*   `Task`: `{ id: string; name: string; completed: boolean; pomodoros: number; }`
*   `PomodoroSession`: `{ id: string; taskId: string | null; startTime: number; endTime: number; duration: number; }`
*   `DailyStats`: `{ date: string; totalPomodoros: number; totalFocusTime: number; tasksCompleted: number; }`
*   `AppError`: Custom error class for application-specific errors (e.g., `InvalidInputError`).

**Exported Functions:**

*   `initializeAppData(): { tasks: Task[]; sessions: PomodoroSession[]; }`
*   `addTask(name: string): Task`
*   `updateTask(id: string, updates: Partial<Task>): Task`
*   `deleteTask(id: string): void`
*   `startPomodoro(taskId: string | null): PomodoroSession`
*   `stopPomodoro(sessionId: string): PomodoroSession`
*   `getDailyStats(date: string): DailyStats`
*   `getAllTasks(): Task[]`
*   `getAllPomodoroSessions(): PomodoroSession[]`

## UI Design (`index.html`)

The `index.html` provides a responsive, dark-themed interface.

**Main Screens/Controls:**

*   **Pomodoro Timer Display:** Large, central display showing remaining time, with start/pause/reset buttons.
*   **Current Task Indicator:** Displays the name of the task currently associated with the active Pomodoro.
*   **Task List:**
    *   Input field for adding new tasks.
    *   List of daily tasks with checkboxes for completion.
    *   Each task item includes its name, number of associated Pomodoros, and a button to link/unlink to the current Pomodoro.
*   **Daily Stats Section:** Displays "Total Pomodoros," "Total Focus Time," and "Tasks Completed" for the current day.

**Interaction Flow:**

1.  User adds tasks via the input field.
2.  User starts a Pomodoro. They can optionally link it to an existing task.
3.  Timer counts down; user can pause/resume.
4.  Upon completion, the Pomodoro session is recorded, and daily stats are updated.
5.  Tasks can be marked complete, updating stats.

## State & Persistence

*   **In-Memory State:**
    *   Current Pomodoro timer state (running/paused, remaining time).
    *   Currently active Pomodoro session ID.
    *   Temporary UI states (e.g., input field values).
*   **`localStorage` Persistence:**
    *   `tasks`: Array of `Task` objects.
    *   `pomodoroSessions`: Array of `PomodoroSession` objects.
    *   These are loaded on application startup and saved after any modifying operation.

## Key Risks

1.  **Risk: Data Corruption in `localStorage`**: Malformed or unexpected data in `localStorage` could lead to application crashes or incorrect behavior.
    *   **Mitigation**: `app.ts` functions will include robust input validation and defensive parsing when loading data from `localStorage`, using default values or clearing corrupted entries if necessary.
2.  **Risk: Timer Inaccuracy/Drift**: Browser tab inactivity or system clock changes could affect the accuracy of the Pomodoro timer.
    *   **Mitigation**: The timer logic in `main.ts` will calculate remaining time based on `Date.now()` and the session's `startTime` rather than purely decrementing an interval, minimizing drift. Consider `requestAnimationFrame` for smoother updates.
3.  **Risk: UI Responsiveness with Complex Task Lists**: A large number of tasks or sessions could lead to slow DOM updates, impacting user experience.
    *   **Mitigation**: For current scope, this is unlikely. If it becomes an issue, `main.ts` will implement virtual scrolling or partial DOM updates, but this is deferred given the "no frameworks" constraint. Focus on efficient DOM manipulation for now.
