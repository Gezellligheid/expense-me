<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import html2canvas from "html2canvas";
import {
  storageService,
  type Expense,
  type Income,
} from "../services/storageService";
import { testDataService } from "../services/testDataService";
import { useSettings } from "../composables/useSettings";
import { useWrappedStatus } from "../composables/useWrappedStatus";
import { useRouter } from "vue-router";

const { formatCurrency: fmt, isTestMode } = useSettings();
const router = useRouter();

// Use test data when test mode is on, exactly like Home.vue
const ds = computed(() =>
  isTestMode.value ? testDataService : storageService,
);

// ── Year being reviewed (resolved from server clock) ────────────────────────────
const { status: wrappedStatus } = useWrappedStatus();
/** null = checking server | false = outside window | true = available */
const wrappedAvailable = ref<boolean | null>(null);
const wrappedYear = ref(new Date().getFullYear() - 1);

// ── Load data (one-time + recurring expanded for every month of the year) ─────
const yearExpenses = ref<Expense[]>([]);
const yearIncomes = ref<Income[]>([]);

function loadYearData() {
  const yr = wrappedYear.value;
  const oneOffExp = ds.value
    .loadExpenses()
    .filter((e) => !e._sim && e.date.startsWith(String(yr)));
  const oneOffInc = ds.value
    .loadIncomes()
    .filter((i) => !i._sim && i.date.startsWith(String(yr)));

  const today = new Date();
  const lastMonth = today.getFullYear() === yr ? today.getMonth() + 1 : 12;

  const recurExp: Expense[] = [];
  const recurInc: Income[] = [];
  for (let m = 1; m <= lastMonth; m++) {
    const ym = `${yr}-${String(m).padStart(2, "0")}`;
    recurExp.push(...ds.value.calculateRecurringExpensesForMonth(ym));
    recurInc.push(...ds.value.calculateRecurringIncomesForMonth(ym));
  }

  yearExpenses.value = [...oneOffExp, ...recurExp];
  yearIncomes.value = [...oneOffInc, ...recurInc];
}

// When the server status arrives (or if already cached), update state & load data
watch(
  wrappedStatus,
  (s) => {
    if (!s) return;
    wrappedYear.value = s.year;
    wrappedAvailable.value = s.available;
    if (s.available) loadYearData();
  },
  { immediate: true },
);

onMounted(() => {
  // Data loading is driven by the wrappedStatus watcher above.
});

// ── Aggregate stats ────────────────────────────────────────────────────────────
const totalSpent = computed(() =>
  yearExpenses.value.reduce((s, e) => s + parseFloat(e.amount), 0),
);
const totalEarned = computed(() =>
  yearIncomes.value.reduce((s, i) => s + parseFloat(i.amount), 0),
);
const netSavings = computed(() => totalEarned.value - totalSpent.value);
const savingsRate = computed(() =>
  totalEarned.value > 0 ? (netSavings.value / totalEarned.value) * 100 : 0,
);

// ── Category grouping ─────────────────────────────────────────────────────────
const CATEGORIES: { name: string; emoji: string; keywords: string[] }[] = [
  {
    name: "Housing",
    emoji: "🏠",
    keywords: [
      "rent",
      "mortgage",
      "utilities",
      "internet",
      "electric",
      "gas",
      "water",
      "utility",
      "cable",
      "maintenance",
    ],
  },
  {
    name: "Food",
    emoji: "🍔",
    keywords: [
      "grocery",
      "groceries",
      "food",
      "restaurant",
      "cafe",
      "coffee",
      "lunch",
      "dinner",
      "breakfast",
      "pizza",
      "sushi",
      "uber eats",
      "doordash",
      "takeout",
      "supermarket",
    ],
  },
  {
    name: "Transport",
    emoji: "🚗",
    keywords: [
      "car",
      "fuel",
      "parking",
      "uber",
      "lyft",
      "transit",
      "bus",
      "train",
      "metro",
      "vehicle",
      "gas station",
      "toll",
    ],
  },
  {
    name: "Entertainment",
    emoji: "🎬",
    keywords: [
      "netflix",
      "spotify",
      "cinema",
      "movie",
      "concert",
      "game",
      "games",
      "music",
      "hulu",
      "disney",
      "youtube",
      "streaming",
      "amazon prime",
    ],
  },
  {
    name: "Health",
    emoji: "💊",
    keywords: [
      "gym",
      "medical",
      "doctor",
      "pharmacy",
      "medicine",
      "health",
      "fitness",
      "dentist",
      "hospital",
      "clinic",
    ],
  },
  {
    name: "Shopping",
    emoji: "🛍️",
    keywords: [
      "amazon",
      "shopping",
      "clothes",
      "clothing",
      "fashion",
      "shoes",
      "mall",
      "store",
      "retail",
    ],
  },
  {
    name: "Tech",
    emoji: "📱",
    keywords: [
      "phone",
      "apple",
      "google",
      "tech",
      "software",
      "app",
      "subscription",
      "cloud",
      "laptop",
      "computer",
    ],
  },
  {
    name: "Education",
    emoji: "📚",
    keywords: [
      "course",
      "book",
      "books",
      "school",
      "education",
      "university",
      "tuition",
      "learning",
      "udemy",
      "coursera",
    ],
  },
  {
    name: "Travel",
    emoji: "✈️",
    keywords: [
      "flight",
      "hotel",
      "airbnb",
      "vacation",
      "travel",
      "trip",
      "airline",
      "booking",
      "accommodation",
    ],
  },
];

function categorise(desc: string): { name: string; emoji: string } {
  const d = desc.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => d.includes(k))) return cat;
  }
  return { name: "Other", emoji: "📌" };
}

const categoryTotals = computed(() => {
  const map = new Map<string, { name: string; emoji: string; total: number }>();
  for (const e of yearExpenses.value) {
    const cat = categorise(e.description);
    const existing = map.get(cat.name) ?? { ...cat, total: 0 };
    existing.total += parseFloat(e.amount);
    map.set(cat.name, existing);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
});

const topCategory = computed(
  () => categoryTotals.value[0] ?? { name: "None", emoji: "🤷", total: 0 },
);

// ── Monthly breakdown ──────────────────────────────────────────────────────────
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const monthlyData = computed(() => {
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: MONTHS[i]!,
    spent: 0,
    earned: 0,
    idx: i,
  }));
  for (const e of yearExpenses.value) {
    const m = parseInt(e.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) months[m]!.spent += parseFloat(e.amount);
  }
  for (const i of yearIncomes.value) {
    const m = parseInt(i.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) months[m]!.earned += parseFloat(i.amount);
  }
  return months;
});

const busiestMonth = computed(() => {
  return monthlyData.value.reduce(
    (max, m) => (m.spent > max.spent ? m : max),
    monthlyData.value[0]!,
  );
});
const bestMonth = computed(() => {
  const withIncome = monthlyData.value.filter((m) => m.earned > 0);
  if (!withIncome.length)
    return monthlyData.value.reduce(
      (min, m) => (m.spent < min.spent ? m : min),
      monthlyData.value[0]!,
    );
  return withIncome.reduce(
    (best, m) => (m.earned - m.spent > best.earned - best.spent ? m : best),
    withIncome[0]!,
  );
});

// ── Biggest single expense ─────────────────────────────────────────────────────
const biggestExpense = computed(() => {
  if (!yearExpenses.value.length) return null;
  return yearExpenses.value.reduce((max, e) =>
    parseFloat(e.amount) > parseFloat(max.amount) ? e : max,
  );
});

// ── Transaction count ──────────────────────────────────────────────────────────
const txCount = computed(
  () => yearExpenses.value.length + yearIncomes.value.length,
);
const avgPerDay = computed(() => (totalSpent.value / 365).toFixed(2));

// ── Slides definition ─────────────────────────────────────────────────────────
const SLIDE_COUNT = 10;
const currentSlide = ref(0);
const animating = ref(false);
const direction = ref<"forward" | "backward">("forward");

function goNext() {
  if (animating.value || currentSlide.value >= SLIDE_COUNT - 1) return;
  direction.value = "forward";
  animating.value = true;
  setTimeout(() => {
    currentSlide.value++;
    animating.value = false;
  }, 400);
}

function goPrev() {
  if (animating.value || currentSlide.value <= 0) return;
  direction.value = "backward";
  animating.value = true;
  setTimeout(() => {
    currentSlide.value--;
    animating.value = false;
  }, 400);
}

function handleKey(e: KeyboardEvent) {
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ")
    goNext();
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
  if (e.key === "Escape") router.push("/");
}

// ── Touch / swipe ─────────────────────────────────────────────────────────────
let touchStartX = 0;
function handleTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0]!.clientX;
}
function handleTouchEnd(e: TouchEvent) {
  const dx = touchStartX - e.changedTouches[0]!.clientX;
  if (Math.abs(dx) > 50) dx > 0 ? goNext() : goPrev();
}

onMounted(() => document.addEventListener("keydown", handleKey));
onUnmounted(() => document.removeEventListener("keydown", handleKey));

// ── Bar chart helper ──────────────────────────────────────────────────────────
const maxSpent = computed(() =>
  Math.max(...monthlyData.value.map((m) => m.spent), 1),
);
const maxEarned = computed(() =>
  Math.max(...monthlyData.value.map((m) => m.earned), 1),
);
const barMax = computed(() => Math.max(maxSpent.value, maxEarned.value));

// ── Share card ────────────────────────────────────────────────────────────────
const shareCardRef = ref<HTMLElement | null>(null);
const isGenerating = ref(false);

async function captureAndShare() {
  if (!shareCardRef.value || isGenerating.value) return;
  isGenerating.value = true;
  try {
    const canvas = await html2canvas(shareCardRef.value, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `wrapped-${wrappedYear}.png`, {
        type: "image/png",
      });
      // Try Web Share API first
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `My ${wrappedYear} Financial Wrapped`,
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wrapped-${wrappedYear}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
      isGenerating.value = false;
    }, "image/png");
  } catch {
    isGenerating.value = false;
  }
}

// ── Motivational mottos per slide ───────────────────────────────────────────────
const SLIDE_MOTTOS: string[] = [
  "", // 0 intro
  "Every coffee, every commute — it all starts somewhere.", // 1 spent
  "Behind every paycheck is real effort. Respect that.", // 2 earned
  "The gap between earning and spending is where freedom lives.", // 3 savings
  "Your spending habits are a mirror of your values.", // 4 category
  "Some purchases define a year. This one did.", // 5 biggest
  "Life was full — and your wallet felt every moment of it.", // 6 busiest
  "Discipline isn\u2019t about sacrifice. It\u2019s about choice.", // 7 best month
  "One decision at a time — that\u2019s how a year is built.", // 8 transactions
  "Every number here is a choice you made. Own your story.", // 9 outro
];

// ── Ring animation (animates in when slide 3 mounts) ────────────────────────
const ringDash = ref(0);

// ── Web Audio music engine ──────────────────────────────────────────────────
// Generates groovy copyright-free patterns via Web Audio scheduling
const audioEnabled = ref(false);
let audioCtx: AudioContext | null = null;
let seqHandle: ReturnType<typeof setTimeout> | null = null;
let masterGain: GainNode | null = null;
let seqRunning = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

// ── Percussion helpers ────────────────────────────────────────────────────────
function kick(ctx: AudioContext, mg: GainNode, t: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g);
  g.connect(mg);
  o.start(t);
  o.stop(t + 0.25);
}

function snare(ctx: AudioContext, mg: GainNode, t: number) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1800;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, t);
  src.connect(f);
  f.connect(g);
  g.connect(mg);
  src.start(t);
}

function hihat(ctx: AudioContext, mg: GainNode, t: number, vol = 0.08) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.045, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(mg);
  src.start(t);
}

function note(
  ctx: AudioContext,
  mg: GainNode,
  freq: number,
  t: number,
  dur: number,
  vol = 0.07,
  type: OscillatorType = "triangle",
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 2200;
  f.Q.value = 0.4;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f);
  f.connect(g);
  g.connect(mg);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ── Slide patterns — {bpm, loop (in beats), notes:[beat, freq, dur]} ──────────
const C3 = 130.81,
  D3 = 146.83,
  E3 = 164.81,
  F3 = 174.61,
  G3 = 196,
  A3 = 220,
  B3 = 246.94;
const C4 = 261.63,
  D4 = 293.66,
  E4 = 329.63,
  F4 = 349.23,
  G4 = 392,
  A4 = 440,
  B4 = 493.88;
const Cs4 = 277.18;
const C5 = 523.25,
  D5 = 587.33,
  E5 = 659.25,
  F5 = 698.46,
  G5 = 783.99;

type Pattern = {
  bpm: number;
  loop: number;
  melody: [number, number, number][];
  bass: [number, number, number][];
};

const SLIDE_PATTERNS: Pattern[] = [
  // 0 intro — dreamy rising C major
  {
    bpm: 88,
    loop: 8,
    bass: [
      [0, C3, 1.8],
      [4, G3, 1.8],
    ],
    melody: [
      [0, C5, 0.5],
      [1, E5, 0.5],
      [2, G5, 0.5],
      [4, C5, 0.5],
      [5, E5, 0.5],
      [6, G5, 0.5],
      [7, C5, 1],
    ],
  },
  // 1 spent — tense A minor descend
  {
    bpm: 95,
    loop: 8,
    bass: [
      [0, A3, 0.9],
      [2, G3, 0.9],
      [4, F3, 0.9],
      [6, E3, 0.9],
    ],
    melody: [
      [0, A4, 0.4],
      [1, G4, 0.4],
      [2, F4, 0.4],
      [3, E4, 0.4],
      [4, A4, 0.4],
      [5, G4, 0.4],
      [6, F4, 0.4],
      [7, E4, 0.8],
    ],
  },
  // 2 earned — uplifting G major
  {
    bpm: 100,
    loop: 8,
    bass: [
      [0, G3, 1.8],
      [4, D3, 1.8],
    ],
    melody: [
      [0, G4, 0.35],
      [1, B4, 0.35],
      [2, D5, 0.35],
      [4, G4, 0.35],
      [5, A4, 0.35],
      [6, B4, 0.35],
      [7, D5, 0.7],
    ],
  },
  // 3 savings — flowing F major
  {
    bpm: 80,
    loop: 8,
    bass: [
      [0, F3, 1.8],
      [4, C3, 1.8],
    ],
    melody: [
      [0, C5, 0.6],
      [1.5, E5, 0.6],
      [3, F4, 0.6],
      [4, C5, 0.6],
      [5.5, E5, 0.6],
      [7, F4, 1],
    ],
  },
  // 4 category — bouncy D dorian
  {
    bpm: 108,
    loop: 8,
    bass: [
      [0, D3, 0.8],
      [2, F3, 0.8],
      [4, G3, 0.8],
      [6, A3, 0.8],
    ],
    melody: [
      [0, D4, 0.3],
      [0.5, F4, 0.3],
      [1, A4, 0.3],
      [2, D5, 0.3],
      [3, A4, 0.3],
      [4, F4, 0.3],
      [5, D4, 0.3],
      [6, E4, 0.3],
      [7, F4, 0.6],
    ],
  },
  // 5 biggest — dramatic E minor
  {
    bpm: 76,
    loop: 8,
    bass: [
      [0, E3, 2],
      [4, B3, 2],
    ],
    melody: [
      [0, E4, 0.7],
      [1.5, G4, 0.7],
      [3, B4, 0.7],
      [4, E5, 0.7],
      [5.5, D5, 0.7],
      [7, B4, 1],
    ],
  },
  // 6 busiest — energetic A major
  {
    bpm: 115,
    loop: 8,
    bass: [
      [0, A3, 0.7],
      [2, Cs4, 0.7],
      [4, E4, 0.7],
      [6, A3, 0.7],
    ],
    melody: [
      [0, A4, 0.3],
      [0.75, E5, 0.25],
      [1.5, A4, 0.3],
      [3, C5, 0.3],
      [4, E5, 0.3],
      [4.75, D5, 0.25],
      [5.5, C5, 0.3],
      [7, A4, 0.6],
    ],
  },
  // 7 best — warm C major
  {
    bpm: 84,
    loop: 8,
    bass: [
      [0, C3, 2],
      [4, G3, 2],
    ],
    melody: [
      [0, C5, 0.5],
      [0.75, E5, 0.5],
      [1.5, G5, 0.5],
      [3, E5, 0.5],
      [4, C5, 0.5],
      [5, G4, 0.5],
      [6, E4, 0.5],
      [7, C4, 1],
    ],
  },
  // 8 transactions — playful pentatonic
  {
    bpm: 110,
    loop: 8,
    bass: [
      [0, C3, 0.6],
      [2, G3, 0.6],
      [4, A3, 0.6],
      [6, C4, 0.6],
    ],
    melody: [
      [0, C5, 0.28],
      [0.5, D5, 0.28],
      [1, E5, 0.28],
      [1.5, G5, 0.28],
      [2, E5, 0.28],
      [3, D5, 0.28],
      [4, C5, 0.28],
      [4.5, E5, 0.28],
      [5, G5, 0.28],
      [6, E5, 0.28],
      [7, C5, 0.55],
    ],
  },
  // 9 outro — triumphant C major
  {
    bpm: 92,
    loop: 8,
    bass: [
      [0, C3, 1.8],
      [2, E3, 0.9],
      [4, F3, 1.8],
      [6, G3, 1.8],
    ],
    melody: [
      [0, C5, 0.45],
      [1, E5, 0.45],
      [2, G5, 0.45],
      [3, E5, 0.45],
      [4, F5, 0.45],
      [5, A4, 0.45],
      [6, G5, 0.45],
      [7, C5, 0.9],
    ],
  },
];

let currentPattern: Pattern | null = null;
let loopStartTime = 0;

function schedulePattern(
  ctx: AudioContext,
  mg: GainNode,
  pattern: Pattern,
  loopStart: number,
) {
  if (!seqRunning) return;
  const spb = 60 / pattern.bpm; // seconds per beat
  const loopDur = pattern.loop * spb;

  // Kick on 1 & 3 (0-indexed beats 0, 2, 4, 6 in an 8-beat bar)
  [0, 2, 4, 6].forEach((b) => kick(ctx, mg, loopStart + b * spb));
  // Snare on 2 & 4 (beats 1, 3, 5, 7)
  [1, 3, 5, 7].forEach((b) => snare(ctx, mg, loopStart + b * spb));
  // Hi-hat on every half-beat
  for (let b = 0; b < pattern.loop * 2; b++)
    hihat(ctx, mg, loopStart + b * (spb / 2));
  // Bass
  pattern.bass.forEach(([b, f, d]) =>
    note(ctx, mg, f, loopStart + b * spb, d * spb, 0.11, "sine"),
  );
  // Melody
  pattern.melody.forEach(([b, f, d]) =>
    note(ctx, mg, f, loopStart + b * spb, d * spb, 0.07),
  );

  // Schedule next loop
  const nextLoop = loopStart + loopDur;
  seqHandle = setTimeout(
    () => {
      if (seqRunning && currentPattern === pattern) {
        schedulePattern(ctx, mg, pattern, nextLoop);
      }
    },
    (nextLoop - ctx.currentTime - 0.1) * 1000,
  );
}

function stopSequencer() {
  seqRunning = false;
  if (seqHandle !== null) {
    clearTimeout(seqHandle);
    seqHandle = null;
  }
  if (masterGain && audioCtx) {
    const now = audioCtx.currentTime;
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
  }
}

function playSlideAudio(idx: number) {
  if (!audioEnabled.value) return;
  const ctx = getCtx();
  const pattern = SLIDE_PATTERNS[idx] ?? SLIDE_PATTERNS[0]!;
  stopSequencer();
  currentPattern = pattern;
  seqRunning = true;

  // New master gain
  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.8);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 10;
  masterGain.connect(comp);
  comp.connect(ctx.destination);

  loopStartTime = ctx.currentTime + 0.05;
  schedulePattern(ctx, masterGain, pattern, loopStartTime);
}

function toggleAudio() {
  audioEnabled.value = !audioEnabled.value;
  if (audioEnabled.value) {
    playSlideAudio(currentSlide.value);
  } else {
    stopSequencer();
  }
}

watch(currentSlide, (n) => {
  // Trigger ring draw animation when entering the savings slide
  if (n === 3) {
    ringDash.value = 0;
    setTimeout(() => {
      ringDash.value = Math.min(Math.abs(savingsRate.value), 100) * 3.14;
    }, 120);
  }
  if (audioEnabled.value) playSlideAudio(n);
});

onUnmounted(() => {
  stopSequencer();
  audioCtx?.close();
});
</script>

<template>
  <!-- Full-screen wrapped experience -->
  <div
    class="wrapped-root fixed inset-0 z-50 overflow-hidden select-none"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <!-- ── Loading state ─────────────────────────────────────────────────── -->
    <div v-if="wrappedAvailable === null" class="slide slide-intro">
      <div class="slide-content animate-fadeup">
        <div class="text-white/50 text-2xl font-semibold">
          Checking availability…
        </div>
      </div>
    </div>

    <!-- ── Not available ─────────────────────────────────────────────────── -->
    <div v-else-if="wrappedAvailable === false" class="slide slide-intro">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">See you in December</p>
        <h1
          class="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none"
        >
          {{ wrappedYear }}<br />
          <span class="wrapped-gradient">Wrapped</span>
        </h1>
        <p class="mt-6 text-gray-300 text-lg max-w-md text-center">
          Your Financial Wrapped is available each year from
          <strong class="text-white">1 December</strong> through
          <strong class="text-white">31 January</strong>.
        </p>
        <button class="start-btn" @click="router.push('/')">
          Back to Dashboard
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12h18M3 12l6-6m-6 6l6 6"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- ── SLIDE 1 — Welcome / Intro ───────────────────────────────────── -->
    <div v-else-if="currentSlide === 0" class="slide slide-intro">
      <div class="particles">
        <span v-for="n in 20" :key="n" class="particle" :style="`--i:${n};`" />
      </div>
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">Your Financial Year</p>
        <h1
          class="text-7xl md:text-9xl font-black tracking-tighter text-white leading-none"
        >
          {{ wrappedYear }}<br />
          <span class="wrapped-gradient">Wrapped</span>
        </h1>
        <p class="mt-6 text-gray-300 text-lg max-w-md text-center">
          A look back at your money story — every spend, every save, every win.
        </p>
        <button class="start-btn" @click="goNext">
          Let's go
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- ── SLIDE 2 — Total Spent ───────────────────────────────────────── -->
    <div v-else-if="currentSlide === 1" class="slide slide-red">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">In {{ wrappedYear }}, you spent</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[1] }}</p>
        <div class="big-number text-red-300">{{ fmt(totalSpent) }}</div>
        <p class="slide-sub">
          That's about
          <span class="stat-pill bg-red-500/20 text-red-300">{{
            fmt(parseFloat(avgPerDay))
          }}</span>
          every single day of the year.
        </p>
        <div class="w-full max-w-xs mt-8">
          <div
            class="stat-bar-row month-flyin"
            v-for="m in monthlyData"
            :key="m.idx"
            :style="`animation-delay:${m.idx * 55}ms`"
          >
            <span class="stat-bar-label">{{ m.label }}</span>
            <div class="stat-bar-track">
              <div
                class="stat-bar-fill bg-red-400"
                :style="`width:${(m.spent / barMax) * 100}%; animation-delay:${m.idx * 55 + 120}ms`"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SLIDE 3 — Total Earned ─────────────────────────────────────── -->
    <div v-else-if="currentSlide === 2" class="slide slide-green">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">But you also earned</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[2] }}</p>
        <div class="big-number text-emerald-300">{{ fmt(totalEarned) }}</div>
        <p class="slide-sub">
          Across
          <span class="stat-pill bg-emerald-500/20 text-emerald-300"
            >{{ yearIncomes.length }} income transactions</span
          >
          this year.
        </p>
        <div class="w-full max-w-xs mt-8">
          <div
            class="stat-bar-row month-flyin"
            v-for="m in monthlyData"
            :key="m.idx"
            :style="`animation-delay:${m.idx * 55}ms`"
          >
            <span class="stat-bar-label">{{ m.label }}</span>
            <div class="stat-bar-track">
              <div
                class="stat-bar-fill bg-emerald-400"
                :style="`width:${(m.earned / barMax) * 100}%; animation-delay:${m.idx * 55 + 120}ms`"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SLIDE 4 — Net Savings ──────────────────────────────────────── -->
    <div v-else-if="currentSlide === 3" class="slide slide-blue">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">Which means you saved</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[3] }}</p>
        <div
          class="big-number"
          :class="netSavings >= 0 ? 'text-blue-300' : 'text-orange-300'"
        >
          {{ fmt(Math.abs(netSavings)) }}
        </div>
        <p v-if="netSavings >= 0" class="slide-sub">
          That's a savings rate of
          <span class="stat-pill bg-blue-500/20 text-blue-300"
            >{{ savingsRate.toFixed(1) }}%</span
          >
          — keep it up! 🎉
        </p>
        <p v-else class="slide-sub">
          You spent
          <span class="stat-pill bg-orange-500/20 text-orange-300">{{
            fmt(Math.abs(netSavings))
          }}</span>
          more than you earned. Next year's the year! 💪
        </p>
        <!-- Donut-style progress ring -->
        <div class="savings-ring-wrap">
          <svg viewBox="0 0 120 120" class="savings-ring">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#1e293b"
              stroke-width="12"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              :stroke="netSavings >= 0 ? '#60a5fa' : '#fb923c'"
              stroke-width="12"
              stroke-linecap="round"
              :stroke-dasharray="`${ringDash} 314`"
              stroke-dashoffset="78.5"
              class="ring-progress"
            />
          </svg>
          <span
            class="ring-label"
            :class="netSavings >= 0 ? 'text-blue-300' : 'text-orange-300'"
          >
            {{ savingsRate.toFixed(0) }}%
          </span>
        </div>
      </div>
    </div>

    <!-- ── SLIDE 5 — Top Category ─────────────────────────────────────── -->
    <div v-else-if="currentSlide === 4" class="slide slide-purple">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">Your #1 spending category</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[4] }}</p>
        <div class="emoji-big animate-bounce-slow">{{ topCategory.emoji }}</div>
        <h2 class="text-5xl font-black text-white mt-2">
          {{ topCategory.name }}
        </h2>
        <div class="text-3xl font-bold text-purple-300 mt-2">
          {{ fmt(topCategory.total) }}
        </div>
        <p class="slide-sub mt-3">
          {{ ((topCategory.total / (totalSpent || 1)) * 100).toFixed(0) }}% of
          your total spending — you really love
          {{ topCategory.name.toLowerCase() }}!
        </p>
        <!-- Top 5 categories bar chart -->
        <div class="w-full max-w-xs mt-6 space-y-2">
          <div
            v-for="(cat, i) in categoryTotals.slice(0, 5)"
            :key="cat.name"
            class="flex items-center gap-2"
          >
            <span class="text-lg w-6 text-center shrink-0">{{
              cat.emoji
            }}</span>
            <span
              class="text-xs font-medium w-24 truncate shrink-0"
              :class="i === 0 ? 'text-purple-300' : 'text-gray-400'"
              >{{ cat.name }}</span
            >
            <div class="flex-1 h-2.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                class="h-full rounded-full"
                :class="i === 0 ? 'bg-purple-400' : 'bg-gray-600'"
                :style="`width:${(cat.total / (topCategory.total || 1)) * 100}%; animation-delay:${i * 80}ms`"
              />
            </div>
            <span class="text-xs text-gray-400 w-16 text-right shrink-0">{{
              fmt(cat.total)
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SLIDE 6 — Biggest Single Expense ──────────────────────────── -->
    <div v-else-if="currentSlide === 5" class="slide slide-orange">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">Your biggest single expense</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[5] }}</p>
        <div class="emoji-big">💸</div>
        <template v-if="biggestExpense">
          <div class="big-number text-orange-300">
            {{ fmt(parseFloat(biggestExpense.amount)) }}
          </div>
          <h2 class="text-2xl font-bold text-white mt-2">
            {{ biggestExpense.description }}
          </h2>
          <p class="slide-sub text-gray-400 mt-1">
            on
            {{
              new Date(biggestExpense.date + "T12:00:00").toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric" },
              )
            }}
          </p>
          <p class="slide-sub mt-3">
            That's
            <span class="stat-pill bg-orange-500/20 text-orange-300">
              {{
                (
                  (parseFloat(biggestExpense.amount) / (totalSpent || 1)) *
                  100
                ).toFixed(1)
              }}%
            </span>
            of your entire year's spending in one shot.
          </p>
        </template>
        <p v-else class="slide-sub">
          No expenses recorded for {{ wrappedYear }}.
        </p>
      </div>
    </div>

    <!-- ── SLIDE 7 — Busiest Month ────────────────────────────────────── -->
    <div v-else-if="currentSlide === 6" class="slide slide-pink">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">Your most expensive month</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[6] }}</p>
        <div class="emoji-big">🔥</div>
        <h2 class="text-6xl font-black text-white">{{ busiestMonth.label }}</h2>
        <div class="text-3xl font-bold text-pink-300 mt-2">
          {{ fmt(busiestMonth.spent) }}
        </div>
        <p class="slide-sub mt-3">
          You spent
          <span class="stat-pill bg-pink-500/20 text-pink-300"
            >{{
              ((busiestMonth.spent / (totalSpent || 1)) * 100).toFixed(0)
            }}%</span
          >
          of your annual expenses in this month alone.
        </p>
        <!-- Mini bar chart highlighting the busiest month -->
        <div class="mini-bar-chart mt-6">
          <div
            v-for="m in monthlyData"
            :key="m.idx"
            class="mini-bar-col"
            :title="`${m.label}: ${fmt(m.spent)}`"
          >
            <div
              class="mini-bar month-bar-rise"
              :class="
                m.idx === busiestMonth.idx ? 'bg-pink-400' : 'bg-gray-700'
              "
              :style="`height:${Math.max((m.spent / (maxSpent || 1)) * 80, 2)}px; animation-delay:${m.idx * 55}ms`"
            />
            <span
              class="mini-bar-label"
              :class="
                m.idx === busiestMonth.idx ? 'text-pink-400' : 'text-gray-600'
              "
              >{{ m.label }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- ── SLIDE 8 — Best Month ───────────────────────────────────────── -->
    <div v-else-if="currentSlide === 7" class="slide slide-teal">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">Your best saving month</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[7] }}</p>
        <div class="emoji-big">⭐</div>
        <h2 class="text-6xl font-black text-white">{{ bestMonth.label }}</h2>
        <div class="text-3xl font-bold text-teal-300 mt-2">
          Saved {{ fmt(Math.max(bestMonth.earned - bestMonth.spent, 0)) }}
        </div>
        <p class="slide-sub mt-3">
          Earned
          <span class="stat-pill bg-teal-500/20 text-teal-300">{{
            fmt(bestMonth.earned)
          }}</span
          >, spent only
          <span class="stat-pill bg-red-500/20 text-red-300">{{
            fmt(bestMonth.spent)
          }}</span
          >. That's your financial peak of {{ wrappedYear }}.
        </p>
      </div>
    </div>

    <!-- ── SLIDE 9 — Transaction Count ───────────────────────────────── -->
    <div v-else-if="currentSlide === 8" class="slide slide-indigo">
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">You made</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[8] }}</p>
        <div class="big-number text-indigo-300">
          {{ txCount.toLocaleString() }}
        </div>
        <p class="text-2xl font-bold text-white mt-2">transactions</p>
        <p class="slide-sub mt-4">
          <span class="stat-pill bg-indigo-500/20 text-indigo-300">{{
            yearExpenses.length
          }}</span>
          expenses &
          <span class="stat-pill bg-emerald-500/20 text-emerald-300">{{
            yearIncomes.length
          }}</span>
          income entries.
        </p>
        <!-- Activity dots grid -->
        <div class="activity-grid mt-8">
          <div
            v-for="n in 52"
            :key="n"
            class="activity-dot"
            :class="Math.random() > 0.45 ? 'bg-indigo-500/60' : 'bg-gray-800'"
          />
        </div>
        <p class="text-xs text-gray-600 mt-2">Activity across the year</p>
      </div>
    </div>

    <!-- ── SLIDE 10 — Outro / Year Recap ──────────────────────────────── -->
    <div v-else-if="currentSlide === 9" class="slide slide-outro">
      <div class="particles">
        <span v-for="n in 30" :key="n" class="particle" :style="`--i:${n};`" />
      </div>
      <div class="slide-content animate-fadeup">
        <p class="slide-eyebrow">That was</p>
        <p class="slide-motto">{{ SLIDE_MOTTOS[9] }}</p>
        <h1 class="text-7xl md:text-8xl font-black text-white leading-none">
          <span class="wrapped-gradient">{{ wrappedYear }}</span>
        </h1>
        <!-- ── Shareable card ───────────────────────── -->
        <div ref="shareCardRef" class="share-card mt-8">
          <!-- Header -->
          <div class="share-card-header">
            <span class="share-card-brand">💰 expense-me</span>
            <span class="share-card-year-badge">{{ wrappedYear }}</span>
          </div>
          <!-- Title -->
          <p class="share-card-title">
            Financial<br /><span class="share-card-title-accent">Wrapped</span>
          </p>
          <!-- Stats grid -->
          <div class="share-card-stats">
            <div class="share-stat">
              <span class="share-stat-emoji">💸</span>
              <span class="share-stat-label">Spent</span>
              <span class="share-stat-value" style="color: #fca5a5">{{
                fmt(totalSpent)
              }}</span>
            </div>
            <div class="share-stat">
              <span class="share-stat-emoji">💰</span>
              <span class="share-stat-label">Earned</span>
              <span class="share-stat-value" style="color: #6ee7b7">{{
                fmt(totalEarned)
              }}</span>
            </div>
            <div class="share-stat">
              <span class="share-stat-emoji">🏦</span>
              <span class="share-stat-label">Saved</span>
              <span
                class="share-stat-value"
                :style="netSavings >= 0 ? 'color:#93c5fd' : 'color:#fdba74'"
                >{{ fmt(Math.abs(netSavings)) }}</span
              >
            </div>
            <div class="share-stat">
              <span class="share-stat-emoji">{{ topCategory.emoji }}</span>
              <span class="share-stat-label">Top category</span>
              <span class="share-stat-value" style="color: #d8b4fe">{{
                topCategory.name
              }}</span>
            </div>
          </div>
          <!-- Savings rate pill -->
          <div class="share-card-footer">
            <span class="share-rate-pill">
              {{ savingsRate.toFixed(0) }}% savings rate
            </span>
            <span class="share-card-tagline"
              >Here's to {{ wrappedYear + 1 }}! 🥂</span
            >
          </div>
        </div>

        <!-- Action buttons -->
        <div class="outro-btns mt-5">
          <button
            class="outro-btn"
            :disabled="isGenerating"
            @click="captureAndShare"
          >
            <svg
              v-if="!isGenerating"
              class="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <svg
              v-else
              class="w-4 h-4 shrink-0 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            {{ isGenerating ? "Generating…" : "Share / Save" }}
          </button>
          <button class="outro-btn outro-btn-primary" @click="router.push('/')">
            Dashboard
          </button>
        </div>
      </div>
    </div>

    <!-- ── Navigation controls (only shown when Wrapped is available) ────── -->
    <div v-show="wrappedAvailable === true" class="nav-controls">
      <!-- Progress dots -->
      <div class="progress-dots">
        <button
          v-for="i in SLIDE_COUNT"
          :key="i"
          class="progress-dot"
          :class="i - 1 === currentSlide ? 'active' : ''"
          @click="currentSlide = i - 1"
        />
      </div>
    </div>

    <!-- Prev / next arrows + audio + close (only when Wrapped is available) -->
    <template v-if="wrappedAvailable === true">
      <button
        v-if="currentSlide > 0"
        class="nav-arrow left"
        @click="goPrev"
        aria-label="Previous slide"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <button
        v-if="currentSlide < SLIDE_COUNT - 1"
        class="nav-arrow right"
        @click="goNext"
        aria-label="Next slide"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      <!-- Audio toggle -->
      <button
        class="audio-btn"
        @click="toggleAudio"
        :title="audioEnabled ? 'Mute music' : 'Play ambient music'"
      >
        <svg
          v-if="audioEnabled"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <svg
          v-else
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
          <line
            x1="3"
            y1="3"
            x2="21"
            y2="21"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <!-- Close -->
      <button
        class="close-btn"
        @click="router.push('/')"
        aria-label="Close wrapped"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button> </template
    ><!-- end v-if="wrappedAvailable === true" -->
  </div>
</template>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────────── */
.wrapped-root {
  font-family: inherit;
  background: #030712;
}

/* ── Slides ───────────────────────────────────────────────────────── */
.slide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  overflow: hidden;
}

.slide-intro {
  background: radial-gradient(ellipse at 60% 40%, #1e1b4b 0%, #030712 70%);
}
.slide-red {
  background: radial-gradient(ellipse at 40% 60%, #450a0a 0%, #030712 70%);
}
.slide-green {
  background: radial-gradient(ellipse at 60% 40%, #052e16 0%, #030712 70%);
}
.slide-blue {
  background: radial-gradient(ellipse at 50% 50%, #0c1445 0%, #030712 70%);
}
.slide-purple {
  background: radial-gradient(ellipse at 55% 45%, #2e1065 0%, #030712 70%);
}
.slide-orange {
  background: radial-gradient(ellipse at 45% 55%, #431407 0%, #030712 70%);
}
.slide-pink {
  background: radial-gradient(ellipse at 60% 40%, #500724 0%, #030712 70%);
}
.slide-teal {
  background: radial-gradient(ellipse at 40% 60%, #042f2e 0%, #030712 70%);
}
.slide-indigo {
  background: radial-gradient(ellipse at 50% 50%, #1e1b4b 0%, #030712 70%);
}
.slide-outro {
  background: radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #0f172a 70%);
}

.slide-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 640px;
  width: 100%;
  z-index: 1;
}

/* ── Gradient text ────────────────────────────────────────────────── */
.wrapped-gradient {
  background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Typography ───────────────────────────────────────────────────── */
.slide-eyebrow {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.big-number {
  font-size: clamp(3rem, 10vw, 5.5rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.04em;
}

.slide-sub {
  color: #9ca3af;
  font-size: 1rem;
  line-height: 1.6;
  max-width: 360px;
}

.stat-pill {
  display: inline-block;
  padding: 0.1em 0.5em;
  border-radius: 9999px;
  font-weight: 600;
}

.emoji-big {
  font-size: 4rem;
  line-height: 1;
  margin-bottom: 0.5rem;
}

/* ── Animations ───────────────────────────────────────────────────── */
@keyframes fadeup {
  from {
    opacity: 0;
    transform: translateY(32px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fadeup {
  animation: fadeup 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes bounce-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}
.animate-bounce-slow {
  animation: bounce-slow 2.4s ease-in-out infinite;
}

/* ── Particles ────────────────────────────────────────────────────── */
.particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  top: 110%;
  left: calc(var(--i) * 5%);
  background: hsl(calc(var(--i) * 18), 80%, 65%);
  animation: float calc(3s + var(--i) * 0.2s) calc(var(--i) * 0.15s) ease-in-out
    infinite;
  opacity: 0.7;
}

@keyframes float {
  0% {
    top: 110%;
    opacity: 0;
    transform: scale(1) rotate(0deg);
  }
  10% {
    opacity: 0.8;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    top: -10%;
    opacity: 0;
    transform: scale(0.4) rotate(360deg);
  }
}

/* ── Bar charts ───────────────────────────────────────────────────── */
.stat-bar-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 4px;
}

.stat-bar-label {
  width: 2.2rem;
  text-align: right;
  font-size: 0.65rem;
  color: #6b7280;
  flex-shrink: 0;
}

.stat-bar-track {
  flex: 1;
  height: 6px;
  background: #1f2937;
  border-radius: 9999px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 9999px;
  width: 0;
  animation: growBar 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes growBar {
  from {
    width: 0 !important;
  }
}

/* ── Mini bar chart ───────────────────────────────────────────────── */
.mini-bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 96px;
  width: 100%;
  max-width: 320px;
}

.mini-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  height: 100%;
}

.mini-bar {
  width: 100%;
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  animation: growHeight 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes growHeight {
  from {
    height: 0 !important;
  }
}

.mini-bar-label {
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Savings ring ─────────────────────────────────────────────────── */
.savings-ring-wrap {
  position: relative;
  width: 140px;
  height: 140px;
  margin-top: 1.5rem;
}

.savings-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-progress {
  transition: stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 900;
}

/* ── Activity grid ────────────────────────────────────────────────── */
.activity-grid {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 4px;
  width: 100%;
  max-width: 300px;
}

.activity-dot {
  aspect-ratio: 1;
  border-radius: 2px;
  animation: popIn 0.4s ease both;
}

@keyframes popIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* ── Summary cards ────────────────────────────────────────────────── */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  width: 100%;
  max-width: 360px;
}

.summary-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  animation: fadeup 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.summary-emoji {
  font-size: 1.75rem;
}
.summary-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
}
.summary-value {
  font-size: 1rem;
  font-weight: 700;
}

/* ── Start button ─────────────────────────────────────────────────── */
.start-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
  padding: 0.75rem 1.75rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  border: none;
  transition:
    transform 0.15s,
    box-shadow 0.15s;
  box-shadow: 0 0 24px rgba(139, 92, 246, 0.4);
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 32px rgba(139, 92, 246, 0.6);
}

/* ── Navigation arrows ────────────────────────────────────────────── */
.nav-arrow {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.nav-arrow:hover {
  background: rgba(255, 255, 255, 0.12);
  color: white;
}

.nav-arrow.left {
  left: 1rem;
}
.nav-arrow.right {
  right: 1rem;
}

/* ── Progress dots ────────────────────────────────────────────────── */
.nav-controls {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
}

.progress-dots {
  display: flex;
  gap: 0.4rem;
}

.progress-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.2s,
    width 0.3s;
  border: none;
}

.progress-dot.active {
  background: white;
  width: 20px;
}

/* ── Close button ─────────────────────────────────────────────────── */
.close-btn {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 60;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: white;
}

/* ── Share card ───────────────────────────────────────────────────── */
.share-card {
  width: 320px;
  border-radius: 1.5rem;
  background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 40%, #0d2b3e 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  box-shadow:
    0 0 40px rgba(99, 102, 241, 0.25),
    0 8px 32px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.share-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-card-brand {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.share-card-year-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2em 0.6em;
  border-radius: 9999px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: white;
  letter-spacing: 0.05em;
}

.share-card-title {
  font-size: 2rem;
  font-weight: 900;
  color: white;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-top: 0.25rem;
}

.share-card-title-accent {
  background: linear-gradient(135deg, #818cf8, #c084fc, #f472b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.share-card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.share-stat {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.875rem;
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.share-stat-emoji {
  font-size: 1.25rem;
  line-height: 1;
}
.share-stat-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
}
.share-stat-value {
  font-size: 0.9rem;
  font-weight: 800;
}

.share-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
}

.share-rate-pill {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.25em 0.75em;
  border-radius: 9999px;
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.share-card-tagline {
  font-size: 0.7rem;
  color: #475569;
}

/* ── Outro action buttons (equal size) ───────────────────────────── */
.outro-btns {
  display: flex;
  gap: 0.75rem;
  width: 320px;
}

.outro-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.8rem 1rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: white;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.15s;
  white-space: nowrap;
}

.outro-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.13);
  transform: scale(1.03);
}

.outro-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.outro-btn-primary {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border-color: transparent;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.35);
}

.outro-btn-primary:hover {
  box-shadow: 0 0 28px rgba(139, 92, 246, 0.55);
}

/* ── Share button (kept for compat, superseded by outro-btn) ─────── */
.share-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: white;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.15s;
}

.share-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.13);
  transform: scale(1.04);
}

.share-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Motivational motto ──────────────────────────────────────────────── */
.slide-motto {
  font-size: 0.9rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.35);
  max-width: 320px;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 0.5rem;
  animation: fadeup 0.7s 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* ── Audio toggle button ──────────────────────────────────────────── */
.audio-btn {
  position: fixed;
  top: 1rem;
  right: 3.5rem;
  z-index: 60;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.audio-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: white;
}

/* ── Month row fly-in (slides 2 & 3) ─────────────────────────────────────── */
@keyframes flyInLeft {
  from {
    opacity: 0;
    transform: translateX(-28px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.month-flyin {
  opacity: 0;
  animation: flyInLeft 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* ── Mini bar rise from bottom (slide 7) ───────────────────────────────────── */
@keyframes riseUp {
  from {
    transform: scaleY(0);
    opacity: 0;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}
.month-bar-rise {
  opacity: 0;
  transform-origin: bottom;
  animation: riseUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
</style>
