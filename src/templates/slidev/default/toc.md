---
layout: default
---

# 目录

<v-clicks>

{{#each sections}}
- {{this.title}} {{#if this.page}}(P{{this.page}}){{/if}}
{{/each}}

</v-clicks>

<style>
ul {
  list-style-type: none;
  padding-left: 0;
}

ul li {
  padding: 0.5em 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 1.2em;
}

ul li:hover {
  color: #60a5fa;
  transition: color 0.2s;
}
</style>