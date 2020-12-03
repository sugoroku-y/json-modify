/**
 * タグ付きテンプレートリテラルで生成した文字列をメッセージとして例外を投げる
 *
 * @param strings
 * @param values
 */
function error(strings: TemplateStringsArray, ...values: unknown[]): never {
  throw new Error(
    strings[0] +
      values.map((value, index) => value + strings[index + 1]).join('')
  );
}

function assert(condition: false, message?: string): never;
function assert(
  condition: boolean,
  message?: string
): asserts condition is true;
function assert<T extends [] | {}>(
  condition: T | undefined | null,
  message?: string
): asserts condition is T;
function assert<T>(
  condition: unknown,
  typeGuard: (o: unknown) => o is T,
  message?: string
): asserts condition is T;
function assert<
  T extends
    | [false, string?]
    | [boolean, string?]
    | [unknown, string?]
    | [unknown, (o: unknown) => boolean, string?]
>(...args: T) {
  const [condition, message] =
    typeof args[1] === 'function'
      ? [args[1](args[0]), args[2]]
      : !args[1] || typeof args[1] === 'string'
      ? [args[0], args[1]]
      : error`Unreachable`;
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * エスケープを外した文字列を返す。
 *
 * @param {string} s
 * @returns {string}
 */
export function unescape(s: string): string {
  return s.replace(
    /\\(?:x([0-9A-Fa-f]{2})|u([0-9A-Fa-f]{4})|.)/g,
    (ch, code, ucode) =>
      ucode
        ? String.fromCharCode(parseInt(ucode, 16))
        : code
        ? String.fromCharCode(parseInt(code, 16))
        : ch[1] === 't'
        ? '\t'
        : ch[1] === 'r'
        ? '\r'
        : ch[1] === 'n'
        ? '\n'
        : ch[1]
  );
}

/**
 * 文字列を数値、真偽値、null値、文字列値のいずれかに変換する。
 *
 * true/false/nullはそれぞれその値に変換。
 * 先頭が`+`、`-`、`.`、数字で続く文字列が数値を示すものであれば数値に変換。
 * 文字列値の場合、''で囲まれているものは囲いを外し、エスケープされていればエスケープを外す。
 * 上記に当てはまらないものはそのまま文字列と見なす。
 *
 * @param {string} s
 * @returns {(string | number | boolean | null)}
 */
export function evaluate(s: string): string | number | boolean | null {
  // true/false/nullはそのまま
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  // 数値として扱える文字列は数値
  if (/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(s)) {
    return +s;
  }
  // ''で囲まれた文字列はエスケープを外して文字列
  if (/^'([^\\']*(?:\\.[^\\']*)*)'$/.test(s)) {
    return unescape(s.slice(1, -1));
  }
  // 上記に当てはまらないものはそのまま文字列
  return s;
}

/**
 * オブジェクトに対して指定のコマンドを実行する。
 *
 * @param {*} obj
 * @param {string} command
 * @param {unknown} value
 * @returns
 */
export function modify(obj: any, command: string) {
  const [path, value] = /^\s*delete\s+(\S(?:.*?\S)?)\s*$/.test(command)
    ? [RegExp.$1, undefined] // deleteのときはundefinedを設定する
    : /^\s*set\s+(\S(?:.*?\S)?)\s*=\s*(\S(?:.*?\S)?)$/.test(command)
    ? [RegExp.$1, evaluate(RegExp.$2)] // 値を各型に合わせて変換
    : error`Unrecognized command: ${command}`;
  const root =
    obj && typeof obj === 'object'
      ? obj
      : (obj = /^\[[^']/.test(path) ? [] : {});
  const re = /(?:(?:^|\.)(?<name>[^.[]+)|(?:\['(?<quotedName>[^\\']*(?:\\.[^\\']*)*)'\]|\[(?:(?<index>\d+)(?<insert>\+)?|(?<append>\+))\]))(?=(?<next>\.|\['?)|$)/gsy;
  for (;;) {
    const {groups: m, index} = re.exec(path) ?? {};
    if (!m) {
      break;
    }
    let name;
    if (m.name || m.quotedName) {
      assert(
        obj && typeof obj === 'object' && !Array.isArray(obj),
        'obj should be an object.'
      );
      name = m.name || unescape(m.quotedName);
    } else if (m.index || m.append) {
      assert(
        obj && typeof obj === 'object' && Array.isArray(obj),
        'obj should be an array.'
      );
      name = m.index ? +m.index : obj.length;
      if (m.insert) {
        obj.splice(++name, 0, undefined);
      }
    } else {
      break;
    }
    if (!m.next) {
      if (value !== undefined) {
        obj[name] = value;
      } else {
        delete obj[name];
      }
      return root;
    }
    if (obj[name] !== undefined) {
      if (
        // typeof null === 'object'なのでnullかどうかを先にチェック
        obj[name] === null ||
        // 配列でもtypeofは'object'
        typeof obj[name] !== 'object' ||
        // 次がプロパティ名なら配列でエラー、インデックスなら配列でなければエラー
        (m.next === '[') !== Array.isArray(obj[name])
      ) {
        return error`${path.slice(0, re.lastIndex)} is not an ${
          m.next === '[' ? 'array' : 'object'
        }: for path: ${path}`;
      }
    } else {
      // 次がプロパティ名かインデックスかで配列を作成するかオブジェクトを作成するかを変える
      obj[name] = m.next === '[' ? [] : {};
    }
    obj = obj[name];
  }
  return error`Unsupported path: ${path}`;
}
