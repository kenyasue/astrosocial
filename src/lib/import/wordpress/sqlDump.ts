/**
 * Minimal MySQL dump parser for WordPress exports.
 *
 * `mysqldump` emits extended INSERT statements — one `INSERT INTO` followed by
 * many `(...)` value tuples — with backslash-escaped string literals. This
 * parser extracts those rows into plain objects keyed by column name. It is
 * deliberately scoped to what a WordPress import needs (string/number/NULL
 * values); it is not a general SQL engine.
 */

/** A parsed row: column name → decoded string value, or null for SQL NULL. */
export type DumpRow = Record<string, string | null>;

/**
 * Parse every `INSERT INTO \`table\` (...) VALUES (...), (...);` statement for
 * the given table and return the rows as objects keyed by the insert's column
 * list.
 *
 * @param sql - The full dump text
 * @param table - Table name (without backticks), e.g. `wp_posts`
 */
export function parseInsertRows(sql: string, table: string): DumpRow[] {
  const rows: DumpRow[] = [];
  const header = new RegExp('INSERT INTO `' + escapeRegExp(table) + '` \\(([^)]*)\\) VALUES', 'g');

  let match: RegExpExecArray | null;
  while ((match = header.exec(sql)) !== null) {
    const columns = match[1].split(',').map((c) => c.trim().replace(/^`|`$/g, ''));
    const tuples = readTuples(sql, header.lastIndex);
    header.lastIndex = tuples.endIndex;
    for (const values of tuples.tuples) {
      const row: DumpRow = {};
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i] ?? null;
      }
      rows.push(row);
    }
  }
  return rows;
}

interface TuplesResult {
  tuples: (string | null)[][];
  /** Index just past the terminating `;`. */
  endIndex: number;
}

/**
 * Read the comma-separated value tuples that follow a `VALUES` keyword, starting
 * at `start`, until the terminating semicolon that sits outside any string.
 */
function readTuples(sql: string, start: number): TuplesResult {
  const tuples: (string | null)[][] = [];
  let i = start;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];
    if (ch === ';') {
      i++;
      break;
    }
    if (ch === '(') {
      const parsed = readTuple(sql, i + 1);
      tuples.push(parsed.values);
      i = parsed.endIndex;
      continue;
    }
    // Whitespace, commas between tuples, and stray newlines.
    i++;
  }

  return { tuples, endIndex: i };
}

interface TupleResult {
  values: (string | null)[];
  /** Index just past the closing `)`. */
  endIndex: number;
}

/** Read a single `(...)` tuple whose first value begins at `start`. */
function readTuple(sql: string, start: number): TupleResult {
  const values: (string | null)[] = [];
  let i = start;
  const len = sql.length;
  let current = '';
  let started = false; // have we begun reading a (non-string) value token?

  while (i < len) {
    const ch = sql[i];

    if (ch === "'") {
      // A quoted string value.
      const parsed = readQuotedString(sql, i + 1);
      values.push(parsed.value);
      i = parsed.endIndex;
      current = '';
      started = false;
      // Skip until the next comma or closing paren.
      while (i < len && sql[i] !== ',' && sql[i] !== ')') i++;
      if (sql[i] === ',') i++;
      continue;
    }

    if (ch === ',') {
      if (started) values.push(decodeBareValue(current.trim()));
      current = '';
      started = false;
      i++;
      continue;
    }

    if (ch === ')') {
      if (started) values.push(decodeBareValue(current.trim()));
      i++;
      break;
    }

    current += ch;
    if (!/\s/.test(ch)) started = true;
    i++;
  }

  return { values, endIndex: i };
}

interface StringResult {
  value: string;
  /** Index just past the closing quote. */
  endIndex: number;
}

/** Read a backslash-escaped single-quoted string whose body begins at `start`. */
function readQuotedString(sql: string, start: number): StringResult {
  let out = '';
  let i = start;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];
    if (ch === '\\') {
      out += decodeEscape(sql[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (ch === "'") {
      // Doubled '' is an escaped quote in standard SQL; otherwise end of string.
      if (sql[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      i++;
      break;
    }
    out += ch;
    i++;
  }

  return { value: out, endIndex: i };
}

/** Decode the character following a backslash inside a MySQL string literal. */
function decodeEscape(next: string): string {
  switch (next) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case '0':
      return '\0';
    case 'b':
      return '\b';
    case 'Z':
      return '\x1a';
    default:
      // \\, \', \", and any other escaped char map to the literal char.
      return next;
  }
}

/** Decode an unquoted token: `NULL` → null, otherwise the trimmed literal. */
function decodeBareValue(token: string): string | null {
  if (token === '' || token.toUpperCase() === 'NULL') return null;
  return token;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
