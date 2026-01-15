const STORAGE_KEY = "lifeRpgState";
const XP_PER_LEVEL = 100;

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const xpInput = document.getElementById("xpInput");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");
const levelValue = document.getElementById("levelValue");
const totalXp = document.getElementById("totalXp");
const levelHint = document.getElementById("levelHint");
const levelProgress = document.getElementById("levelProgress");
const taskTemplate = document.getElementById("taskItemTemplate");

const defaultState = {
  tasks: [],
  totalXp: 0,
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...defaultState };
  }
  const parsed = JSON.parse(raw);
  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    totalXp: Number.isFinite(parsed.totalXp) ? parsed.totalXp : 0,
  };
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

let state = loadState();

const getLevelInfo = (xp) => {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const currentXp = xp % XP_PER_LEVEL;
  const nextLevelXp = XP_PER_LEVEL - currentXp;
  return { level, currentXp, nextLevelXp };
};

const renderStats = () => {
  const info = getLevelInfo(state.totalXp);
  levelValue.textContent = `Lv ${info.level}`;
  totalXp.textContent = `${state.totalXp} XP`;
  levelHint.textContent = `距離 Lv ${info.level + 1} 還需要 ${info.nextLevelXp} XP`;
  levelProgress.style.width = `${(info.currentXp / XP_PER_LEVEL) * 100}%`;
};

const updateTaskCount = () => {
  taskCount.textContent = `${state.tasks.length} 個任務`;
};

const renderTasks = () => {
  taskList.innerHTML = "";
  state.tasks.forEach((task) => {
    const fragment = taskTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".task");
    const checkbox = fragment.querySelector(".task__checkbox");
    const title = fragment.querySelector(".task__title");
    const xpBadge = fragment.querySelector(".task__xp");
    const deleteButton = fragment.querySelector(".task__delete");

    checkbox.checked = task.completed;
    title.textContent = task.title;
    if (task.completed) {
      title.classList.add("task__title--done");
    }
    xpBadge.textContent = `+${task.xp} XP`;

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      if (task.completed) {
        state.totalXp += task.xp;
      } else {
        state.totalXp = Math.max(0, state.totalXp - task.xp);
      }
      saveState(state);
      render();
    });

    deleteButton.addEventListener("click", () => {
      if (task.completed) {
        state.totalXp = Math.max(0, state.totalXp - task.xp);
      }
      state.tasks = state.tasks.filter((itemTask) => itemTask.id !== task.id);
      saveState(state);
      render();
    });

    taskList.appendChild(item);
  });
  updateTaskCount();
};

const addTask = (title, xp) => {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  const safeXp = Math.max(1, Number(xp) || 1);
  state.tasks.unshift({
    id: crypto.randomUUID(),
    title: trimmed,
    xp: safeXp,
    completed: false,
  });
  saveState(state);
  render();
};

const render = () => {
  renderStats();
  renderTasks();
};

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(taskInput.value, xpInput.value);
  taskInput.value = "";
  taskInput.focus();
});

render();
