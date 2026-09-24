/**
 * 临时能力探测脚本（验证 .pen Script 节点在无头引擎里是否会执行）
 * 若执行成功，父节点下会出现名为「脚本执行成功」的子节点。
 */
return {
  children: [
    {
      type: 'frame',
      name: '脚本执行成功',
      width: 200,
      height: 40,
      layout: 'horizontal',
      padding: [8, 12],
      cornerRadius: 7.6,
      fill: '#10B981',
      children: [{ type: 'text', content: 'SCRIPT OK', fontSize: 13, fill: '#FFFFFF' }],
    },
  ],
};
