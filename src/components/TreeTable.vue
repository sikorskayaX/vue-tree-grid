<script setup lang="ts">
import { ref, reactive } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import 'ag-grid-enterprise'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

import type { TreeItem, TreeItemId } from '@/types'
import { TreeStore } from '@/store/TreeStore'

const props = defineProps<{
  items: TreeItem[]
}>()

// ---------- persistent store ----------
const store = ref(new TreeStore(props.items))

function rebuildRowData() {
  const allItems = store.value.getAll()

  // Build paths top-down in a single pass for O(n) performance
  // Group children by parent for fast traversal
  const childrenByParent = new Map<TreeItemId, TreeItem[]>()
  for (const item of allItems) {
    if (item.parent === null) continue
    const siblings = childrenByParent.get(item.parent)
    if (siblings) {
      siblings.push(item)
    } else {
      childrenByParent.set(item.parent, [item])
    }
  }

  // BFS from roots: each child gets parent path + its own id
  const result: Array<Record<string, unknown>> = []
  const queue: Array<{ item: TreeItem; path: (string | number)[] }> = []

  for (const item of allItems) {
    if (item.parent === null) {
      queue.push({ item, path: [item.id] })
    }
  }

  while (queue.length > 0) {
    const { item, path } = queue.shift()!

    result.push({
      ...item,
      _rawId: item.id,
      _rawParent: item.parent,
      id: String(item.id),
      parent: item.parent != null ? String(item.parent) : null,
      treePath: path,
      _category: store.value.hasChildren(item.id) ? 'Группа' : 'Элемент',
    })

    const children = childrenByParent.get(item.id)
    if (children) {
      for (const child of children) {
        queue.push({ item: child, path: [...path, child.id] })
      }
    }
  }

  return result
}

const rowData = ref(rebuildRowData())

function forceUpdate() {
  rowData.value = rebuildRowData()
}

// ---------- add item ----------
const showAddForm = ref(false)
const addForm = reactive({
  id: '',
  parent: '',
  label: '',
})

function parseId(value: string): TreeItemId {
  if (value === '') return ''
  const num = Number(value)
  if (!isNaN(num) && value.trim() !== '') return num
  return value
}

function handleAdd() {
  const newItem: TreeItem = {
    id: parseId(addForm.id),
    parent: addForm.parent === '' ? null : parseId(addForm.parent),
    label: addForm.label || undefined,
  }
  store.value.addItem(newItem)
  forceUpdate()
  addForm.id = ''
  addForm.parent = ''
  addForm.label = ''
}

// ---------- remove item ----------
function handleRemove(id: TreeItemId) {
  store.value.removeItem(id)
  forceUpdate()
}

// ---------- edit item ----------
const showEditDialog = ref(false)
const editForm = reactive<{
  _originalId: TreeItemId
  parent: string
  label: string
}>({
  _originalId: '',
  parent: '',
  label: '',
})
const editIdDisplay = ref('')

function openEdit(id: TreeItemId) {
  const item = store.value.getItem(id)
  if (!item) return
  editForm._originalId = id
  editIdDisplay.value = String(id)
  editForm.parent = item.parent !== null ? String(item.parent) : ''
  editForm.label = item.label ?? ''
  showEditDialog.value = true
}

function handleEdit() {
  const updated: TreeItem = {
    id: editForm._originalId,
    parent: editForm.parent === '' ? null : parseId(editForm.parent),
    label: editForm.label || undefined,
  }
  store.value.updateItem(updated)
  forceUpdate()
  showEditDialog.value = false
}

// ---------- ag-grid config ----------
const getDataPath = (data: Record<string, unknown>): (string | number)[] =>
  data.treePath as (string | number)[]

function actionCellRenderer(params: { data: Record<string, unknown> | null }): string | HTMLElement {
  if (!params.data) return ''
  const rawId = params.data._rawId as TreeItemId
  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.gap = '4px'
  container.style.alignItems = 'center'
  container.style.height = '100%'

  const editBtn = document.createElement('button')
  editBtn.textContent = '✎'
  editBtn.title = 'Редактировать'
  editBtn.className = 'action-btn'
  editBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    openEdit(rawId)
  })

  const deleteBtn = document.createElement('button')
  deleteBtn.textContent = '✕'
  deleteBtn.title = 'Удалить'
  deleteBtn.className = 'action-btn'
  deleteBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    handleRemove(rawId)
  })

  container.appendChild(editBtn)
  container.appendChild(deleteBtn)
  return container
}

const columnDefs = [
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
    field: '_category',
    width: 120,
    sortable: false,
    filter: false,
  },
  {
    headerName: 'ID',
    field: 'id',
    width: 140,
  },
  {
    headerName: 'Parent',
    field: 'parent',
    width: 140,
  },
  {
    headerName: 'Действия',
    colId: 'actions',
    cellRenderer: actionCellRenderer,
    width: 120,
    sortable: false,
    filter: false,
  },
]

const autoGroupColumnDef = {
  headerName: 'Элемент',
  cellRendererParams: {
    suppressCount: true,
    innerRenderer: (p: { data: Record<string, unknown> | null; value: string | number }) =>
      (p.data?.label as string | undefined)
        ?? (p.data?._rawId as string | number | undefined)
        ?? p.value,
  },
}

const defaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
}
</script>

<template>
  <div class="tree-table-container">
    <div class="toolbar">
      <button class="btn" @click="showAddForm = !showAddForm">
        {{ showAddForm ? '✕ Скрыть' : '+ Добавить элемент' }}
      </button>
    </div>

    <div v-if="showAddForm" class="form-panel">
      <div class="form-row">
        <label>
          ID
          <input v-model="addForm.id" placeholder="id" />
        </label>
        <label>
          Parent
          <input v-model="addForm.parent" placeholder="оставьте пустым для корня" />
        </label>
        <label>
          Label
          <input v-model="addForm.label" placeholder="label" />
        </label>
        <button class="btn btn-primary" @click="handleAdd">Добавить</button>
      </div>
    </div>

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
        :key="rowData.length"
      />
    </div>

    <!-- Edit Dialog -->
    <div v-if="showEditDialog" class="modal-overlay" @click.self="showEditDialog = false">
      <div class="modal">
        <h3>Редактировать элемент</h3>
        <div class="form-row">
          <label>
            ID
            <input :value="editIdDisplay" disabled />
          </label>
          <label>
            Parent
            <input v-model="editForm.parent" placeholder="оставьте пустым для корня" />
          </label>
          <label>
            Label
            <input v-model="editForm.label" placeholder="label" />
          </label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="handleEdit">Сохранить</button>
          <button class="btn" @click="showEditDialog = false">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-table-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  margin-bottom: 8px;
}

.btn {
  padding: 6px 14px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.4;
}

.btn:hover {
  background: #e8e8e8;
}

.btn-primary {
  background: #4a90d9;
  color: #fff;
  border-color: #357abd;
}

.btn-primary:hover {
  background: #357abd;
}

.form-panel {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.form-row label {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: #666;
  gap: 2px;
}

.form-row input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  min-width: 140px;
  box-sizing: border-box;
}

.form-row input:disabled {
  background: #eee;
  color: #999;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  min-width: 420px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal h3 {
  margin: 0 0 16px;
}

:deep(.action-btn) {
  cursor: pointer;
  padding: 2px 8px;
  border: 1px solid #ccc;
  background: #f5f5f5;
  border-radius: 3px;
  font-size: 14px;
  line-height: 1.4;
}

:deep(.action-btn:hover) {
  background: #e0e0e0;
}

.tree-table {
  flex: 1;
  width: 100%;
}
</style>
