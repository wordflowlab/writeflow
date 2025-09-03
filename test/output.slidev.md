---
theme: seriph
title: WriteFlow Slidev 功能测试
aspectRatio: 16/9
highlighter: shiki
monaco: true
mdc: true
---


# WriteFlow Slidev 功能测试

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    开始 <carbon:arrow-right class="inline"/>
  </span>
</div>

---
layout: center
---

# 创建新演示文稿

writeflow /slide create "主题名称"


---
layout: center
---

# 转换现有文档

writeflow /slide convert ./article.md
```


---
layout: default
---

# 总结


WriteFlow Slidev 功能为技术写作者提供了强大的演示文稿创作能力。

---
layout: end
---

# 谢谢

Questions?