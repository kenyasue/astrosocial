import { describe, it, expect } from 'vitest';
import { parseInsertRows } from './sqlDump';

describe('parseInsertRows', () => {
  it('parses a single-row insert into column-keyed objects', () => {
    const sql = "INSERT INTO `wp_users` (`ID`, `user_login`, `user_email`) VALUES (1, 'ken', 'ken@x.io');";
    const rows = parseInsertRows(sql, 'wp_users');
    expect(rows).toEqual([{ ID: '1', user_login: 'ken', user_email: 'ken@x.io' }]);
  });

  it('parses extended multi-row inserts', () => {
    const sql =
      "INSERT INTO `wp_terms` (`term_id`, `name`) VALUES\n(1, 'Deep space'),\n(2, 'Saturn');";
    const rows = parseInsertRows(sql, 'wp_terms');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ term_id: '2', name: 'Saturn' });
  });

  it('decodes NULL to null', () => {
    const sql = "INSERT INTO `t` (`a`, `b`) VALUES (1, NULL);";
    expect(parseInsertRows(sql, 't')[0]).toEqual({ a: '1', b: null });
  });

  it('decodes backslash escapes including quotes, newlines, and HTML attributes', () => {
    const sql =
      "INSERT INTO `wp_posts` (`ID`, `post_content`) VALUES " +
      "(7, '<figure class=\\\"x\\\"><img src=\\\"a.jpg\\\"/></figure>\\nIt\\'s great');";
    const row = parseInsertRows(sql, 'wp_posts')[0];
    expect(row.post_content).toBe('<figure class="x"><img src="a.jpg"/></figure>\nIt\'s great');
  });

  it('does not confuse a comma or paren inside a string with structure', () => {
    const sql = "INSERT INTO `t` (`a`, `b`) VALUES ('x, (y) z', 'end');";
    expect(parseInsertRows(sql, 't')[0]).toEqual({ a: 'x, (y) z', b: 'end' });
  });

  it('handles multiple statements for the same table', () => {
    const sql =
      "INSERT INTO `t` (`a`) VALUES ('1');\nINSERT INTO `t` (`a`) VALUES ('2'),('3');";
    expect(parseInsertRows(sql, 't').map((r) => r.a)).toEqual(['1', '2', '3']);
  });

  it('ignores other tables', () => {
    const sql = "INSERT INTO `other` (`a`) VALUES ('1');\nINSERT INTO `t` (`a`) VALUES ('2');";
    expect(parseInsertRows(sql, 't')).toEqual([{ a: '2' }]);
  });

  it('returns an empty array when the table is absent', () => {
    expect(parseInsertRows('SELECT 1;', 'missing')).toEqual([]);
  });
});
