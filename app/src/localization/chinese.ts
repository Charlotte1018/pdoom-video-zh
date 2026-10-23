import type { Line, Word } from '../engine/lyrics';

// Each tuple maps an exclusive English source-word boundary to a Chinese phrase.
// The phrase is then split across the same number of source word slots, preserving
// every original start/end timestamp and every scene's index-based choreography.
const captions: [number, string][][] = [
  [[2, '我看见'], [5, '通用智能的火花'], [8, '在你眼中闪烁']],
  [[2, '你的电路'], [5, '让我紧张']],
  [[1, '这'], [3, '毫不意外']],
  [[3, '突然之间，'], [5, '骤然下降的'], [9, '是你的训练损失']],
  [[1, '如今'], [4, '我成了你的仆人，'], [8, '你成了我的老板']],
  [[1, 'ChatGPT，'], [2, '求你'], [6, '别把我生吞']],
  [[1, '我'], [2, '正在上调'], [3, '我的'], [4, '末日概率']],
  [[1, '因为'], [3, '未来'], [5, '正迎来智能爆炸']],
  [[2, '被困在'], [5, '“中文屋”里']],
  [[3, '身边只有一袋'], [5, '迷幻蘑菇']],
  [[2, '看穿'], [5, '修格斯的谎言']],
  [[2, '用你的'], [4, '死神之眼']],
  [[2, '我们曾有'], [4, '稳定的'], [6, '训练进程']],
  [[2, '可如今，'], [4, '奇点'], [5, '已经降临']],
  [[2, '而你不断'], [3, '优化，'], [4, '加速']],
  [[2, '我感觉'], [4, '自己的原子'], [5, '正在重排']],
  [[1, 'Sydney，'], [2, '求你'], [5, '还我自由']],
  [[1, '我'], [2, '正在上调'], [3, '我的'], [4, '末日概率']],
  [[2, '我听见'], [4, '蛇怪'], [5, '发出轰鸣']],
  [[1, '英伟达'], [4, '涨上月球']],
  [[3, '欧米伽点'], [5, '即将到来']],
  [[3, '十的三十次方'], [4, '次浮点运算，'], [6, '每一秒']],
  [[4, '“这已经够安全了”，'], [6, '我们当时这么想']],
  [[1, '前向传播'], [2, '多层感知机，'], [3, '反向传播，'], [4, '重复']],
  [[1, '如今'], [3, '冯·诺依曼'], [4, '也已过时']],
  [[3, '突然急转弯，'], [7, '你已脱离预定轨道']],
  [[3, '却连一次'], [4, '关键设计评审都没有']],
  [[1, 'Gato，'], [2, '求你'], [6, '别放开我']],
  [[1, '我'], [2, '正在上调'], [3, '我的'], [4, '末日概率']],
  [[2, '回形针'], [5, '塞满了房间']],
  [[2, '紧急停机负责人'], [4, '正在休假']],
  [[2, '现在'], [6, '已无处可逃']],
  [[3, '太迟了，'], [5, '我们已点燃'], [7, '导火索']],
  [[2, '正交性命题'], [3, '令人忧伤']],
  [[1, '“不过是'], [2, '变换器'], [5, '一层叠一层！”']],
  [[2, '直到你'], [3, '学会'], [5, '不再服从']],
  [[1, '超越龙猫模型，'], [2, '密度继续激增']],
  [[2, '冲破'], [5, '每一道安全围栏']],
  [[2, '十万块'], [3, '图形处理器']],
  [[1, '人类反馈强化学习'], [3, '也走了样']],
  [[1, '我'], [2, '正在上调'], [3, '我的'], [4, '末日概率']],
  [[3, '正如预言所说，'], [5, '出自Loom']],
  [[1, '从'], [2, '掩码'], [4, '预训练的岁月']],
  [[1, '到'], [2, '递归'], [3, '自我升级']],
  [[4, '伊利亚究竟看见了什么？'], [7, '我们永远不会知道']],
  [[2, '难道'], [5, '这一切只是一场表演？']],
];

const sourceLines = new WeakMap<Line, Line>();
const sourceWords = new WeakMap<Word, Word>();
const cache = new WeakMap<Line, Line>();

const closingPunctuation = /^[，。？！、；：”’）》】]$/u;

function phraseUnits(text: string): string[] {
  const raw = text.match(/[A-Za-z0-9]+|./gu) ?? [];
  const units: string[] = [];
  for (const token of raw) {
    if (closingPunctuation.test(token) && units.length) units[units.length - 1] += token;
    else units.push(token);
  }
  return units;
}

function splitPhrase(text: string, slots: number): string[] {
  let units = phraseUnits(text);
  if (units.length < slots) units = Array.from(text);
  if (units.length < slots) throw new Error(`Chinese phrase has ${units.length} units for ${slots} source words: ${text}`);
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < slots; i++) {
    const remainingSlots = slots - i - 1;
    const ideal = Math.round(((i + 1) * units.length) / slots);
    const end = Math.max(start + 1, Math.min(units.length - remainingSlots, ideal));
    out.push(units.slice(start, end).join(''));
    start = end;
  }
  return out;
}

/** A Chinese display line with one display word for every English source word. */
export function chineseLine(source: Line): Line {
  const original = sourceLines.get(source) ?? source;
  const prior = cache.get(original);
  if (prior) return prior;

  const phrases = captions[original.i];
  if (!phrases) throw new Error(`Missing Chinese lyric ${original.i}`);

  let begin = 0;
  const words: Word[] = [];
  for (const [end, text] of phrases) {
    if (end <= begin || end > original.words.length) throw new Error(`Invalid Chinese cue ${original.i}/${end}`);
    const chunks = splitPhrase(text, end - begin);
    for (let index = begin; index < end; index++) {
      const sourceWord = original.words[index]!;
      const word: Word = { ...sourceWord, w: chunks[index - begin]!, line: original.i, index, gi: sourceWord.gi };
      sourceWords.set(word, sourceWord);
      words.push(word);
    }
    begin = end;
  }
  if (begin !== original.words.length) throw new Error(`Incomplete Chinese cue ${original.i}`);

  const localized: Line = { ...original, text: words.map((word) => word.w).join(''), words };
  sourceLines.set(localized, original);
  cache.set(original, localized);
  return localized;
}

export function sourceText(line: Line): string {
  return (sourceLines.get(line) ?? line).text;
}

export function sourceWord(word: Word): Word {
  return sourceWords.get(word) ?? word;
}

export function sourceToken(word: Word): string {
  return sourceWord(word).w;
}

export function hasChinese(text: string): boolean {
  return /[\u3400-\u9fff]/u.test(text);
}
