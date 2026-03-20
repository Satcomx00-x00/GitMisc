import { describe, expect, it } from 'vitest';
import { ResponseParser } from '../services/ResponseParser';

describe('ResponseParser', () => {
  const parser = new ResponseParser();

  it('parses SUBJECT and BODY', () => {
    const result = parser.parse(
      'SUBJECT: feat(api): add user endpoint\nBODY: Adds GET /users for listing users',
    );
    expect(result.subject).toBe('feat(api): add user endpoint');
    expect(result.body).toBe('Adds GET /users for listing users');
  });

  it('returns empty body when BODY line is absent', () => {
    const result = parser.parse('SUBJECT: chore: update deps');
    expect(result.subject).toBe('chore: update deps');
    expect(result.body).toBe('');
  });

  it('returns empty body when BODY value is blank', () => {
    const result = parser.parse('SUBJECT: fix(auth): handle expiry\nBODY: ');
    expect(result.subject).toBe('fix(auth): handle expiry');
    expect(result.body).toBe('');
  });

  it('parses multi-line BODY', () => {
    const raw = [
      'SUBJECT: refactor(core): split service layer',
      'BODY: Split the monolithic service.',
      'Each unit has a single responsibility.',
    ].join('\n');
    const result = parser.parse(raw);
    expect(result.subject).toBe('refactor(core): split service layer');
    expect(result.body).toBe('Split the monolithic service.\nEach unit has a single responsibility.');
  });

  it('is case-insensitive for SUBJECT: and BODY: prefixes', () => {
    const result = parser.parse('subject: feat: lower\nbody: lower body');
    expect(result.subject).toBe('feat: lower');
    expect(result.body).toBe('lower body');
  });

  it('falls back to using raw string as subject when template not followed', () => {
    const raw = 'feat: plain message without template';
    const result = parser.parse(raw);
    expect(result.subject).toBe(raw);
    expect(result.body).toBe('');
  });

  it('trims trailing blank lines from body', () => {
    const raw = 'SUBJECT: docs: update readme\nBODY: First line\n\n\n';
    const result = parser.parse(raw);
    expect(result.body).toBe('First line');
  });

  it('trims surrounding whitespace from subject', () => {
    const result = parser.parse('SUBJECT:   feat: extra spaces   ');
    expect(result.subject).toBe('feat: extra spaces');
  });

  it('returns trimmed raw text as subject for completely empty input', () => {
    const result = parser.parse('   ');
    expect(result.subject).toBe('');
    expect(result.body).toBe('');
  });
});
