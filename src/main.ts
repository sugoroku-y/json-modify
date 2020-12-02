import * as fs from 'fs';
import * as optionalist from 'optionalist';

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

const option = optionalist.parse({
  input: {
    describe: '入力ファイルを指定します。省略時には標準入力から読み込みます。',
    example: 'input-jsonfile',
  },
  new: {
    type: 'boolean',
    describe: '入力ファイルを読み込まずに、新規作成します。',
  },
  indent: {
    type: 'number',
    nature: ['default', 2],
    describe: 'インデントとして使用する空白の文字数を指定します。',
    example: 'indent_count',
  },
  output: {
    describe: '出力ファイルを指定します。省略時には標準出力に書き出します。',
    example: 'output-jsonfile',
  },
  [optionalist.unnamed]: {
    describe: `
JSONファイルに適用する編集コマンドを指定します。
  set プロパティ名=値  プロパティに値を設定します。
    'string' ''で囲むと文字列と見なします。
    number +、-、.や数字で始まると数値と見なします。
    true/false trueやfalseは真偽値と見なします。
    null nullはnull値と見なします。
    上記のいずれにもマッチしない場合は文字列と見なします。
  delete プロパティ名 指定のプロパティを削除します。
    削除されるのは指定した値だけです。
  プロパティ名には.や[]をつけて階層を指定できます。
  配列に要素を追加したい場合は[{追加したいインデックス}+]を指定します。
  インデックスを省略した場合には最後に追加されます。`,
    example:
      "foo.bar={'string'|+number|-number|true|false|null|[values...]|{name:value,...}}|delete foo.bar}",
  },
});

async function read(stream: NodeJS.ReadStream) {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer.toString('utf8');
}

/**
 * オブジェクトに対して指定のプロパティの位置に値を設定する。
 *
 * valueがundefinedの場合はプロパティを削除する。
 *
 * @param {*} obj
 * @param {string} path
 * @param {unknown} value
 * @returns
 */
function modify(obj: any, path: string, value: unknown) {
  const root =
    obj && typeof obj === 'object' ? obj : /^\[[^']/.test(path) ? [] : {};
  obj = root;
  const re = /(?:\['([^\\']*(?:\\.[^\\']*)*)'\]|(?:^|\.)(.+?)|\[(?:(\d+)(\+)?|(\+))\])(?=(\.|\['?)|$)/gsy;
  let m;
  while ((m = re.exec(path))) {
    let name;
    if (m[1] || m[2]) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        break;
      }
      name = m[2] || unescape(m[1]);
    } else if (m[3] || m[5]) {
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj)) {
        break;
      }
      name = m[3] ? +m[3] : obj.length - 1;
      if (m[4] || m[5]) {
        ++name;
        obj.splice(name, 0, undefined);
      }
    } else {
      break;
    }
    if (!m[6]) {
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
        (m[6] === '[') !== Array.isArray(obj[name])
      ) {
        return error`${path.slice(0, re.lastIndex)} is not an ${
          m[6] === '[' ? 'array' : 'object'
        }: for path: ${path}`;
      }
    } else {
      // 次がプロパティ名かインデックスかで配列を作成するかオブジェクトを作成するかを変える
      obj[name] = m[6] === '[' ? [] : {};
    }
    obj = obj[name];
  }
  return error`Unsupported path: ${path}`;
}

/**
 * エスケープを外した文字列を返す。
 *
 * @param {string} s
 * @returns {string}
 */
function unescape(s: string): string {
  return s.replace(
    /\\(?:.|x([0-9A-Fa-f]{2})|u([0-9A-Fa-f]{4}))/g,
    (ch, code, ucode) =>
      ucode
        ? String.fromCharCode(parseInt(ucode, 16))
        : code
        ? String.fromCharCode(parseInt(code, 16))
        : ch === 't'
        ? '\t'
        : ch === 'r'
        ? '\r'
        : ch === 'n'
        ? '\n'
        : ch
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
function dequote(s: string): string | number | boolean | null {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^[-+](\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(s)) {
    return +s;
  }
  if (/^'([^\\']*(?:\\.[^\\']*)*)'$/.test(s)) {
    return unescape(s.slice(1, -1));
  }
  return s;
}

(async () => {
  // 読み込んだJSONデータ
  let obj = option.new
    ? undefined
    : JSON.parse(
        await (option.input
          ? fs.promises.readFile(option.input, 'utf8')
          : read(process.stdin))
      );
  for (const command of option[optionalist.unnamed]) {
    const [path, value] = /^\s*delete\s+(\S(?:.*?\S)?)\s*$/.test(command)
      ? [RegExp.$1, undefined] // deleteのときはundefinedを設定する
      : /^\s*set\s+(\S(?:.*?\S)?)\s*=\s*(\S(?:.*?\S)?)$/.test(command)
      ? [RegExp.$1, dequote(RegExp.$2)] // 値を各型に合わせて変換
      : error`Unrecognized command: ${command}`;
    obj = modify(obj, path, value);
  }
  // JSONファイルに書き出し
  const data = JSON.stringify(obj, undefined, option.indent || undefined);
  if (option.output) {
    await fs.promises.writeFile(option.output, data, {encoding: 'utf8'});
  } else {
    // 出力先指定がなければ標準出力に
    await new Promise<void>((rs, rj) =>
      process.stdout.write(data, 'utf8', err => (err ? rj(err) : rs()))
    );
  }
})();
