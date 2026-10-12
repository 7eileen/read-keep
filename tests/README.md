# 测试样本

`check-*.cjs` 是产品已有的逻辑回归检查；迁入仓库时仅调整源码文件路径。运行 `npm test` 可离线执行。

`dictionary-*.json` 为 FreeDictionaryAPI 的词条响应样本，用于验证词性、词形、参考义项排序及无结果情况。数据原始来源为 Wiktionary，采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)；每份有效词条响应的 `source` 字段保留原词条及许可链接。此许可说明适用于词典数据，不为本项目其他源码另行授予开源许可。

- [coverage](https://en.wiktionary.org/wiki/coverage)
- [grow](https://en.wiktionary.org/wiki/grow)
- [beautiful](https://en.wiktionary.org/wiki/beautiful)
- [went](https://en.wiktionary.org/wiki/went)
- [illustration](https://en.wiktionary.org/wiki/illustration)

`dictionary-in-response-to.json` 为无结果响应样本。接口来源：[FreeDictionaryAPI](https://freedictionaryapi.com/)。
