import * as fs from 'fs';
import {parse, unnamed, helpString} from 'optionalist';
import {modify} from './json-editor';

const option = parse({
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
  [unnamed]: {
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
    指定のインデックスの前に挿入したい場合は[+{インデックス}]のように指定します
    インデックスを省略した場合には最後に追加されます。`,
    example:
      "foo.bar={'string'|+number|-number|true|false|null|[values...]|{name:value,...}}|delete foo.bar}",
  },
  help: {
    type: 'boolean',
    nature: 'alone',
    alias: 'h',
    describe: 'このヘルプを表示します',
  },
});

async function read(stream: NodeJS.ReadStream) {
  let buffer = Buffer.alloc(0);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer.toString('utf8');
}

if ('help' in option) {
  process.stderr.write(option[helpString]);
  process.exit(0);
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
  for (const command of option[unnamed]) {
    // 編集コマンド実行
    obj = modify(obj, command);
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
