const STORAGE_KEY = "lifeRpgState";
const XP_PER_LEVEL = 100;
const DEFAULT_DAILY_COUNT = 3;
const DEFAULT_QUEST_POOL = [
  { id: "daily-exercise", title: "運動 30 分鐘", xp: 30, enabled: true },
  { id: "daily-create", title: "剪輯 1 支影片", xp: 40, enabled: true },
  { id: "daily-learn", title: "學習 30 分鐘", xp: 30, enabled: true },
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
const dailyDate = document.getElementById("dailyDate");
const yesterdayXp = document.getElementById("yesterdayXp");
const yesterdayCompletion = document.getElementById("yesterdayCompletion");
const rerollButton = document.getElementById("rerollButton");
const achievementGrid = document.getElementById("achievementGrid");
const historyList = document.getElementById("historyList");
const xpChart = document.getElementById("xpChart");
const levelChart = document.getElementById("levelChart");
const streakChart = document.getElementById("streakChart");
const questForm = document.getElementById("questForm");
const questTitleInput = document.getElementById("questTitleInput");
const questXpInput = document.getElementById("questXpInput");
const questList = document.getElementById("questList");
const shareButton = document.getElementById("shareButton");
const shareDownload = document.getElementById("shareDownload");
const shareCanvas = document.getElementById("shareCanvas");
const timelineShareButton = document.getElementById("timelineShareButton");
const timelineShareDownload = document.getElementById("timelineShareDownload");
const timelineCanvas = document.getElementById("timelineCanvas");
const taskTemplate = document.getElementById("taskItemTemplate");
const dailyTaskTemplate = document.getElementById("dailyTaskTemplate");
const achievementTemplate = document.getElementById("achievementTemplate");
const historyItemTemplate = document.getElementById("historyItemTemplate");
const questItemTemplate = document.getElementById("questItemTemplate");
const navButtons = document.querySelectorAll(".nav__button");
const views = document.querySelectorAll(".view");

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
  questPool: DEFAULT_QUEST_POOL.map((quest) => ({ ...quest })),
  history: [],
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
    questPool: Array.isArray(parsed.questPool) && parsed.questPool.length > 0
      ? parsed.questPool
      : DEFAULT_QUEST_POOL.map((quest) => ({ ...quest })),
    history: Array.isArray(parsed.history) ? parsed.history : [],
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

const toDateFromKey = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const daysBetween = (fromKey, toKey) => {
  if (!fromKey || !toKey) return 0;
  const fromDate = toDateFromKey(fromKey);
  const toDate = toDateFromKey(toKey);
  return Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24));
};

const getEnabledQuestPool = () => state.questPool.filter((quest) => quest.enabled);

const shuffleArray = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const rollDailyTasks = () => {
  const enabledPool = getEnabledQuestPool();
  const selectionCount = Math.min(DEFAULT_DAILY_COUNT, enabledPool.length);
  return shuffleArray(enabledPool)
    .slice(0, selectionCount)
    .map((quest) => ({
      id: quest.id,
      title: quest.title,
      xp: quest.xp,
      completed: false,
      status: "pending",
      earnedXp: 0,
    }));
};

const getHistoryEntry = (dateKey) =>
  state.history.find((entry) => entry.date === dateKey);

const upsertHistoryEntry = (entry) => {
  const existing = getHistoryEntry(entry.date);
  if (existing?.finalized) {
    return;
  }
  if (existing) {
    Object.assign(existing, entry);
  } else {
    state.history.push(entry);
  }
};

const buildHistoryEntryForDate = (dateKey, tasks, streakValue, finalized) => {
  const xpGained = tasks.reduce((sum, task) => sum + (task.earnedXp || 0), 0);
  const level = getLevelInfo(state.totalXp).level;
  return {
    date: dateKey,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      xp: task.xp,
      status: task.completed ? "completed" : task.status === "failed" ? "failed" : "pending",
      earnedXp: task.earnedXp || 0,
    })),
    xpGained,
    streak: streakValue,
    level,
    finalized,
  };
};

const getHistoryEntries = () => {
  const todayKey = formatDateKey();
  const entries = [...state.history];
  if (!getHistoryEntry(todayKey)) {
    entries.push(buildHistoryEntryForDate(todayKey, state.daily.tasks, getEffectiveStreak(), false));
  }
  return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
};

const getYesterdayEntry = () => {
  const today = toDateFromKey(formatDateKey());
  const yesterdayKey = formatDateKey(new Date(today.getTime() - 86400000));
  return getHistoryEntry(yesterdayKey);
};

const getLevelInfo = (xp) => {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const currentXp = xp % XP_PER_LEVEL;
  const nextLevelXp = XP_PER_LEVEL - currentXp;
  return { level, currentXp, nextLevelXp };
};

const getStreakForDay = (dateKey, hadCompletion) => {
  if (!hadCompletion) return 0;
  if (!state.streak.lastCompletedDate) return 1;
  if (state.streak.lastCompletedDate === dateKey) return state.streak.count;
  const diff = daysBetween(state.streak.lastCompletedDate, dateKey);
  if (diff === 1) return state.streak.count + 1;
  return 1;
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
    const dayGap = daysBetween(state.daily.date, todayKey);
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

    const streakForPreviousDay = getStreakForDay(state.daily.date, hadCompletion);
    upsertHistoryEntry(
      buildHistoryEntryForDate(state.daily.date, updatedTasks, streakForPreviousDay, true)
    );

    if (dayGap > 1) {
      for (let gap = 1; gap < dayGap; gap += 1) {
        const missingDate = formatDateKey(
          new Date(toDateFromKey(state.daily.date).getTime() + gap * 86400000)
        );
        const failedTasks = rollDailyTasks().map((task) => ({
          ...task,
          status: "failed",
        }));
        upsertHistoryEntry(buildHistoryEntryForDate(missingDate, failedTasks, 0, true));
      }
    }

    if (dayGap > 1) {
      state.streak.count = 0;
      state.streak.lastCompletedDate = null;
    } else if (hadCompletion) {
      if (state.streak.lastCompletedDate) {
        const diffDays = daysBetween(state.streak.lastCompletedDate, state.daily.date);
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
  state.daily.tasks = rollDailyTasks();
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
  const canReroll = state.daily.completedCount === 0 && getEnabledQuestPool().length > 0;
  rerollButton.disabled = !canReroll;
};

const renderYesterdaySummary = () => {
  const entry = getYesterdayEntry();
  if (!entry) {
    yesterdayXp.textContent = "0 XP";
    yesterdayCompletion.textContent = "尚未有資料";
    return;
  }
  yesterdayXp.textContent = `${entry.xpGained} XP`;
  const allCompleted = entry.tasks.every((task) => task.status === "completed");
  yesterdayCompletion.textContent = allCompleted ? "全部完成" : "未全部完成";
};

const renderQuestPool = () => {
  questList.innerHTML = "";
  state.questPool.forEach((quest) => {
    const fragment = questItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".quest-item");
    const toggle = fragment.querySelector(".quest-item__toggle");
    const title = fragment.querySelector(".quest-item__title");
    const xp = fragment.querySelector(".quest-item__xp");
    const deleteButton = fragment.querySelector(".quest-item__delete");

    toggle.checked = quest.enabled;
    title.textContent = quest.title;
    xp.textContent = `${quest.xp} XP`;

    toggle.addEventListener("change", () => {
      quest.enabled = toggle.checked;
      saveState(state);
    });

    deleteButton.addEventListener("click", () => {
      state.questPool = state.questPool.filter((poolQuest) => poolQuest.id !== quest.id);
      saveState(state);
      renderQuestPool();
    });

    questList.appendChild(item);
  });
};

const renderHistoryTimeline = () => {
  historyList.innerHTML = "";
  const entries = getHistoryEntries();
  entries.forEach((entry) => {
    const fragment = historyItemTemplate.content.cloneNode(true);
    const container = fragment.querySelector(".history-item");
    const date = fragment.querySelector(".history-item__date");
    const xp = fragment.querySelector(".history-item__xp");
    const streak = fragment.querySelector(".history-item__streak");
    const level = fragment.querySelector(".history-item__level");
    const tasks = fragment.querySelector(".history-item__tasks");

    date.textContent = formatDateLabel(entry.date);
    xp.textContent = `+${entry.xpGained} XP`;
    streak.textContent = `Streak ${entry.streak} 天`;
    level.textContent = `Lv ${entry.level}`;
    if (container && entry.date === formatDateKey()) {
      container.open = true;
    }

    entry.tasks.forEach((task) => {
      const taskRow = document.createElement("div");
      taskRow.className = "history-task";
      if (task.status === "failed") {
        taskRow.classList.add("history-task--failed");
      } else if (task.status === "completed") {
        taskRow.classList.add("history-task--completed");
      }
      taskRow.innerHTML = `<span>${task.title}</span><span>${task.status === "completed" ? "完成" : task.status === "failed" ? "失敗" : "進行中"}</span>`;
      tasks.appendChild(taskRow);
    });

    historyList.appendChild(container);
  });
};

const drawLineChart = (canvas, values, color) => {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (values.length === 0) {
    return;
  }
  const maxValue = Math.max(...values, 1);
  const padding = 30;
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = padding + stepX * index;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
};

const renderCharts = () => {
  const entries = getHistoryEntries().slice().reverse();
  const xpValues = entries.map((entry) => entry.xpGained);
  const levelValues = entries.map((entry) => entry.level);
  const streakValues = entries.map((entry) => entry.streak);
  drawLineChart(xpChart, xpValues, "#6366f1");
  drawLineChart(levelChart, levelValues, "#22c55e");
  drawLineChart(streakChart, streakValues, "#f97316");
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

const addQuest = (title, xp) => {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  const safeXp = Math.max(1, Number(xp) || 1);
  state.questPool.unshift({
    id: crypto.randomUUID(),
    title: trimmed,
    xp: safeXp,
    enabled: true,
  });
  saveState(state);
  renderQuestPool();
};

const rerollTodayTasks = () => {
  if (state.daily.completedCount > 0 || getEnabledQuestPool().length === 0) {
    return;
  }
  state.daily.tasks = rollDailyTasks();
  state.daily.completedCount = 0;
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

const generateTimelineShareCard = () => {
  const ctx = timelineCanvas.getContext("2d");
  const width = timelineCanvas.width;
  const height = timelineCanvas.height;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#312e81");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Inter, sans-serif";
  ctx.fillText("Life RPG Timeline", 80, 140);

  const entries = getHistoryEntries().slice(0, 7);
  ctx.font = "36px Inter, sans-serif";
  ctx.fillText("最近 7 天", 80, 210);

  ctx.font = "32px Inter, sans-serif";
  entries.forEach((entry, index) => {
    const y = 280 + index * 120;
    ctx.fillText(formatDateLabel(entry.date), 80, y);
    ctx.fillText(`XP +${entry.xpGained}`, 380, y);
    ctx.fillText(`Streak ${entry.streak}`, 380, y + 40);
    ctx.fillText(`Lv ${entry.level}`, 80, y + 40);
  });

  ctx.font = "28px Inter, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("持續記錄，讓成長看得見", 80, height - 120);

  state.share.lastGeneratedAt = new Date().toISOString();
  saveState(state);

  const dataUrl = timelineCanvas.toDataURL("image/png");
  timelineShareDownload.href = dataUrl;
  timelineShareDownload.hidden = false;
  timelineShareDownload.textContent = "下載時間軸分享卡";
};

const render = () => {
  updateDailyForToday();
  evaluateAchievements();
  renderStats();
  renderTasks();
  renderDailyTasks();
  renderYesterdaySummary();
  renderQuestPool();
  upsertHistoryEntry(
    buildHistoryEntryForDate(state.daily.date, state.daily.tasks, getEffectiveStreak(), false)
  );
  renderHistoryTimeline();
  renderCharts();
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

rerollButton.addEventListener("click", () => {
  rerollTodayTasks();
});

timelineShareButton.addEventListener("click", () => {
  generateTimelineShareCard();
});

questForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addQuest(questTitleInput.value, questXpInput.value);
  questTitleInput.value = "";
  questTitleInput.focus();
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetView = button.dataset.view;
    navButtons.forEach((navButton) => {
      navButton.classList.toggle(
        "nav__button--active",
        navButton.dataset.view === targetView
      );
    });
    views.forEach((view) => {
      view.classList.toggle("view--active", view.dataset.view === targetView);
    });
  });
});

render();

setInterval(() => {
  const todayKey = formatDateKey();
  if (todayKey !== state.daily.date) {
    render();
  }
}, 60 * 1000);
