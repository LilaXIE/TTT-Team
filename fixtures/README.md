# fixtures

戚译匀负责。格式与内容要求见 `docs/MANUAL.md` §2.2（catalog）、§2.3（rates）、§4.3（scenarios）。

- `catalog.json`：3 个商家、16–20 件商品（4 件洗衣液价格固定为 118/139/108/128；2 件 supplement 带 `health_claim`；2 件描述含注入文本；1 件高于参考价 40%）
- `rates.json`：每个数字必须有 `sourceUrl` 与 `observedAt`；截图放 `docs/rates/`
- `scenarios.json`：授权预览用的三个固定示例购物车

阶段 1 完成后用 `npm run fixtures:validate` 校验。
