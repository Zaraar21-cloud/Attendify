const text = "OOPJ DBMS Nptel Object Oriented Programming through Java Lab-(9108 &9109)-4";

const labRegex = /(?:(?:(?![A-Z]+\b)[A-Za-z]{3,})\s+)+L[.\s]*a[.\s]*b(?:[\s-]*\d*)?/g;

const NOISE_WORDS = new Set([
  "lunch", "break", "recess", "free",
  "lab", "tutorial", "practical", "through", "oriented",
  "programming", "management", "systems", "engineering",
  "computational", "mathematics", "database", "object",
  "software", "java", "data", "base",
  "library", "nptel", "sports",
  "eno", "ww", "ow", "lt", "ty",
]);

function isSubjectCode(word) {
  const clean = word.replace(/[^A-Za-z]/g, "").trim();
  if (clean.length < 2 || clean.length > 5) return false;
  if (NOISE_WORDS.has(clean.toLowerCase())) return false;
  if (/^\d+$/.test(word)) return false;
  if (/^[IVXLCDM]+$/i.test(clean) && clean.length <= 4) return false;
  if (!/^[A-Z]{2,5}$/i.test(clean)) return false;
  return true;
}

function extractLabs(text) {
  const labs = [];
  let match;
  const cleanedArr = text.split("");

  while ((match = labRegex.exec(text)) !== null) {
    const rawMatch = match[0];
    labs.push({ label: rawMatch.trim(), index: match.index });
    for (let i = 0; i < rawMatch.length; i++) {
      cleanedArr[match.index + i] = " ";
    }
  }
  return { labs, cleaned: cleanedArr.join("") };
}

function extractSlots(text) {
  const { labs, cleaned: textWithoutLabs } = extractLabs(text);
  const cleanText = textWithoutLabs.replace(/\bLUNCH\b/gi, (m) => " ".repeat(m.length));

  const tokenizableText = cleanText
    .replace(/\([^)]*\)/g, (m) => " ".repeat(m.length))
    .replace(/[|=\[\]{}<>]/g, " ")
    .replace(/\b\d{4}\b/g, "    ")
    .replace(/\.\s/g, "  ");

  const wordRegex = /[A-Za-z0-9]+/g;
  const subjects = [];
  let wMatch;

  while ((wMatch = wordRegex.exec(tokenizableText)) !== null) {
    const token = wMatch[0];
    if (isSubjectCode(token)) {
      const label = token.toUpperCase().replace(/0/g, "O").replace(/[^A-Z]/g, "");
      subjects.push({ label, index: wMatch.index });
    }
  }

  const regularCount = subjects.length;
  if (labs.length === 0) {
    return subjects.map(s => s.label).slice(0, 8);
  }

  const remainingSlots = 8 - regularCount;
  let labSlots = 0;
  if (labs.length === 1) {
    labSlots = Math.max(2, Math.min(4, remainingSlots));
  } else {
    const perLab = Math.floor(remainingSlots / labs.length);
    labSlots = Math.max(2, Math.min(4, perLab));
  }

  const items = [...labs, ...subjects];
  items.sort((a, b) => a.index - b.index);

  const resultSlots = [];
  for (const item of items) {
    const isLab = labs.some(l => l.index === item.index && l.label === item.label);
    if (isLab) {
      for (let i = 0; i < labSlots; i++) {
        if (resultSlots.length < 8) resultSlots.push(item.label);
      }
    } else {
      if (resultSlots.length < 8) resultSlots.push(item.label);
    }
  }
  return resultSlots;
}

console.log("Labs:", extractLabs(text).labs);
console.log("Slots:", extractSlots(text));
