# Payment 费率采集交接

采集日期：2026-10-03（香港／北京时间）。截图时间、来源地址和 SHA-256 见 sources.json。`fixtures/rates.json` 的 `observedAt` 与这次采集对齐。2026-10-04 曾把 Tap & Go 本地港元手续费记成 0，当天改回 null：收费表没有写明这一项，不能把「没列出」当成「已核实为零」。

本次结果：FPS 消费者费用为 "0" 分，但适用范围限定为 HSBC 个人客户经其 App／网上理财进行本地港元 FPS 付款。Tap & Go 本地港元消费手续费与通用回赠未核实，均为 null。演示账本在需要整数时暂记 0，这个 0 只存在于结算列，不写进观测值，也不能用来证明 Tap & Go 比 FPS 便宜。

| 证据 | 官方来源 | 写入结果与限制 |
| --- | --- | --- |
| [FPS 截图](fps-hsbc-2026-10-03.jpg) | [HSBC 个人转账问答](https://www.hsbc.com.hk/zh-hk/help/faq/transfers-and-payments/) | HSBC 不收手续费，服务可即时付款；其他银行／储值支付工具可能有不同收费。不能宣传“所有 FPS 个人用户永久免费”。 |
| [Tap & Go 收费截图](tapngo-charges-2026-10-03.jpg) | [Tap & Go 官方收费表](https://www.tapngo.com.hk/eng/charges.html) | 年费免费不等于消费手续费免费。页面没有明确列出香港本地港元消费手续费为零，因此 consumerFeeMinor=null。 |
| [优惠截图](tapngo-theclub-offer-2026-10-03.jpg) | [The Club 官方优惠条款](https://www.theclub.com.hk/shopping/en/lc/promotions/tapngo-rebate-offer.html) | 属于指定商户、会员与支付路径优惠，不能用于本目录的模拟商家；不当作通用现金回赠。 |

截图保存的是网页本身。HSBC 截图已展开 FPS 内容，包含免费说明及其他机构收费的脚注；Tap & Go 收费表使用整页截图。网页显示的更新时间与我们的采集时间是不同字段，不应混用。

## 为什么没有照抄示例的 0.5% 回赠

Manual §2.3 的 JSON 是格式示例，sourceUrl 为占位符，不能当作来源。未找到适用于 A/B/C 模拟商家的通用 0.5% Mastercard 现金回赠来源。The Club 的推广同时出现优惠标题与详细条件，且限定具体商户、会员身份、支付路径和活动规则；本次不把任何百分比移植到 rates.json。rewards=null 表示未核实／未确认适用，不表示保证零回赠。

## 后续接入要求

- 观测数据用 RatesFixture。Tap & Go 的 consumerFeeMinor 为 null 时，过不了可执行的 PaymentMethod 校验。
- 数据库的 consumer_fee_minor 不能为空。seed 只在写入这一列时把 null 落成 0，并在 notes 写明这是演示入账，不是观测值。页面把 Tap & Go 显示为「未核实」，不用这个 0 做成本排序，也不宣称它比 FPS 便宜。
- UI 对 null 显示「未核实」。不得用 Number、空字符串或默认值把未知费用说成已核实的免费。
- 商家接受、授权允许与用户启用仍按 Manual §9 检查；公开费率来源不证明这些资格。缺少消费者费用应补齐信息后再报价，可用现有 blocking INFO_MISSING。
- seed、支付比较和迁移目前还是后续阶段工作。没有为了数据采集新增数据库表或修改结算逻辑。接入时同步 payment_methods.source_url / observed_at；若暂存 null，数据库必须支持未知值，且不能生成可执行报价；也可暂不导入未核实方式。
- FPS 的 instant 是来源描述，执行仍是模拟器；Tap & Go 的 T+1 (simulated) 是 Manual 的演示设定，不能说是官方承诺。
- 回赠、积分只展示，不参与额度、余额或账本计算；商家手续费不进入消费者成本。

## 本地复查

在仓库根目录运行 `npm run fixtures:validate`，再依次运行 `npm run typecheck`、`npm run lint`、`npm run test:unit`。无需数据库、登录官方账户或支付。

## 从 Ellan 产品审阅补充的比较边界

商品目录中的候选价、运费和参考价为模拟值；本文件中的费率是特定来源、时点与适用条件下的观测。公开来源存在不等于任何本地订单都能采用该费用。

支付比较只有在资格满足且消费者费用已知时，才有完整可执行成本。不能把 Tap & Go 的未知手续费当作零，再宣称它与 FPS 同成本或靠预计回赠更便宜；缺少信息应明确展示。预计回赠不降低结算扣款、不抵消硬上限。当前产品尚未接入平台券或优惠资格服务，也没有验证真实支付。

rates.observedAt 是费率采集时间，不是商品报价时间。后续 Quote 必须按购物车时点生成报价、有效期和版本；修改商品、价格、商家或支付方式后重新评估，不能沿用旧确认。完整事实核实和竞品修正在 [数据交接的 Ellan 审阅部分](../../fixtures/README.md)。
