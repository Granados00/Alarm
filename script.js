let alarms = [];
let alarmStarted = false;
let activeAlarm = null;
let audioCtx = null;
let soundIntervalId = null;
let previewTimeoutId = null;
let scheduleMode = "repeat"; // "repeat" o "once"
let selectedDays = new Set(); // Guarda días del 0 (Domingo) al 6 (Sábado)

// Frases para el juego de desbloqueo de alarma
const phrases = [
  "Hoy será un gran día",
  "Debo despertar ahora",
  "La disciplina crea éxito",
  "Nunca rendirse",
  "Hora de comenzar",
  "El futuro es hoy",
  "Energía positiva siempre",
  "La constancia vence al talento"
];

let currentPhrase = "";
let completed = 0;
const totalRounds = 3;

// Inicializar el contexto de audio (Web Audio API)
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Desbloqueo proactivo en móviles mediante eventos táctiles iniciales
const unlockEvents = ["click", "touchstart"];
function handleUnlock() {
  initAudio();
  if (audioCtx && audioCtx.state === "running") {
    unlockEvents.forEach(evt => document.removeEventListener(evt, handleUnlock));
  }
}
unlockEvents.forEach(evt => document.addEventListener(evt, handleUnlock));

// Sintetizadores Web Audio API (Offline-friendly)
const synthSounds = {
  beep: {
    interval: 1200,
    play: (ctx, time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, time);
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.3);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(880, time + 0.4);
      gain2.gain.setValueAtTime(0.15, time + 0.4);
      gain2.gain.exponentialRampToValueAtTime(0.01, time + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(time + 0.4);
      osc2.stop(time + 0.7);
    }
  },
  siren: {
    interval: 1200,
    play: (ctx, time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, time);
      osc.frequency.linearRampToValueAtTime(880, time + 0.4);
      osc.frequency.linearRampToValueAtTime(440, time + 0.8);
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.linearRampToValueAtTime(0.1, time + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.8);
    }
  },
  retro: {
    interval: 1200,
    play: (ctx, time) => {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time + idx * 0.1);
        gain.gain.setValueAtTime(0.15, time + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, time + idx * 0.1 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time + idx * 0.1);
        osc.stop(time + idx * 0.1 + 0.25);
      });
    }
  },
  scifi: {
    interval: 1200,
    play: (ctx, time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, time);
      osc.frequency.exponentialRampToValueAtTime(150, time + 0.5);
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.55);
    }
  },
  zen: {
    interval: 2200,
    play: (ctx, time) => {
      const frequencies = [329.63, 392.00, 523.25, 659.25]; // E4, G4, C5, E5
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        const decay = 2.0 / (idx + 1);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + decay);
      });
    }
  },
  bird: {
    interval: 1500,
    play: (ctx, time) => {
      for (let i = 0; i < 3; i++) {
        const chirpTime = time + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, chirpTime);
        osc.frequency.exponentialRampToValueAtTime(3800, chirpTime + 0.1);
        
        gain.gain.setValueAtTime(0, chirpTime);
        gain.gain.linearRampToValueAtTime(0.08, chirpTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, chirpTime + 0.1);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(chirpTime);
        osc.stop(chirpTime + 0.12);
      }
    }
  },
  pulse: {
    interval: 1500,
    play: (ctx, time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, time);
      osc.frequency.linearRampToValueAtTime(220, time + 0.6);
      osc.frequency.linearRampToValueAtTime(110, time + 1.2);
      
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 1.25);
    }
  },
  nuclear: {
    interval: 1200,
    play: (ctx, time) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, time);
      osc.frequency.setValueAtTime(350, time + 0.25);
      osc.frequency.setValueAtTime(900, time + 0.5);
      osc.frequency.setValueAtTime(350, time + 0.75);
      
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 1.0);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 1.0);
    }
  }
};

// Mapa de nombres legibles para los sonidos
const soundNames = {
  beep: "Beep Digital ⚡",
  siren: "Sirena Policial 🚨",
  retro: "Melodía Retro 👾",
  scifi: "Láser Espacial 🚀",
  zen: "Campanas Zen 🧘",
  bird: "Pájaro Digital 🐦",
  pulse: "Pulso Cósmico 🌌",
  nuclear: "Alerta Nuclear ☢️",
};

// Sonidos cortos para feedback de interacción
function playFeedbackSound(isSuccess) {
  initAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  if (isSuccess) {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.25);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

// Reproducir sonido en bucle cuando suena la alarma
function playAlarmSound(type) {
  stopAlarmSound();
  initAudio();
  if (!audioCtx) return;

  if (type === 'classic') {
    const soundEl = document.getElementById("sound");
    if (soundEl) {
      soundEl.currentTime = 0;
      soundEl.volume = 0.8;
      soundEl.play().catch(e => console.log("Autoplay bloqueado o error al cargar audio fallback:", e));
    }
    return;
  }

  const synth = synthSounds[type];
  if (!synth) return;

  // Tocar primer bip/pulso de inmediato
  synth.play(audioCtx, audioCtx.currentTime);

  // Programar el bucle infinito
  soundIntervalId = setInterval(() => {
    synth.play(audioCtx, audioCtx.currentTime);
  }, synth.interval || 1200);
}

// Detener sonido de alarma
function stopAlarmSound() {
  if (soundIntervalId) {
    clearInterval(soundIntervalId);
    soundIntervalId = null;
  }
  const soundEl = document.getElementById("sound");
  if (soundEl) {
    soundEl.pause();
    soundEl.currentTime = 0;
  }
}

// Probar sonido individual desde selector
function testSound() {
  initAudio();
  if (previewTimeoutId) {
    clearTimeout(previewTimeoutId);
  }
  stopAlarmSound();

  const type = document.getElementById("soundType").value;
  if (type === 'classic') {
    const soundEl = document.getElementById("sound");
    if (soundEl) {
      soundEl.currentTime = 0;
      soundEl.volume = 0.8;
      soundEl.play().catch(e => console.log("Error al reproducir preview classic:", e));
      previewTimeoutId = setTimeout(() => {
        soundEl.pause();
        soundEl.currentTime = 0;
      }, 2500);
    }
    return;
  }

  const synth = synthSounds[type];
  if (!synth) return;

  synth.play(audioCtx, audioCtx.currentTime);
}

// Configurar modo de programación ("repeat" o "once")
function setScheduleMode(mode) {
  scheduleMode = mode;
  const btnRepeat = document.getElementById("btnRepeat");
  const btnOnce = document.getElementById("btnOnce");
  const repeatDaysContainer = document.getElementById("repeatDaysContainer");
  const onceDateContainer = document.getElementById("onceDateContainer");

  if (mode === "repeat") {
    if (btnRepeat) btnRepeat.classList.add("active");
    if (btnOnce) btnOnce.classList.remove("active");
    if (repeatDaysContainer) repeatDaysContainer.style.display = "block";
    if (onceDateContainer) onceDateContainer.style.display = "none";
  } else {
    if (btnRepeat) btnRepeat.classList.remove("active");
    if (btnOnce) btnOnce.classList.add("active");
    if (repeatDaysContainer) repeatDaysContainer.style.display = "none";
    if (onceDateContainer) onceDateContainer.style.display = "block";
  }
}

// Seleccionar/Deseleccionar un día de la semana
function toggleDaySelection(btn) {
  initAudio(); // desbloquear audio también aquí
  const day = parseInt(btn.getAttribute("data-day"));
  if (selectedDays.has(day)) {
    selectedDays.delete(day);
    btn.classList.remove("selected");
  } else {
    selectedDays.add(day);
    btn.classList.add("selected");
  }
}

// Convertir configuración de días/fecha en texto legible
const dayNamesShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function getAlarmScheduleText(alarm) {
  if (alarm.mode === "once") {
    if (!alarm.date) return "Una vez";
    const parts = alarm.date.split("-");
    if (parts.length === 3) {
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      return dateObj.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    }
    return alarm.date;
  } else {
    const days = alarm.days;
    if (days.length === 7) return "Todos los días";
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Lun a Vie";
    if (days.length === 2 && days.includes(0) && days.includes(6)) return "Fines de semana";
    
    const sortedDays = [...days].sort((a, b) => {
      const valA = a === 0 ? 7 : a;
      const valB = b === 0 ? 7 : b;
      return valA - valB;
    });
    
    return sortedDays.map(d => dayNamesShort[d]).join(", ");
  }
}

// Renderizar la lista de alarmas en el HTML
function renderAlarms() {
  const alarmsListContainer = document.getElementById("alarmsList");
  if (!alarmsListContainer) return;

  if (alarms.length === 0) {
    alarmsListContainer.innerHTML = `<p class="empty-list-msg">No hay alarmas configuradas</p>`;
    return;
  }

  // Ordenar cronológicamente por hora
  const sortedAlarms = [...alarms].sort((a, b) => {
    return a.time.localeCompare(b.time);
  });

  alarmsListContainer.innerHTML = sortedAlarms.map(alarm => {
    const scheduleText = getAlarmScheduleText(alarm);
    const soundText = soundNames[alarm.sound] || alarm.sound;
    const isChecked = alarm.active ? "checked" : "";
    
    return `
      <div class="alarm-item ${alarm.active ? '' : 'inactive'}" data-id="${alarm.id}">
        <div class="alarm-info">
          <div class="alarm-time-row">
            <span class="alarm-time">${alarm.time}</span>
            <span class="alarm-sound-badge">${soundText}</span>
          </div>
          <div class="alarm-schedule">${scheduleText}</div>
        </div>
        <div class="alarm-actions">
          <label class="switch" aria-label="Activar o desactivar alarma">
            <input type="checkbox" onchange="toggleAlarmActive('${alarm.id}')" ${isChecked}>
            <span class="slider"></span>
          </label>
          <button class="btn-delete" onclick="deleteAlarm('${alarm.id}')" title="Eliminar alarma" aria-label="Eliminar alarma">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

// Activar o desactivar una alarma
function toggleAlarmActive(id) {
  const alarm = alarms.find(a => a.id === id);
  if (alarm) {
    alarm.active = !alarm.active;
    saveAlarms();
    renderAlarms();
    playFeedbackSound(alarm.active);
  }
}

// Eliminar una alarma
function deleteAlarm(id) {
  alarms = alarms.filter(a => a.id !== id);
  saveAlarms();
  renderAlarms();
  playFeedbackSound(false);
}

// Guardar alarmas en localStorage
function saveAlarms() {
  localStorage.setItem("alarms", JSON.stringify(alarms));
}

// Guardar/Crear nueva alarma
function setAlarm() {
  initAudio();

  const timeInput = document.getElementById("time");
  const soundTypeInput = document.getElementById("soundType");
  const alarmDateInput = document.getElementById("alarmDate");

  const timeVal = timeInput.value;
  const soundVal = soundTypeInput.value;

  if (!timeVal) {
    alert("Por favor selecciona una hora válida.");
    return;
  }

  let alarmDays = [];
  let alarmDate = "";

  if (scheduleMode === "repeat") {
    if (selectedDays.size === 0) {
      alert("Por favor selecciona al menos un día de la semana.");
      return;
    }
    alarmDays = Array.from(selectedDays);
  } else {
    alarmDate = alarmDateInput.value;
    if (!alarmDate) {
      alert("Por favor selecciona una fecha válida.");
      return;
    }
  }

  const newAlarm = {
    id: Date.now().toString(),
    time: timeVal,
    sound: soundVal,
    mode: scheduleMode,
    days: alarmDays,
    date: alarmDate,
    active: true
  };

  alarms.push(newAlarm);
  saveAlarms();
  renderAlarms();

  // Resetear la selección de días por comodidad
  if (scheduleMode === "repeat") {
    selectedDays.clear();
    document.querySelectorAll(".day-btn").forEach(btn => btn.classList.remove("selected"));
  }

  // Animación del botón para indicar éxito
  const saveBtn = document.querySelector(".btn-primary");
  if (saveBtn) {
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "¡Alarma Guardada! ✓";
    saveBtn.style.background = "linear-gradient(135deg, #10b981, #34d399)";
    saveBtn.style.color = "#ffffff";
    setTimeout(() => {
      saveBtn.innerText = originalText;
      saveBtn.style.background = "";
      saveBtn.style.color = "";
    }, 1500);
  }
}

// Variable para evitar doble disparo en el mismo minuto
let lastFiredMin = "";

// Revisar si coincide alguna alarma configurada
function checkAlarms(timeString) {
  if (alarmStarted) return; // Si ya hay una alarma sonando, no interrumpir

  const now = new Date();
  const currentHourMin = timeString.slice(0, 5); // "HH:MM"
  const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, etc.

  // Obtener fecha local en formato YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localDateStr = `${year}-${month}-${day}`;

  for (const alarm of alarms) {
    if (!alarm.active) continue;

    let matches = false;
    if (alarm.mode === "once") {
      if (alarm.date === localDateStr && alarm.time === currentHourMin) {
        matches = true;
      }
    } else if (alarm.mode === "repeat") {
      if (alarm.days.includes(currentDay) && alarm.time === currentHourMin) {
        matches = true;
      }
    }

    if (matches) {
      const fireKey = `${alarm.id}_${currentHourMin}`;
      if (lastFiredMin !== fireKey) {
        lastFiredMin = fireKey;
        triggerAlarm(alarm);
        break; // Ejecutar solo una a la vez
      }
    }
  }
}

// Disparar alarma (Pantalla activa y sonido)
function triggerAlarm(alarm) {
  activeAlarm = alarm;
  alarmStarted = true;

  const card = document.querySelector(".card");
  const alarmScreen = document.getElementById("alarmScreen");
  
  if (card) card.style.display = "none";
  if (alarmScreen) alarmScreen.style.display = "flex";

  playAlarmSound(alarm.sound);
  
  completed = 0;
  updateProgressBar();
  newPhrase();

  // Enfocar input
  setTimeout(() => {
    const ansInput = document.getElementById("answer");
    if (ansInput) {
      ansInput.value = "";
      ansInput.focus();
    }
  }, 150);
}

// Generar una frase aleatoria
function newPhrase() {
  currentPhrase = phrases[Math.floor(Math.random() * phrases.length)];
  const qBox = document.getElementById("question");
  if (qBox) qBox.innerText = `"${currentPhrase}"`;
}

// Actualizar barra de progreso del juego
function updateProgressBar() {
  const bar = document.getElementById("progressBar");
  const counter = document.getElementById("progressCounter");
  if (bar && counter) {
    const pct = (completed / totalRounds) * 100;
    bar.style.width = pct + "%";
    counter.innerText = `Ronda ${completed} de ${totalRounds}`;
  }
}

// Verificar la frase introducida por el usuario
function checkAnswer() {
  const valInput = document.getElementById("answer");
  const val = valInput ? valInput.value.trim() : "";

  if (val === currentPhrase) {
    completed++;
    playFeedbackSound(true);
    if (valInput) valInput.value = "";
    updateProgressBar();

    if (completed >= totalRounds) {
      // Reto superado con éxito
      stopAlarmSound();

      // Si es una alarma de una sola vez, desactivarla
      if (activeAlarm && activeAlarm.mode === "once") {
        activeAlarm.active = false;
        saveAlarms();
        renderAlarms();
      }

      // Regresar al estado principal sin recargar página (UX fluida)
      const card = document.querySelector(".card");
      const alarmScreen = document.getElementById("alarmScreen");
      if (card) card.style.display = "flex";
      if (alarmScreen) alarmScreen.style.display = "none";

      alarmStarted = false;
      activeAlarm = null;

      // Felicitar al usuario
      setTimeout(() => {
        alert("¡Excelente! Has despertado con éxito. ☀️");
      }, 100);
    } else {
      // Destello de éxito antes de pasar a la siguiente frase
      const qBox = document.getElementById("question");
      if (qBox) {
        qBox.classList.add("success-flash");
        setTimeout(() => {
          qBox.classList.remove("success-flash");
          newPhrase();
        }, 300);
      }
    }
  } else {
    // Respuesta fallida
    playFeedbackSound(false);

    const container = document.getElementById("alarmScreen");
    if (container) {
      container.classList.add("shake-effect");
      setTimeout(() => {
        container.classList.remove("shake-effect");
      }, 500);
    }

    if (valInput) valInput.value = "";
    newPhrase();
  }
}

// Actualizar reloj digital segundo a segundo
function updateClock() {
  const now = new Date();
  const timeString = now.toTimeString().slice(0, 8); // HH:MM:SS
  const dateString = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");

  if (clockEl) clockEl.innerText = timeString;
  if (dateEl) dateEl.innerText = dateString;

  // Analizar si coincide alguna alarma
  checkAlarms(timeString);
}

// Actualización inicial inmediata y temporizador
setInterval(updateClock, 1000);
updateClock();

// Escuchador DOMContentLoaded para inicializar y cargar datos
document.addEventListener("DOMContentLoaded", () => {
  // Cargar alarmas
  const stored = localStorage.getItem("alarms");
  if (stored) {
    try {
      alarms = JSON.parse(stored);
    } catch (e) {
      alarms = [];
    }
  }
  renderAlarms();

  // Poner fecha de hoy por defecto en el selector
  const alarmDateInput = document.getElementById("alarmDate");
  if (alarmDateInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    alarmDateInput.value = `${year}-${month}-${day}`;
  }

  // Manejar tecla Enter en el campo de texto del juego
  const answerInput = document.getElementById("answer");
  if (answerInput) {
    answerInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        checkAnswer();
      }
    });
  }
});