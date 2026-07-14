<script setup lang="ts">
import { computed } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import 'ag-grid-enterprise'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

import type { TreeItem, TreeItemId } from '@/types'
import { TreeStore } from '@/store/TreeStore'

const props = defineProps<{
  items: TreeItem[]
}>()

const store = computed(() => new TreeStore(props.items))

function buildItemPath(itemId: TreeItemId): (string | number)[] {
  const parents = store.value.getAllParents(itemId)
  return parents.reverse().map(p => p.id)
}

const rowData = computed(() => {
  return store.value.getAll().map(item => ({
    ...item,
    treePath: buildItemPath(item.id),
  }))
})

const getDataPath = (data: Record<string, unknown>): (string | number)[] =>
  data.treePath as (string | number)[]

const columnDefs = computed(() => [
  {
    headerName: '№ п/п',
    valueGetter: (p: { node: { rowIndex: number } | null }) =>
      (p.node?.rowIndex ?? 0) + 1,
    width: 80,
    sortable: false,
    filter: false,
  },
  {
    headerName: 'Категория',
    valueGetter: (p: { data: TreeItem | null }) => {
      if (!p.data) return ''
      return store.value.getChildren(p.data.id).length > 0
        ? 'Группа'
        : 'Элемент'
    },
    width: 120,
    sortable: false,
    filter: false,
  },
  {
    headerName: 'ID',
    valueGetter: (p: { data: TreeItem | null }) => p.data?.id,
    width: 140,
  },
  {
    headerName: 'Parent',
    valueGetter: (p: { data: TreeItem | null }) => p.data?.parent ?? '',
    width: 140,
  },
])

const autoGroupColumnDef = {
  headerName: 'Элемент',
  cellRendererParams: {
    suppressCount: true,
    innerRenderer: (p: { data: TreeItem | null; value: string | number }) =>
      p.data?.label ?? p.data?.id ?? p.value,
  },
}

const defaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
}
</script>

<template>
  <div class="ag-theme-quartz tree-table">
    <AgGridVue
      :row-data="rowData"
      :column-defs="columnDefs"
      :tree-data="true"
      :get-data-path="getDataPath"
      :auto-group-column-def="autoGroupColumnDef"
      :default-col-def="defaultColDef"
      :animate-rows="true"
      :group-default-expanded="-1"
      dom-layout="autoHeight"
    />
  </div>
</template>

<style scoped>
.tree-table {
  height: 100%;
  width: 100%;
}
</style>
