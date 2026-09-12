/**
 * samples/README.md 的生成
 * ------------------------------------------------------------------
 * 单独一个文件，是因为这份 README 是「生成物说明书」：
 * 它要写清数据规模、怎么导入、以及手册的指纹（用于判断备份是否过期）。
 * 文案与统计分开之后，make-sample.mjs 就只剩下"解析 → 生成"的流程。
 */

/** 生成 samples/README.md 的全文 */
export function buildReadme(stats, sourceHash) {
  const byType = Object.entries(stats.byType).map(([k, v]) => `${k} ${v}`).join('、');
  return `# samples · 可直接导入的测试数据

这个目录里的东西**全部由脚本生成，不要手改**：

| 文件 | 说明 |
| --- | --- |
| \`猫猫的冒险.worldforge.json\` | 完整备份，可用「设置 → 数据 → 导入设定」一次性导入 |
| \`README.md\` | 本文件，由 \`scripts/make-sample.mjs\` 重新生成 |

来源是 \`docs/猫猫的冒险·世界观设定.txt\`（给人读、给人抄的手册）。
两者内容完全一致：手册是唯一事实来源，脚本负责把它翻译成机器可读的备份。

重新生成（改完手册之后跑一次，两条命令都要跑）：

\`\`\`bash
node scripts/make-sample.mjs     # 手册 → 备份
node scripts/sample-check.mjs    # 校验（含字段名、下拉取值、真实导入）
\`\`\`

## 这份数据里有什么

| 项目 | 数量 |
| --- | --- |
| 卡片 | ${stats.cards}（${byType}） |
| 标签 / 卡片标签 | ${stats.tags} / ${stats.cardTags} |
| 关联 | ${stats.relations} |
| 地图 / 标记点 / 区域 | ${stats.maps} / ${stats.pins} / ${stats.regions} |
| 泳道 / 条目 / 纪元 | ${stats.tracks} / ${stats.entries} / ${stats.eras} |
| 文稿 / 大纲节点（根节点 ${stats.outlineRoots}） | ${stats.docs} / ${stats.outlineNodes} |
| 平行世界分支 | ${stats.branches} |

<!-- sample-source-sha256: ${sourceHash} -->
上一行的注释是手册的指纹：\`scripts/sample-check.mjs\` 用它判断备份是否已经过期 ——
改了手册但忘了重新生成时，自测会直接报错提醒。

## 怎么导入

1. 启动应用 → 左上角世界观切换器 → 「新建世界观」，名称填「猫猫的冒险」
   （导入会**覆盖当前世界观的全部内容**，所以先建一个干净的世界观再导入；
    原来的示例世界「示例世界 · 灰烬纪元」不会被碰）
2. 切到刚建的世界观 → 设置 → 数据 → 导入设定 → 选择这个 JSON 文件
3. 导入完成后回到总览，应该能看到 ${stats.cards} 张卡片、${stats.relations} 条关联

> 导入前建议先导出一次当前数据（设置 → 数据 → 导出完整备份）：
> 导入是不可撤销的，覆盖了就只能靠备份找回。
`;
}
