import { PomodoroTracker, PomodoroState, PomodoroMode, Task, DailyStats, AppError } from './app';

const timerDisplay = document.getElementById('timer-display') as HTMLDivElement;
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const pauseButton = document.getElementById('pause-button') as HTMLButtonElement;
const stopButton = document.getElementById('stop-button') as HTMLButtonElement;
const pomodoroButton = document.getElementById('pomodoro-mode') as HTMLButtonElement;
const shortBreakButton = document.getElementById('short-break-mode') as HTMLButtonElement;
const longBreakButton = document.getElementById('long-break-mode') as HTMLButtonElement;
const taskInput = document.getElementById('task-input') as HTMLInputElement;
const addTaskButton = document.getElementById('add-task-button') as HTMLButtonElement;
const taskList = document.getElementById('task-list') as HTMLUListElement;
const statsDisplay = document.getElementById('stats-display') as HTMLDivElement;

let tracker: PomodoroTracker;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateTimerDisplay(timeLeft: number): void {
  timerDisplay.textContent = formatTime(timeLeft);
}

function updateControls(state: PomodoroState): void {
  startButton.disabled = state === 'running';
  pauseButton.disabled = state !== 'running';
  stopButton.disabled = state === 'stopped';
}

function renderTasks(tasks: Task[]): void {
  taskList.innerHTML = '';
  if (tasks.length === 0) {
    taskList.innerHTML = '<li class="no-tasks">No tasks yet!</li>';
    return;
  }
  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.innerHTML = `
      <input type="checkbox" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
      <span>${task.name}</span>
      <button class="delete-task" data-task-id="${task.id}">✖</button>
    `;
    taskList.appendChild(li);
  });
}

function renderStats(stats: DailyStats[]): void {
  const today = new Date().toISOString().split('T')[0];
  const todayStats = stats.find(s => s.date === today);
  if (todayStats) {
    statsDisplay.textContent = `Today: ${todayStats.pomodorosCompleted} Pomodoros, ${todayStats.focusTimeMinutes} min focus`;
  } else {
    statsDisplay.textContent = 'Today: 0 Pomodoros, 0 min focus';
  }
}

function setModeButtonActive(mode: PomodoroMode): void {
  [pomodoroButton, shortBreakButton, longBreakButton].forEach(btn => {
    btn.classList.remove('active');
  });
  switch (mode) {
    case 'pomodoro': pomodoroButton.classList.add('active'); break;
    case 'shortBreak': shortBreakButton.classList.add('active'); break;
    case 'longBreak': longBreakButton.classList.add('active'); break;
  }
}

function initializeApp(): void {
  try {
    tracker = new PomodoroTracker();
    updateTimerDisplay(tracker.timeLeft);
    updateControls(tracker.state);
    renderTasks(tracker.tasks);
    renderStats(tracker.dailyStats);
    setModeButtonActive(tracker.mode);
  } catch (error) {
    if (error instanceof AppError) {
      console.error('Initialization Error:', error.message);
      alert(`Error initializing app: ${error.message}`);
    } else {
      console.error('An unexpected error occurred:', error);
      alert('An unexpected error occurred during initialization.');
    }
  }
}

startButton.addEventListener('click', () => {
  tracker.start(updateTimerDisplay, () => {
    alert(`${tracker.mode === 'pomodoro' ? 'Pomodoro' : 'Break'} finished!`);
    tracker.setMode(tracker.mode === 'pomodoro' ? 'shortBreak' : 'pomodoro'); // Simple cycle
    updateTimerDisplay(tracker.timeLeft);
    updateControls(tracker.state);
    renderStats(tracker.dailyStats);
    setModeButtonActive(tracker.mode);
  });
  updateControls(tracker.state);
});

pauseButton.addEventListener('click', () => {
  tracker.pause();
  updateControls(tracker.state);
});

stopButton.addEventListener('click', () => {
  tracker.stop();
  tracker.reset();
  updateTimerDisplay(tracker.timeLeft);
  updateControls(tracker.state);
});

pomodoroButton.addEventListener('click', () => {
  tracker.setMode('pomodoro');
  updateTimerDisplay(tracker.timeLeft);
  updateControls(tracker.state);
  setModeButtonActive('pomodoro');
});

shortBreakButton.addEventListener('click', () => {
  tracker.setMode('shortBreak');
  updateTimerDisplay(tracker.timeLeft);
  updateControls(tracker.state);
  setModeButtonActive('shortBreak');
});

longBreakButton.addEventListener('click', () => {
  tracker.setMode('longBreak');
  updateTimerDisplay(tracker.timeLeft);
  updateControls(tracker.state);
  setModeButtonActive('longBreak');
});

addTaskButton.addEventListener('click', () => {
  const taskName = taskInput.value;
  try {
    tracker.addTask(taskName);
    taskInput.value = '';
    renderTasks(tracker.tasks);
  } catch (error) {
    if (error instanceof AppError) {
      alert(`Error adding task: ${error.message}`);
    } else {
      console.error('Error adding task:', error);
    }
  }
});

taskList.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const taskId = target.dataset.taskId;

  if (taskId) {
    if (target.matches('input[type="checkbox"]')) {
      tracker.toggleTaskCompletion(taskId);
      renderTasks(tracker.tasks);
    } else if (target.matches('.delete-task')) {
      tracker.deleteTask(taskId);
      renderTasks(tracker.tasks);
    }
  }
});

document.addEventListener('DOMContentLoaded', initializeApp);
