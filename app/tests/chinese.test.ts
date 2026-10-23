import { describe, expect, test } from 'bun:test';
import data from '../../data/lyrics.json';
import { Lyrics } from '../src/engine/lyrics';
import { chineseLine, sourceText, sourceWord } from '../src/localization/chinese';

const lyrics = new Lyrics(data as any);

describe('Chinese lyric display layer', () => {
  test('localizes all 46 sung lines without mutating the English source', () => {
    const before = JSON.stringify(lyrics.lines);

    expect(lyrics.lines).toHaveLength(46);
    for (const line of lyrics.lines) {
      const shown = chineseLine(line);
      expect(/[\u3400-\u9fff]/u.test(shown.text)).toBe(true);
      expect(shown.words).toHaveLength(line.words.length);
      expect(shown.words.map((word) => word.w).join('')).toBe(shown.text);
      expect(sourceText(shown)).toBe(line.text);
      shown.words.forEach((word, index) => {
        expect(word.w.length).toBeGreaterThan(0);
        expect(sourceWord(word)).toBe(line.words[index]);
      });
    }

    expect(JSON.stringify(lyrics.lines)).toBe(before);
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
