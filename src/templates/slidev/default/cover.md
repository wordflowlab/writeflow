# {{title}}

{{#if subtitle}}
## {{subtitle}}
{{/if}}

{{#if author}}
<div class="absolute bottom-10 left-10">
  <span class="text-gray-400">{{author}}</span>
  {{#if date}}
  <span class="text-gray-400 ml-4">{{date}}</span>
  {{/if}}
</div>
{{/if}}

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    开始演示 <carbon:arrow-right class="inline"/>
  </span>
</div>