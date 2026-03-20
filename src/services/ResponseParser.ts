import type { ParsedCommitMessage } from '../types';
import type { IResponseParser } from '../interfaces';

/**
 * SRP: Responsible only for parsing the structured SUBJECT/BODY response
 *      emitted by the AI according to the configured system prompt template.
 *
 * Expected AI output format:
 *   SUBJECT: feat(scope): short description
 *   BODY: optional multi-line body
 *         that can span several lines
 *
 * Fallback: if the format is not followed, the entire raw response is treated
 * as the subject and the body is left empty.
 */
export class ResponseParser implements IResponseParser {
  private static readonly SUBJECT_PREFIX = 'SUBJECT:';
  private static readonly BODY_PREFIX = 'BODY:';

  parse(raw: string): ParsedCommitMessage {
    const lines = raw.split('\n');

    let subject = '';
    let bodyLines: string[] = [];
    let inBody = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!inBody && trimmed.toUpperCase().startsWith(ResponseParser.SUBJECT_PREFIX)) {
        subject = trimmed.slice(ResponseParser.SUBJECT_PREFIX.length).trim();
        continue;
      }

      if (trimmed.toUpperCase().startsWith(ResponseParser.BODY_PREFIX)) {
        inBody = true;
        const bodyFirstLine = trimmed.slice(ResponseParser.BODY_PREFIX.length).trim();
        if (bodyFirstLine) {
          bodyLines.push(bodyFirstLine);
        }
        continue;
      }

      if (inBody) {
        bodyLines.push(line); // preserve original indentation in body
      }
    }

    // Fallback: model did not follow the template
    if (!subject) {
      return { subject: raw.trim(), body: '' };
    }

    // Trim trailing blank lines from body
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
      bodyLines.pop();
    }

    return { subject, body: bodyLines.join('\n') };
  }
}
