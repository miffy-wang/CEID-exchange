// Google Form
const SHEET_TSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR99IwneoO__xn9mLdq890DqeTBmNjhCdxRDnLUSFQsBshX3E0rZ_LHDHY550jE-YYXqNNhv77NgzAj/pub?output=tsv";

const PHASES = [
  { key: "intro", label: "CEID Exchange", duration: 7000 },
  { key: "Fabrication", label: "Fabrication", duration: 9000 },
  {
    key: "Computer-aided Design",
    label: "Computer-aided Design",
    duration: 9000
  },
  {
    key: "Sewing & Textiles",
    label: "Sewing & Textiles",
    duration: 9000
  },
  { key: "3D Printing", label: "3D Printing", duration: 9000 },
  { key: "Laser Cutting", label: "Laser Cutting", duration: 9000 },
  { key: "Machining", label: "Machining", duration: 9000 },
  // final QR phase
  { key: "qr", label: "QR", duration: 10000 }
];

const COL_TEACH = "SKILLS_TEACH";
const COL_LEARN = "SKILLS_LEARN";

const MAX_BUBBLES_PER_SIDE = 30;
const MORPH_FRACTION = 0.45;
const BUBBLE_FADE_DURATION = 600;

const leftLayer = document.getElementById("left-bubbles");
const rightLayer = document.getElementById("right-bubbles");
const statusLine = document.getElementById("status-line");

const phaseBuckets = {};

let currentPhaseIndex = 0;
let previousPhaseIndex = 0;
let phaseElapsedMs = 0;

// ==========================
// TSV retrieve
// ==========================
async function fetchTSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function parseTSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];
  const headers = lines[0].split("\t");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (cells[idx] || "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

function setStatus(msg) {
  if (statusLine) statusLine.textContent = msg;
}

function parseSkillsCell(cellValue) {
  if (!cellValue) return [];
  return cellValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function buildPhaseBuckets(rows) {
  PHASES.forEach((phase) => {
    if (phase.key === "intro" || phase.key === "qr") return;
    phaseBuckets[phase.key] = { teach: 0, learn: 0 };
  });

  rows.forEach((row) => {
    const teachSkills = parseSkillsCell(row[COL_TEACH]);
    const learnSkills = parseSkillsCell(row[COL_LEARN]);

    PHASES.forEach((phase) => {
      if (phase.key === "intro" || phase.key === "qr") return;
      const keyLower = phase.key.toLowerCase();

      if (teachSkills.includes(keyLower)) {
        phaseBuckets[phase.key].teach += 1;
      }
      if (learnSkills.includes(keyLower)) {
        phaseBuckets[phase.key].learn += 1;
      }
    });
  });
}

// ==========================
// Bubbles
// ==========================

let movingBubbles = [];
let leftRect = null;
let rightRect = null;

const MIN_SIZE = 70;
const MAX_SIZE = 110;

function updateBubbleRects() {
  leftRect = leftLayer.getBoundingClientRect();
  rightRect = rightLayer.getBoundingClientRect();
}

function clearBubbles() {
  leftLayer.innerHTML = "";
  rightLayer.innerHTML = "";
  movingBubbles = [];
}

function createBubble(side) {
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  if (side === "teach") bubble.classList.add("bubble--teach");
  else bubble.classList.add("bubble--learn");

  const rect = side === "teach" ? leftRect : rightRect;

  const maxPossibleSize = Math.max(
    MIN_SIZE,
    Math.min(MAX_SIZE, rect.width, rect.height)
  );
  const size =
    MIN_SIZE >= maxPossibleSize
      ? maxPossibleSize
      : MIN_SIZE + Math.random() * (maxPossibleSize - MIN_SIZE);

  const radius = size / 2;
  const existing = movingBubbles.filter((b) => b.side === side);

  const maxAttempts = 80;
  let attempt = 0;
  let x = 0;
  let y = 0;

  function overlapsAny(nx, ny) {
    const cx = nx + radius;
    const cy = ny + radius;
    for (const other of existing) {
      const ocx = other.x + other.size / 2;
      const ocy = other.y + other.size / 2;
      const dx = cx - ocx;
      const dy = cy - ocy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = radius + other.size / 2 + 4;
      if (dist < minDist) return true;
    }
    return false;
  }

  do {
    x = Math.random() * Math.max(1, rect.width - size);
    y = Math.random() * Math.max(1, rect.height - size);
    attempt++;
  } while (attempt < maxAttempts && overlapsAny(x, y));

  const speed = 0.02 + Math.random() * 0.03;
  const angle = Math.random() * Math.PI * 2;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = "0px";
  bubble.style.top = "0px";
  bubble.style.transform = `translate(${x}px, ${y}px)`;

  movingBubbles.push({ element: bubble, side, x, y, vx, vy, size });

  return bubble;
}

function renderPhaseBubbles(phaseKey) {
  // no bubbles on intro or QR phases
  if (phaseKey === "intro" || phaseKey === "qr") {
    clearBubbles();
    return;
  }

  updateBubbleRects();

  const bucket = phaseBuckets[phaseKey];
  if (!bucket) return;

  const teachCount = Math.min(bucket.teach, MAX_BUBBLES_PER_SIDE);
  const learnCount = Math.min(bucket.learn, MAX_BUBBLES_PER_SIDE);

  for (let i = 0; i < teachCount; i++) {
    const bubble = createBubble("teach");
    leftLayer.appendChild(bubble);
  }
  for (let i = 0; i < learnCount; i++) {
    const bubble = createBubble("learn");
    rightLayer.appendChild(bubble);
  }
}

function fadeOutAllBubbles(onDone) {
  if (movingBubbles.length === 0) {
    if (typeof onDone === "function") onDone();
    return;
  }

  movingBubbles.forEach((b) => {
    b.element.classList.add("bubble--fade-out");
  });

  setTimeout(() => {
    clearBubbles();
    if (typeof onDone === "function") onDone();
  }, BUBBLE_FADE_DURATION);
}

function onPhaseChange(newIndex) {
  const phase = PHASES[newIndex];
  fadeOutAllBubbles(() => {
    renderPhaseBubbles(phase.key);
  });
}

function resolveCollisions() {
  ["teach", "learn"].forEach((side) => {
    const sideBubbles = movingBubbles.filter((b) => b.side === side);

    for (let i = 0; i < sideBubbles.length; i++) {
      for (let j = i + 1; j < sideBubbles.length; j++) {
        const b1 = sideBubbles[i];
        const b2 = sideBubbles[j];

        const r1 = b1.size / 2;
        const r2 = b2.size / 2;
        const cx1 = b1.x + r1;
        const cy1 = b1.y + r1;
        const cx2 = b2.x + r2;
        const cy2 = b2.y + r2;

        let dx = cx2 - cx1;
        let dy = cy2 - cy1;
        let dist = Math.sqrt(dx * dx + dy * dy);

        const minDist = r1 + r2 + 4;

        if (dist > 0 && dist < minDist) {
          const overlap = minDist - dist;

          dx /= dist;
          dy /= dist;

          b1.x -= (dx * overlap) / 2;
          b1.y -= (dy * overlap) / 2;
          b2.x += (dx * overlap) / 2;
          b2.y += (dy * overlap) / 2;

          b1.vx *= 0.98;
          b1.vy *= 0.98;
          b2.vx *= 0.98;
          b2.vy *= 0.98;
        }
      }
    }
  });
}

let lastTime = null;
function animateBubbles(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (!leftRect || !rightRect) {
    updateBubbleRects();
  }

  movingBubbles.forEach((b) => {
    const rect = b.side === "teach" ? leftRect : rightRect;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x <= 0) {
      b.x = 0;
      b.vx *= -1;
    } else if (b.x + b.size >= rect.width) {
      b.x = rect.width - b.size;
      b.vx *= -1;
    }

    if (b.y <= 0) {
      b.y = 0;
      b.vy *= -1;
    } else if (b.y + b.size >= rect.height) {
      b.y = rect.height - b.size;
      b.vy *= -1;
    }
  });

  resolveCollisions();

  movingBubbles.forEach((b) => {
    b.element.style.transform = `translate(${b.x}px, ${b.y}px)`;
  });

  requestAnimationFrame(animateBubbles);
}
requestAnimationFrame(animateBubbles);

window.addEventListener("resize", () => {
  updateBubbleRects();
});

// ==========================
// TSV refresh
// ==========================
async function initData() {
  try {
    setStatus("Fetching CEID Exchange responses…");
    const tsv = await fetchTSV(SHEET_TSV_URL);
    const rows = parseTSV(tsv);
    setStatus(`Loaded ${rows.length} responses`);
    buildPhaseBuckets(rows);

    onPhaseChange(currentPhaseIndex);
  } catch (err) {
    console.error(err);
    setStatus("Could not load sheet – using demo data.");

    const fakeRows = [
      { [COL_TEACH]: "Fabrication, 3D Printing", [COL_LEARN]: "Laser Cutting" },
      { [COL_TEACH]: "Computer-aided Design", [COL_LEARN]: "Machining" },
      { [COL_TEACH]: "Sewing & Textiles", [COL_LEARN]: "Fabrication" }
    ];
    buildPhaseBuckets(fakeRows);
    onPhaseChange(currentPhaseIndex);
  }
}

document.addEventListener("DOMContentLoaded", initData);

// Refresh every 1 minute for data
setInterval(async () => {
  try {
    console.log("Refreshing CEID Exchange data…");

    const tsv = await fetchTSV(SHEET_TSV_URL);
    const rows = parseTSV(tsv);
    buildPhaseBuckets(rows);
    onPhaseChange(currentPhaseIndex);
    setStatus("Responses updated");
  } catch (err) {
    console.error("Auto-refresh failed:", err);
    setStatus("Auto-refresh failed.");
  }
}, 60000);

// ==========================
// Morphing points (words + QR)
// ==========================

let pointSets = [];
let color_1;
let color_2;

// per-phase point counts
const BASE_POINTS = 2000;
const QR_POINTS = 7000;    // denser for QR

let qrImg;
function preload() {
  qrImg = loadImage("qr.png");
}

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0, 0);
  cnv.style("z-index", "5");
  cnv.style("pointer-events", "none");

  textAlign(CENTER, CENTER);
  textSize(height / 8);

  color_1 = color(255, 140, 10);
  color_2 = color(25, 140, 250);

  pointSets = [];


  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    let pts = [];

    background(255);

    if (phase.key === "qr") {
      const qrSize = Math.min(width, height) * 0.4;
      imageMode(CENTER);
      image(qrImg, width / 2, height / 2, qrSize, qrSize);

      const xMin = width / 2 - qrSize / 2;
      const xMax = width / 2 + qrSize / 2;
      const yMin = height / 2 - qrSize / 2;
      const yMax = height / 2 + qrSize / 2;

      const gridSize = 4;
      for (let x = xMin; x < xMax; x += gridSize) {
        for (let y = yMin; y < yMax; y += gridSize) {
          const c = get(x, y);
          if (red(c) < 200 && green(c) < 200 && blue(c) < 200) {
            pts.push({ x, y });
          }
        }
      }
      if (pts.length > QR_POINTS) {
        pts = pts.slice(0, QR_POINTS);
      }

      pointSets.push(pts);
    } else {
      // ----- TEXT SHAPE -----
      let points_found = 0;
      const target = BASE_POINTS;

      fill(0);
      noStroke();
      text(phase.label, width / 2, height / 2);

      while (points_found < target) {
        const x = random(width * 0.1, width * 0.9);
        const y = random(height * 0.3, height * 0.7);
        const pixel_color = get(x, y);

        if (
          red(pixel_color) === 0 &&
          green(pixel_color) === 0 &&
          blue(pixel_color) === 0
        ) {
          pts.push({ x, y });
          points_found++;
        }
      }

      pointSets.push(pts);
    }
  }

  clear();
  previousPhaseIndex = 0;
  currentPhaseIndex = 0;
  phaseElapsedMs = 0;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  if (pointSets.length !== PHASES.length) return;

  const phase = PHASES[currentPhaseIndex];
  const isQRPhase = phase.key === "qr";
  
  clear();

  phaseElapsedMs += deltaTime;
  const duration = phase.duration;

  let morphT;
  if (currentPhaseIndex !== previousPhaseIndex) {
    const morphDuration = duration * MORPH_FRACTION;
    const raw = constrain(phaseElapsedMs / morphDuration, 0, 1);
    morphT = 0.5 - 0.5 * cos(PI * raw);
  } else {
    morphT = 0;
  }

  const fromIndex = previousPhaseIndex;
  const toIndex = currentPhaseIndex;
  const pts1 = pointSets[fromIndex];
  const pts2 = pointSets[toIndex];

  const drawCount = isQRPhase ? QR_POINTS : BASE_POINTS;

  const color_t = sin(frameCount / 50) / 2 + 0.5;
  const baseColor = lerpColor(color_1, color_2, color_t);

  const cc = baseColor;
  fill(cc);
  stroke(cc);

  const dotSize = isQRPhase ? 4 : 3;

  for (let i = 0; i < drawCount; i++) {
    const p1 = pts1[i % pts1.length];
    const p2 = pts2[i % pts2.length];

    const new_x = lerp(p1.x, p2.x, morphT);
    const new_y = lerp(p1.y, p2.y, morphT);

    ellipse(new_x, new_y, dotSize);
  }

  if (phaseElapsedMs >= duration) {
    phaseElapsedMs = 0;
    previousPhaseIndex = currentPhaseIndex;
    currentPhaseIndex = (currentPhaseIndex + 1) % PHASES.length;
    onPhaseChange(currentPhaseIndex);
  }
}