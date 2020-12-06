# json-modify

Modify the JSON file on the command line.

コマンドラインでJSONファイルを修正します。

```cmd
> json-modify --input src/tsconfig.json --output src/tsconfig 'set compilerOptions.target=ES2018' 'delete compilerOptions.lib' 'set compilerOptions.lib[+]=ESNext'
```
