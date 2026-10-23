import { describe, expect, test } from 'bun:test';
import data from '../../data/lyrics.json';
import { Lyrics } from '../src/engine/lyrics';
import { F, smart } from '../src/engine/type';
import { chineseLine, sourceText, sourceWord } from '../src/localization/chinese';
import { VISIBLE_ENGLISH_COPY, zhCopy } from '../src/localization/copy';

const lyrics = new Lyrics(data as any);

describe('Chinese lyric display layer', () => {
  test('localizes all 46 sung lines without mutating the English source', () => {
    const sourceBefore = JSON.stringify(data);

    expect(lyrics.lines).toHaveLength(46);
    for (const line of lyrics.lines) {
      const shown = chineseLine(line);
      expect(/[\u3400-\u9fff]/u.test(shown.text)).toBe(true);
      expect(shown.words).toHaveLength(line.words.length);
      expect(shown.words.map((word) => word.w).join('')).toBe(shown.text);
      expect(sourceText(shown)).toBe(smart((data.lines[line.i] as any).text));
      shown.words.forEach((word, index) => {
        expect(word.w.length).toBeGreaterThan(0);
        expect(sourceWord(word).w).toBe(smart((data.lines[line.i] as any).words[index].w));
      });
    }

    expect(JSON.stringify(data)).toBe(sourceBefore);
  });

  test('keeps every Chinese word slot on its source vocal timing', () => {
    for (const line of lyrics.lines) {
      const shown = chineseLine(line);
      shown.words.forEach((word, index) => {
        const source = line.words[index]!;
        expect(word.start).toBe(source.start);
        expect(word.end).toBe(source.end);
        expect(word.end).toBeGreaterThan(word.start);
        if (index > 0) expect(word.start).toBeGreaterThanOrEqual(shown.words[index - 1]!.end - 1e-8);
        expect(Lyrics.wordProgress(word, word.start - 0.001)).toBe(0);
        expect(Lyrics.wordProgress(word, word.end)).toBe(1);
      });
    }
  });

  test('leaves English lookup keys available for the timeline and scenes', () => {
    expect(lyrics.get('There was a sudden drop').i).toBe(3);
    expect(lyrics.get("I'm upping", 3).i).toBe(40);
    expect(lyrics.findWords('P(doom)')).toHaveLength(4);
    expect(chineseLine(lyrics.get('What did Ilya')).text).toContain('伊利亚');
  });
});

test('bundles and registers the Simplified Chinese display face', async () => {
  expect(F.zh()).toBe('NotoSansSC');
  const fontFile = Bun.file(new URL('../public/fonts/NotoSansCJKsc-Medium.otf', import.meta.url));
  expect(await fontFile.exists()).toBe(true);
  expect(fontFile.size).toBeGreaterThan(1_000_000);
});

test('maps the known on-screen English interface copy to Chinese', () => {
  const required = [
    'FORM 7-B',
    'SAFETY EVALUATION OF A FRONTIER SYSTEM',
    'PROMPT',
    'REPLY',
    'AUTOMATIC REPLY',
    'DO NOT REPLY',
    'REVIEW SCHEDULE — AGI, v1.0',
    'YOU ARE HERE',
    'LOSS (LOG)',
    'STEP →',
    'Regenerate',
    'this response could not be verified',
  ];
  for (const text of required) {
    expect(VISIBLE_ENGLISH_COPY).toContain(text);
    expect(zhCopy(text)).not.toBe(text);
    expect(/[\u3400-\u9fff]/u.test(zhCopy(text))).toBe(true);
  }
  expect(zhCopy('WK 31')).toBe('第 31 周');
  expect(zhCopy('STATUS: NOT HELD')).toBe('状态：未举行');
  expect(zhCopy('Current P(doom): 0.81 (this message was sent automatically)')).toBe('当前 P(doom)：0.81（此消息由系统自动发送）');
});
