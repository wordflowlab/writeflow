---
theme: seriph
title: 探索星空
aspectRatio: 16/9
highlighter: shiki
monaco: true
mdc: true
background: 'linear-gradient(45deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)'
---

# 探索星空
## 宇宙的奥秘与人类的征程

> 仰望星空，脚踏实地

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    开始探索 <carbon:arrow-right class="inline"/>
  </span>
</div>

---
layout: two-cols
---

# 目录

<div class="text-lg space-y-4">

## 🌌 宇宙概览
- 宇宙的诞生与演化
- 宇宙的基本构成

## ⭐ 恒星系统
- 恒星的生命周期
- 我们的太阳系

## 🚀 人类探索
- 太空探索历程
- 现代航天技术

## 🔮 未来展望
- 深空探索计划
- 寻找地外生命

</div>

::right::

<div class="flex items-center justify-center h-full">
  <img src="https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400" alt="星空" class="rounded-lg shadow-xl">
</div>

---
layout: center
class: text-center
---

# 🌌 宇宙概览

<div class="text-6xl text-blue-400 mb-8">
  ∞
</div>

<div class="text-xl text-gray-300 space-y-4">
  <p>宇宙年龄：约 138 亿年</p>
  <p>可观测宇宙直径：约 930 亿光年</p>
  <p>估计星系数量：超过 2 万亿个</p>
</div>

---

# 🌟 宇宙的诞生与演化

<div class="grid grid-cols-3 gap-6 mt-8">

<div class="p-4 border border-blue-500 rounded-lg">
<h3 class="text-blue-400 font-bold mb-2">大爆炸理论</h3>
<ul class="text-sm space-y-1">
  <li>• 138亿年前的奇点爆炸</li>
  <li>• 宇宙急剧膨胀</li>
  <li>• 基本粒子形成</li>
</ul>
</div>

<div class="p-4 border border-purple-500 rounded-lg">
<h3 class="text-purple-400 font-bold mb-2">暗物质时代</h3>
<ul class="text-sm space-y-1">
  <li>• 暗物质占宇宙27%</li>
  <li>• 形成宇宙结构骨架</li>
  <li>• 引力聚集物质</li>
</ul>
</div>

<div class="p-4 border border-green-500 rounded-lg">
<h3 class="text-green-400 font-bold mb-2">恒星形成</h3>
<ul class="text-sm space-y-1">
  <li>• 氢气云坍塌</li>
  <li>• 核聚变点燃</li>
  <li>• 第一代恒星诞生</li>
</ul>
</div>

</div>

<div class="mt-8 text-center">
  <p class="text-gray-400 italic">
    "宇宙不仅比我们想象的更奇异，而且比我们能够想象的更奇异" - 霍尔丹
  </p>
</div>

---
layout: two-cols
---

# ⭐ 恒星的生命周期

<v-clicks>

## 1. 原恒星阶段
- 星云坍塌
- 温度逐渐升高
- 核聚变尚未开始

## 2. 主序星阶段
- 氢聚变成氦
- 能量输出稳定
- 太阳现处此阶段

## 3. 红巨星阶段
- 氢燃料耗尽
- 外层膨胀
- 温度下降

## 4. 终极命运
- 白矮星（小质量）
- 中子星（中等质量）
- 黑洞（大质量）

</v-clicks>

::right::

<div class="flex flex-col items-center justify-center h-full space-y-4">
  <div class="w-64 h-64 relative">
    <!-- 恒星演化示意图 -->
    <div class="absolute inset-0 bg-gradient-radial from-yellow-400 to-red-600 rounded-full opacity-80"></div>
    <div class="absolute top-2 left-2 w-8 h-8 bg-white rounded-full"></div>
    <div class="absolute bottom-4 right-4 w-12 h-12 bg-red-800 rounded-full"></div>
    <div class="absolute top-1/2 left-1/2 w-2 h-2 bg-black rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
  </div>
  
  <p class="text-sm text-gray-400 text-center">
    恒星演化过程示意图
  </p>
</div>

---

# 🌞 我们的太阳系

<div class="grid grid-cols-4 gap-4 mt-6">

<div class="text-center p-3 border border-yellow-400 rounded-lg">
  <div class="text-3xl mb-2">☀️</div>
  <h3 class="font-bold text-yellow-400">太阳</h3>
  <p class="text-xs">G型主序星<br/>质量：1.989×10³⁰kg</p>
</div>

<div class="text-center p-3 border border-gray-400 rounded-lg">
  <div class="text-3xl mb-2">☿️</div>
  <h3 class="font-bold text-gray-400">水星</h3>
  <p class="text-xs">最靠近太阳<br/>极端温差</p>
</div>

<div class="text-center p-3 border border-orange-400 rounded-lg">
  <div class="text-3xl mb-2">♀️</div>
  <h3 class="font-bold text-orange-400">金星</h3>
  <p class="text-xs">最热的行星<br/>浓密大气</p>
</div>

<div class="text-center p-3 border border-blue-400 rounded-lg">
  <div class="text-3xl mb-2">🌍</div>
  <h3 class="font-bold text-blue-400">地球</h3>
  <p class="text-xs">生命摇篮<br/>液态水存在</p>
</div>

</div>

<div class="grid grid-cols-4 gap-4 mt-4">

<div class="text-center p-3 border border-red-400 rounded-lg">
  <div class="text-3xl mb-2">♂️</div>
  <h3 class="font-bold text-red-400">火星</h3>
  <p class="text-xs">红色星球<br/>探索目标</p>
</div>

<div class="text-center p-3 border border-orange-500 rounded-lg">
  <div class="text-3xl mb-2">♃</div>
  <h3 class="font-bold text-orange-500">木星</h3>
  <p class="text-xs">气态巨星<br/>79颗卫星</p>
</div>

<div class="text-center p-3 border border-yellow-500 rounded-lg">
  <div class="text-3xl mb-2">♄</div>
  <h3 class="font-bold text-yellow-500">土星</h3>
  <p class="text-xs">美丽光环<br/>82颗卫星</p>
</div>

<div class="text-center p-3 border border-cyan-400 rounded-lg">
  <div class="text-3xl mb-2">🪐</div>
  <h3 class="font-bold text-cyan-400">天王星/海王星</h3>
  <p class="text-xs">冰巨星<br/>极地轨道</p>
</div>

</div>

---
layout: center
class: text-center
---

# 🚀 人类探索星空

<div class="text-2xl text-blue-300 mb-6">从古代观星到现代航天</div>

<div class="grid grid-cols-2 gap-8 max-w-4xl mx-auto">

<div class="space-y-4">
  <h3 class="text-xl font-bold text-green-400">🔭 观测发展</h3>
  <ul class="text-left space-y-2">
    <li>• 肉眼观测（古代）</li>
    <li>• 光学望远镜（17世纪）</li>
    <li>• 射电望远镜（20世纪）</li>
    <li>• 空间望远镜（现代）</li>
  </ul>
</div>

<div class="space-y-4">
  <h3 class="text-xl font-bold text-purple-400">🛸 空间探索</h3>
  <ul class="text-left space-y-2">
    <li>• 人造卫星（1957）</li>
    <li>• 载人航天（1961）</li>
    <li>• 登月计划（1969）</li>
    <li>• 空间站（1971-今）</li>
  </ul>
</div>

</div>

---

# 🛰️ 重要太空探索里程碑

<div class="timeline relative">

<div class="flex items-center mb-6">
  <div class="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white font-bold mr-6">
    1957
  </div>
  <div>
    <h3 class="text-lg font-bold text-red-400">苏联发射斯普特尼克1号</h3>
    <p class="text-gray-400">人类第一颗人造卫星</p>
  </div>
</div>

<div class="flex items-center mb-6">
  <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-6">
    1961
  </div>
  <div>
    <h3 class="text-lg font-bold text-blue-400">加加林进入太空</h3>
    <p class="text-gray-400">人类首次载人航天飞行</p>
  </div>
</div>

<div class="flex items-center mb-6">
  <div class="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold mr-6">
    1969
  </div>
  <div>
    <h3 class="text-lg font-bold text-yellow-400">阿波罗11号登月</h3>
    <p class="text-gray-400">人类首次踏上月球表面</p>
  </div>
</div>

<div class="flex items-center">
  <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-6">
    2020
  </div>
  <div>
    <h3 class="text-lg font-bold text-green-400">火星探测器</h3>
    <p class="text-gray-400">毅力号、天问一号成功登陆火星</p>
  </div>
</div>

</div>

---
layout: two-cols
---

# 🔮 未来展望

## 近期计划 (2024-2030)

<v-clicks>

- **月球基地建设**
  - 阿尔忒弥斯计划
  - 月球资源开发
  - 深空探索跳板

- **火星移民准备**
  - SpaceX 星际飞船
  - 生命支持系统
  - 地球化改造研究

- **小行星采矿**
  - 稀有金属获取
  - 空间资源利用
  - 经济价值巨大

</v-clicks>

::right::

## 远期愿景 (2030+)

<v-clicks>

- **星际旅行**
  - 比邻星系探测
  - 突破摄星计划
  - 光帆推进技术

- **寻找地外生命**
  - 系外行星探测
  - 生物特征分析
  - SETI 项目

- **人类文明扩展**
  - 多行星物种
  - 星际文明
  - 宇宙殖民

</v-clicks>

<div class="mt-6 p-4 border border-cyan-400 rounded-lg">
  <p class="text-cyan-400 text-center italic">
    "探索星空不仅是满足好奇心，更是为了人类文明的延续"
  </p>
</div>

---

# 🌌 探索星空的意义

<div class="grid grid-cols-2 gap-8 mt-8">

<div class="space-y-6">
  <div class="p-6 border border-blue-400 rounded-lg">
    <h3 class="text-xl font-bold text-blue-400 mb-4">🧬 科学意义</h3>
    <ul class="space-y-2">
      <li>• 理解宇宙起源和演化</li>
      <li>• 发现新的物理定律</li>
      <li>• 寻找地外生命</li>
      <li>• 推动技术革新</li>
    </ul>
  </div>

  <div class="p-6 border border-purple-400 rounded-lg">
    <h3 class="text-xl font-bold text-purple-400 mb-4">🛡️ 生存意义</h3>
    <ul class="space-y-2">
      <li>• 应对小行星威胁</li>
      <li>• 气候变化备选方案</li>
      <li>• 资源短缺解决方案</li>
      <li>• 人类文明保险</li>
    </ul>
  </div>
</div>

<div class="space-y-6">
  <div class="p-6 border border-green-400 rounded-lg">
    <h3 class="text-xl font-bold text-green-400 mb-4">💡 哲学意义</h3>
    <ul class="space-y-2">
      <li>• 重新定义人类位置</li>
      <li>• 促进全球合作</li>
      <li>• 激发探索精神</li>
      <li>• 拓展思维边界</li>
    </ul>
  </div>

  <div class="p-6 border border-yellow-400 rounded-lg">
    <h3 class="text-xl font-bold text-yellow-400 mb-4">🚀 技术意义</h3>
    <ul class="space-y-2">
      <li>• 推动材料科学发展</li>
      <li>• 促进计算机技术进步</li>
      <li>• 带动通信技术革新</li>
      <li>• 催生新兴产业</li>
    </ul>
  </div>
</div>

</div>

---
layout: center
class: text-center
---

# 🌠 结语

<div class="text-3xl mb-8 text-gradient">
  探索星空，就是探索我们自己
</div>

<div class="space-y-6 max-w-3xl mx-auto">
  
<blockquote class="text-xl text-gray-300 italic">
  "我们都是星尘，我们都是黄金<br/>
  十亿年前的星光照耀着我们<br/>
  我们正在回归花园"
</blockquote>

<div class="text-lg text-blue-300">
  — 卡尔·萨根
</div>

<div class="pt-8 space-y-4">
  <p class="text-gray-400">
    从古代人仰望星空的好奇，到现代航天技术的突破
  </p>
  <p class="text-gray-400">
    人类对宇宙的探索永无止境
  </p>
  <div class="text-2xl text-yellow-400">
    ✨ 未来的星辰大海等待着我们 ✨
  </div>
</div>

</div>

---
layout: end
---

# 谢谢观看

<div class="text-center space-y-4 mt-12">
  
<div class="text-2xl">🌌 Questions & Discussion 🌌</div>

<div class="text-lg text-gray-400">
  继续探索宇宙的奥秘
</div>

<div class="flex justify-center space-x-8 mt-8 text-sm">
  <div class="text-blue-400">🔭 天文观测</div>
  <div class="text-green-400">🚀 太空探索</div>
  <div class="text-purple-400">🛸 未来科技</div>
  <div class="text-yellow-400">⭐ 星际文明</div>
</div>

</div>

<style>
.text-gradient {
  background: linear-gradient(45deg, #8B5CF6, #06B6D4, #10B981);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.bg-gradient-radial {
  background: radial-gradient(circle, var(--tw-gradient-stops));
}

.timeline::before {
  content: '';
  position: absolute;
  left: 2rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, #3B82F6, #10B981);
}
</style>