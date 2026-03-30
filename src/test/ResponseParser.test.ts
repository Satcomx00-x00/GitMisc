import { describe, expect, it } from 'vitest';
import { ResponseParser } from '../services/ResponseParser';

describe('ResponseParser', () => {
  const parser = new ResponseParser();

  it('extracts a single-line commit message from a ```text code block', () => {
    const result = parser.parse('```text\nfeat(api): add user endpoint\n```');
    expect(result.subject).toBe('feat(api): add user endpoint');
    expect(result.body).toBe('');
  });

  it('extracts subject and body when separated by a blank line inside the code block', () => {
    const result = parser.parse(
      '```text\nfeat(api): add user endpoint\n\nAdds GET /users for listing users.\n```',
    );
    expect(result.subject).toBe('feat(api): add user endpoint');
    expect(result.body).toBe('Adds GET /users for listing users.');
  });

  it('falls back to raw string parsing when no ```text code block is present', () => {
    const raw = 'feat: plain message without code block';
    const result = parser.parse(raw);
    expect(result.subject).toBe(raw);
    expect(result.body).toBe('');
  });

  it('parses subject and body from raw string when no code block is present', () => {
    const raw = 'refactor(core): split service layer\n\nEach unit has a single responsibility.';
    const result = parser.parse(raw);
    expect(result.subject).toBe('refactor(core): split service layer');
    expect(result.body).toBe('Each unit has a single responsibility.');
  });

  it('handles multi-line body inside a code block', () => {
    const raw =
      '```text\nrefactor(core): split service layer\n\nSplit the monolithic service.\nEach unit has a single responsibility.\n```';
    const result = parser.parse(raw);
    expect(result.subject).toBe('refactor(core): split service layer');
    expect(result.body).toBe('Split the monolithic service.\nEach unit has a single responsibility.');
  });

  it('trims trailing blank lines from the body', () => {
    const raw = '```text\ndocs: update readme\n\nFirst line\n\n\n```';
    const result = parser.parse(raw);
    expect(result.body).toBe('First line');
  });

  it('trims surrounding whitespace from the subject', () => {
    const result = parser.parse('```text\n  feat: extra spaces  \n```');
    expect(result.subject).toBe('feat: extra spaces');
  });

  it('handles a code block with leading and trailing whitespace outside the block', () => {
    const result = parser.parse('\n\n```text\nfeat: test\n```\n\n');
    expect(result.subject).toBe('feat: test');
    expect(result.body).toBe('');
  });

  it('returns empty subject for completely empty input', () => {
    const result = parser.parse('   ');
    expect(result.subject).toBe('');
    expect(result.body).toBe('');
  });

  it('uses body lines immediately after the subject when there is no blank separator', () => {
    const raw = '```text\nfeat: add thing\nsome context\n```';
    const result = parser.parse(raw);
    expect(result.subject).toBe('feat: add thing');
    expect(result.body).toBe('some context');
  });
});
