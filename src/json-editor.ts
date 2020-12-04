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

function assert(condition: false, message?: string | (() => string)): never;
function assert(
  condition: boolean,
  message?: string | (() => string)
): asserts condition is true;
function assert<T extends [] | {}>(
  condition: T | undefined | null,
  message?: string | (() => string)
): asserts condition is T;
function assert<T>(
  condition: unknown,
  typeGuard: (o: unknown) => o is T,
  message?: string | (() => string)
): asserts condition is T;
function assert<
  T extends
    | [false, (string | (() => string))?]
    | [boolean, (string | (() => string))?]
    | [unknown, (string | (() => string))?]
    | [unknown, (o: unknown) => boolean, (string | (() => string))?]
>(...args: T) {
  const [condition, message] =
    typeof args[1] === 'function' && args[1].length === 1
      ? [args[1](args[0]), args[2]]
      : !args[1] ||
        typeof args[1] === 'string' ||
        (typeof args[1] === 'function' && args[1].length === 0)
      ? [args[0], args[1] as string | (() => string) | undefined]
      : // istanbul ignore next
        error`Unreachable`;
  if (!condition) {
    throw new Error(
      typeof message === 'string'
        ? message
        : message
        ? message()
        : // istanbul ignore next
          undefined
    );
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

function type(o: unknown): string {
  if (o === null) return 'null';
  if (typeof o !== 'object') return typeof o;
  if (Array.isArray(o)) return 'array';
  return 'object';
}

/**
 * オブジェクトのパス指定
 *
 * @interface IObjectPath
 */
interface IObjectPath {
  type: 'object';
  /**
   * このプロパティの親までのパス
   */
  path: string;
  /**
   * このプロパティの名前
   */
  name: string;
}
/**
 * 配列のパス指定
 *
 * @interface IObjectPath
 */
interface IArrayPath {
  type: 'array';
  /**
   * このプロパティの親までのパス
   */
  path: string;
  /** このプロパティのインデックス */
  index: number;
  /** `index`の前に挿入するか(`'before'`)、後ろに挿入するか(``)。省略時は挿入ではなく置き換え。 */
  insert?: 'before' | 'after';
}
/**
 * 配列のパス指定(ただし末尾に追加)
 *
 * @interface IObjectPath
 */
interface IArrayAppendPath {
  type: 'array';
  /**
   * このプロパティの親までのパス
   */
  path: string;
  index?: undefined;
}

type IPath = IObjectPath | IArrayPath | IArrayAppendPath;

/**
 * 階層指定のパスを解析
 *
 * @export
 * @param {string} wholepath
 * @returns {IPath[]} 解析結果
 */
export function parsePath(wholepath: string): IPath[] {
  assert(wholepath, 'wholepath must not be empty.');
  const parsed: IPath[] = [];
  const re = /(?:(?:^|\.)(?<name>[^.[]+)|\['(?<quotedName>[^\\']*(?:\\.[^\\']*)*)'\]|\[(?:(?<prepend>\+)?(?<index>\d+)(?<insert>\+)?|(?<append>\+))\])(?=(?<next>\.|\['?)|$)/gsy;
  while (re.lastIndex < wholepath.length) {
    const {groups: m, index} = re.exec(wholepath) ?? {};
    assert(m, () => `Unrecognized path: ${wholepath}`);
    const path = wholepath.slice(0, index);
    parsed.push(
      m.name || m.quotedName
        ? {type: 'object', path, name: m.name || unescape(m.quotedName)}
        : m.index
        ? {
            type: 'array',
            path,
            index: +m.index,
            insert: m.prepend
              ? m.insert
                ? error`One of the prefix \`+\` and the sufix \`+\` can be specified.: \`${path}\``
                : 'before'
              : m.insert
              ? 'after'
              : undefined,
          }
        : m.append
        ? {type: 'array', path}
        : // istanbul ignore next
          error`Unreachable`
    );
  }
  return parsed;
}

/**
 * オブジェクトかどうかを判定する型ガード。
 *
 * @param {unknown} obj
 * @returns {obj is object}
 */
function isObject(obj: unknown): obj is object {
  // typeof null、typeof []も'object'なのでtypeof obj === 'object'以外にチェックが必要
  return !!obj && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * オブジェクトに対して指定のコマンドを実行する。
 *
 * @param {*} obj
 * @param {string} command
 * @param {unknown} value
 * @returns
 */
export function modify(obj: unknown, command: string) {
  const [path, value] = /^\s*delete\s+(\S(?:.*?\S)?)\s*$/.test(command)
    ? [RegExp.$1, undefined] // deleteのときはundefinedを設定する
    : /^\s*set\s+(\S(?:.*?\S)?)\s*=\s*(\S(?:.*?\S)?)$/.test(command)
    ? [RegExp.$1, evaluate(RegExp.$2)] // 値を各型に合わせて変換
    : error`Unrecognized command: ${command}`;
  const parsed = parsePath(path);
  if (value === undefined) {
    assert(
      parsed.every(
        info =>
          info.type === 'object' || (info.index !== undefined && !info.insert)
      ),
      () => `\`+\` can be specified in the set command: ${path}`
    );
  }
  const root = [obj];
  obj = root;
  parsed.unshift({type: 'array', path: 'obj', index: 0});
  for (let i = 0; i < parsed.length; ++i) {
    const info = parsed[i];
    let name;
    if (info.type === 'object') {
      // プロパティの親はオブジェクトでなければならない。
      assert(
        obj,
        isObject,
        () => `\`${info.path}\` should be object, but is ${type(obj)}.`
      );
      name = info.name;
    } else {
      // プロパティの親は配列でなければならない。
      assert(
        obj,
        Array.isArray,
        () => `\`${info.path}\` should be array, but is ${type(obj)}.`
      );
      if (info.index === undefined) {
        // 最後に追加する
        name = obj.length;
      } else {
        // 指定のインデックス
        name = info.index;
        if (info.insert) {
          // beforeならインデックスの前に挿入なので位置としてはそのまま、afterはインデックスの後に挿入なので+1
          name += info.insert === 'before' ? 0 : 1;
          // あらかじめundefinedを挿入しておく
          obj.splice(name, 0, undefined);
        }
      }
    }
    if (i === parsed.length - 1) {
      // 最後のプロパティの場合、値を設定する
      if (value === undefined) {
        // valueがundefinedの場合は削除
        delete (obj as any)[name];
      } else {
        (obj as any)[name] = value;
      }
      // 設定/削除したので終了
      break;
    }
    // プロパティ指定の途中なら次のプロパティに移動
    let next = (obj as any)[name];
    if (next === undefined) {
      if (value === undefined) {
        // 削除のときにプロパティが存在していなければ何もしない
        break;
      }
      // 存在していなければ、次のプロパティが配列かオブジェクトに応じて新規作成
      next = (obj as any)[name] = parsed[i + 1].type === 'object' ? {} : [];
    }
    obj = next;
  }
  return root[0];
}
