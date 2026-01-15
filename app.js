const STORAGE_KEY = "lifeRpgState";
const XP_PER_LEVEL = 100;
const DAILY_TASKS = [
  { id: "daily-exercise", title: "運動 30 分鐘", xp: 30 },
  { id: "daily-create", title: "剪輯 1 支影片", xp: 40 },
  { id: "daily-learn", title: "學習 30 分鐘", xp: 30 },
];
const ACHIEVEMENTS = [
  { id: "first-task", title: "第一次完成任務" },
  { id: "streak-3", title: "第一次連續 3 天" },
  { id: "streak-7", title: "第一次連續 7 天" },
  { id: "level-5", title: "第一次升到 Lv5" },
  { id: "level-10", title: "第一次升到 Lv10" },
];

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const xpInput = document.getElementById("xpInput");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");
const levelValue = document.getElementById("levelValue");
const totalXp = document.getElementById("totalXp");
const levelHint = document.getElementById("levelHint");
const levelProgress = document.getElementById("levelProgress");
const levelMultiplier = document.getElementById("levelMultiplier");
const streakDisplay = document.getElementById("streakDisplay");
const dailyTaskList = document.getElementById("dailyTaskList");
const dailyHistoryList = document.getElementById("dailyHistoryList");
const dailyDate = document.getElementById("dailyDate");
const dailyHistoryTitle = document.getElementById("dailyHistoryTitle");
const achievementGrid = document.getElementById("achievementGrid");
const shareButton = document.getElementById("shareButton");
const shareDownload = document.getElementById("shareDownload");
const shareCanvas = document.getElementById("shareCanvas");
const taskTemplate = document.getElementById("taskItemTemplate");
const dailyTaskTemplate = document.getElementById("dailyTaskTemplate");
const achievementTemplate = document.getElementById("achievementTemplate");

const defaultState = {
  tasks: [],
  totalXp: 0,
  daily: {
    date: null,
    tasks: [],
    completedCount: 0,
    history: null,
  },
  streak: {
    count: 0,
    lastCompletedDate: null,
  },
  achievements: {},
  share: {
    lastGeneratedAt: null,
  },
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...defaultState };
  }
  const parsed = JSON.parse(raw);
  return {
    ...defaultState,
    ...parsed,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    totalXp: Number.isFinite(parsed.totalXp) ? parsed.totalXp : 0,
    daily: {
      ...defaultState.daily,
      ...parsed.daily,
      tasks: Array.isArray(parsed.daily?.tasks) ? parsed.daily.tasks : [],
    },
    streak: {
      ...defaultState.streak,
      ...parsed.streak,
    },
    achievements: parsed.achievements || {},
    share: {
      ...defaultState.share,
      ...parsed.share,
    },
  };
};

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

let state = loadState();

const formatDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateKey) => {
  if (!dateKey) return "";
  const [year, month, day] = dateKey.split("-");
  return `${year}/${month}/${day}`;
};

const getLevelInfo = (xp) => {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const currentXp = xp % XP_PER_LEVEL;
  const nextLevelXp = XP_PER_LEVEL - currentXp;
  return { level, currentXp, nextLevelXp };
};

const getEffectiveStreak = () => {
  const todayKey = formatDateKey();
  if (state.streak.lastCompletedDate === todayKey) {
    return state.streak.count;
  }
  if (state.daily.date === todayKey && state.daily.completedCount > 0) {
    return state.streak.count + 1;
  }
  return state.streak.count;
};

const getStreakMultiplier = () => {
  const streak = getEffectiveStreak();
  if (streak >= 14) return 2;
  if (streak >= 7) return 1.5;
  if (streak >= 3) return 1.2;
  return 1;
};

const updateDailyForToday = () => {
  const todayKey = formatDateKey();
  if (state.daily.date === todayKey && state.daily.tasks.length > 0) {
    return;
  }

  if (state.daily.date && state.daily.date !== todayKey) {
    const hadCompletion = state.daily.completedCount > 0;
    const updatedTasks = state.daily.tasks.map((task) => {
      if (!task.completed) {
        return { ...task, status: "failed" };
      }
      return { ...task, status: "completed" };
    });
    state.daily.history = {
      date: state.daily.date,
      tasks: updatedTasks,
    };

    if (hadCompletion) {
      if (state.streak.lastCompletedDate === state.daily.date) {
        // streak already accounted for this day
      } else if (state.streak.lastCompletedDate) {
        const lastDate = new Date(state.streak.lastCompletedDate);
        const prevDate = new Date(state.daily.date);
        const diffDays =
          (prevDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          state.streak.count += 1;
        } else {
          state.streak.count = 1;
        }
      } else {
        state.streak.count = 1;
      }
      state.streak.lastCompletedDate = state.daily.date;
    } else {
      state.streak.count = 0;
      state.streak.lastCompletedDate = null;
    }
  }

  state.daily.date = todayKey;
  state.daily.completedCount = 0;
  state.daily.tasks = DAILY_TASKS.map((task) => ({
    ...task,
    completed: false,
    status: "pending",
    earnedXp: 0,
  }));
};

const renderStats = () => {
  const info = getLevelInfo(state.totalXp);
  levelValue.textContent = `Lv ${info.level}`;
  totalXp.textContent = `${state.totalXp} XP`;
  levelHint.textContent = `距離 Lv ${info.level + 1} 還需要 ${info.nextLevelXp} XP`;
  levelProgress.style.width = `${(info.currentXp / XP_PER_LEVEL) * 100}%`;
  levelMultiplier.textContent = `倍率 x${getStreakMultiplier().toFixed(1)}`;
  streakDisplay.textContent = `連續 ${getEffectiveStreak()} 天`;
  dailyDate.textContent = `今日任務 ${formatDateLabel(state.daily.date)}`;
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
      toggleTaskCompletion(task, checkbox.checked);
    });

    deleteButton.addEventListener("click", () => {
      removeTask(task.id);
    });

    taskList.appendChild(item);
  });
  updateTaskCount();
};

const renderDailyTasks = () => {
  dailyTaskList.innerHTML = "";
  state.daily.tasks.forEach((task) => {
    const fragment = dailyTaskTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".task");
    const checkbox = fragment.querySelector(".task__checkbox");
    const title = fragment.querySelector(".task__title");
    const xpBadge = fragment.querySelector(".task__xp");
    const status = fragment.querySelector(".task__status");

    checkbox.checked = task.completed;
    title.textContent = task.title;
    xpBadge.textContent = `+${task.xp} XP`;

    if (task.status === "failed") {
      title.classList.add("task__title--failed");
      status.textContent = "失敗";
      status.classList.add("task__status--failed");
      checkbox.disabled = true;
    } else if (task.completed) {
      title.classList.add("task__title--done");
      status.textContent = "完成";
      status.classList.add("task__status--done");
    } else {
      status.textContent = "待完成";
    }

    checkbox.addEventListener("change", () => {
      toggleDailyTaskCompletion(task, checkbox.checked);
    });

    dailyTaskList.appendChild(item);
  });
};

const renderDailyHistory = () => {
  dailyHistoryList.innerHTML = "";
  if (!state.daily.history) {
    dailyHistoryTitle.textContent = "昨日結果";
    const placeholder = document.createElement("li");
    placeholder.className = "task";
    placeholder.textContent = "昨日尚未有任務紀錄";
    dailyHistoryList.appendChild(placeholder);
    return;
  }
  dailyHistoryTitle.textContent = `昨日結果 ${formatDateLabel(state.daily.history.date)}`;
  state.daily.history.tasks.forEach((task) => {
    const fragment = dailyTaskTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".task");
    const title = fragment.querySelector(".task__title");
    const xpBadge = fragment.querySelector(".task__xp");
    const status = fragment.querySelector(".task__status");
    const checkbox = fragment.querySelector(".task__checkbox");

    title.textContent = task.title;
    xpBadge.textContent = `+${task.xp} XP`;
    checkbox.disabled = true;
    checkbox.style.display = "none";

    if (task.status === "failed") {
      title.classList.add("task__title--failed");
      status.textContent = "失敗";
      status.classList.add("task__status--failed");
    } else {
      title.classList.add("task__title--done");
      status.textContent = "完成";
      status.classList.add("task__status--done");
    }

    dailyHistoryList.appendChild(item);
  });
};

const renderAchievements = () => {
  achievementGrid.innerHTML = "";
  ACHIEVEMENTS.forEach((achievement) => {
    const fragment = achievementTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".achievement");
    const title = fragment.querySelector(".achievement__title");
    const status = fragment.querySelector(".achievement__status");
    const record = state.achievements[achievement.id];

    title.textContent = achievement.title;
    if (record?.unlockedAt) {
      status.textContent = `已解鎖 · ${record.unlockedAt}`;
      card.classList.add("achievement--unlocked");
    } else {
      status.textContent = "未解鎖";
    }
    achievementGrid.appendChild(card);
  });
};

const toggleTaskCompletion = (task, completed) => {
  task.completed = completed;
  if (completed) {
    const earnedXp = Math.round(task.xp * getStreakMultiplier());
    task.earnedXp = earnedXp;
    state.totalXp += earnedXp;
    unlockAchievement("first-task");
  } else if (task.earnedXp) {
    state.totalXp = Math.max(0, state.totalXp - task.earnedXp);
    task.earnedXp = 0;
  }
  saveState(state);
  render();
};

const toggleDailyTaskCompletion = (task, completed) => {
  if (task.status === "failed") {
    return;
  }
  task.completed = completed;
  if (completed) {
    const earnedXp = Math.round(task.xp * getStreakMultiplier());
    task.earnedXp = earnedXp;
    state.totalXp += earnedXp;
    state.daily.completedCount += 1;
    unlockAchievement("first-task");
  } else if (task.earnedXp) {
    state.totalXp = Math.max(0, state.totalXp - task.earnedXp);
    task.earnedXp = 0;
    state.daily.completedCount = Math.max(0, state.daily.completedCount - 1);
  }
  saveState(state);
  render();
};

const removeTask = (taskId) => {
  const task = state.tasks.find((itemTask) => itemTask.id === taskId);
  if (task?.completed && task.earnedXp) {
    state.totalXp = Math.max(0, state.totalXp - task.earnedXp);
  }
  state.tasks = state.tasks.filter((itemTask) => itemTask.id !== taskId);
  saveState(state);
  render();
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
    earnedXp: 0,
  });
  saveState(state);
  render();
};

const unlockAchievement = (id) => {
  if (state.achievements[id]?.unlockedAt) {
    return;
  }
  const now = new Date();
  const label = `${formatDateLabel(formatDateKey(now))} ${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  state.achievements[id] = {
    unlockedAt: label,
  };
};

const evaluateAchievements = () => {
  const level = getLevelInfo(state.totalXp).level;
  const streak = getEffectiveStreak();

  if (state.tasks.some((task) => task.completed) || state.daily.completedCount > 0) {
    unlockAchievement("first-task");
  }
  if (streak >= 3) {
    unlockAchievement("streak-3");
  }
  if (streak >= 7) {
    unlockAchievement("streak-7");
  }
  if (level >= 5) {
    unlockAchievement("level-5");
  }
  if (level >= 10) {
    unlockAchievement("level-10");
  }
};

const generateShareCard = () => {
  const ctx = shareCanvas.getContext("2d");
  const width = shareCanvas.width;
  const height = shareCanvas.height;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(1, "#4f46e5");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Inter, sans-serif";
  ctx.fillText("Life RPG", 80, 140);

  ctx.font = "bold 96px Inter, sans-serif";
  ctx.fillText(levelValue.textContent, 80, 280);

  ctx.font = "bold 48px Inter, sans-serif";
  ctx.fillText(`總經驗 ${state.totalXp} XP`, 80, 360);
  ctx.fillText(`連續 ${getEffectiveStreak()} 天`, 80, 430);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 44px Inter, sans-serif";
  ctx.fillText("已解鎖成就", 80, 520);

  ctx.font = "36px Inter, sans-serif";
  const unlocked = ACHIEVEMENTS.filter(
    (achievement) => state.achievements[achievement.id]?.unlockedAt
  );
  if (unlocked.length === 0) {
    ctx.fillText("尚未解鎖成就", 80, 590);
  } else {
    unlocked.slice(0, 6).forEach((achievement, index) => {
      ctx.fillText(`• ${achievement.title}`, 100, 590 + index * 54);
    });
  }

  ctx.font = "28px Inter, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText("分享你的自律冒險旅程", 80, height - 120);

  state.share.lastGeneratedAt = new Date().toISOString();
  saveState(state);

  const dataUrl = shareCanvas.toDataURL("image/png");
  shareDownload.href = dataUrl;
  shareDownload.hidden = false;
  shareDownload.textContent = "下載分享卡";
};

const render = () => {
  updateDailyForToday();
  evaluateAchievements();
  renderStats();
  renderTasks();
  renderDailyTasks();
  renderDailyHistory();
  renderAchievements();
  saveState(state);
};

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(taskInput.value, xpInput.value);
  taskInput.value = "";
  taskInput.focus();
});

shareButton.addEventListener("click", () => {
  generateShareCard();
});

render();
