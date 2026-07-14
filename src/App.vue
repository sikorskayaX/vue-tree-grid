<script setup lang="ts">
import TreeTable from '@/components/TreeTable.vue'
import type { TreeItem } from '@/types'

const items: TreeItem[] = [
  { id: 1, parent: null, label: 'Айтем 1' },
  { id: '91064cee', parent: 1, label: 'Айтем 2' },
  { id: 3, parent: 1, label: 'Айтем 3' },
  { id: 4, parent: '91064cee', label: 'Айтем 4' },
  { id: 5, parent: '91064cee', label: 'Айтем 5' },
  { id: 6, parent: '91064cee', label: 'Айтем 6' },
  { id: 7, parent: 4, label: 'Айтем 7' },
  { id: 8, parent: 4, label: 'Айтем 8' },
]
</script>

<template>
  <div id="app-root">
    <h1>TreeStore</h1>
    <TreeTable :items="items" />
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#app-root {
  padding: 20px;
  height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}
h1 {
  margin: 0 0 16px;
}
</style>
