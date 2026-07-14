<script setup lang="ts">
import { ref, reactive, nextTick, computed } from 'vue'
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
const errorMessage = ref('')
const successMessage = ref('')

function rebuildRowData() {
  const allItems = store.value.getAll()

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
const totalCount = computed(() => rowData.value.length)

function forceUpdate() {
  rowData.value = rebuildRowData()
}

function flashMessage(type: 'success' | 'error', msg: string) {
  if (type === 'success') {
    successMessage.value = msg
    setTimeout(() => { successMessage.value = '' }, 2500)
  } else {
    errorMessage.value = msg
    setTimeout(() => { errorMessage.value = '' }, 4000)
  }
}

function clearMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

// ---------- add item ----------
const showAddForm = ref(false)
const addForm = reactive({
  id: '',
  parent: '',
  label: '',
})
const addIdRef = ref<HTMLInputElement | null>(null)

function openAddForm() {
  clearMessages()
  showAddForm.value = true
  nextTick(() => addIdRef.value?.focus())
}

function closeAddForm() {
  showAddForm.value = false
  addForm.id = ''
  addForm.parent = ''
  addForm.label = ''
}

function parseId(value: string): TreeItemId {
  if (value === '') return ''
  const num = Number(value)
  if (!isNaN(num) && value.trim() !== '') return num
  return value
}

function validateAdd(): string | null {
  if (!addForm.id.trim()) return 'Поле ID обязательно'
  const parsedId = parseId(addForm.id)
  if (store.value.getItem(parsedId)) return 'Элемент с таким ID уже существует'
  if (addForm.parent.trim()) {
    const parsedParent = parseId(addForm.parent)
    if (!store.value.getItem(parsedParent)) return 'Родитель с таким ID не найден'
  }
  return null
}

function handleAdd() {
  clearMessages()
  const validationError = validateAdd()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  const newItem: TreeItem = {
    id: parseId(addForm.id),
    parent: addForm.parent === '' ? null : parseId(addForm.parent),
    label: addForm.label || undefined,
  }
  store.value.addItem(newItem)
  forceUpdate()
  flashMessage('success', `Элемент «${newItem.label ?? newItem.id}» добавлен`)
  closeAddForm()
}

// ---------- remove item ----------
const deleteConfirm = ref<{ id: TreeItemId; label: string; childCount: number } | null>(null)

function confirmRemove(id: TreeItemId) {
  clearMessages()
  const item = store.value.getItem(id)
  if (!item) return
  const children = store.value.getAllChildren(id)
  deleteConfirm.value = {
    id,
    label: item.label ?? String(item.id),
    childCount: children.length,
  }
}

function handleRemoveConfirmed() {
  if (!deleteConfirm.value) return
  const { id, label, childCount } = deleteConfirm.value
  store.value.removeItem(id)
  forceUpdate()
  deleteConfirm.value = null
  const suffix = childCount > 0 ? ` и ${childCount} дочерних` : ''
  flashMessage('success', `Элемент «${label}»${suffix} удалён`)
}

function cancelRemove() {
  deleteConfirm.value = null
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
const editLabelRef = ref<HTMLInputElement | null>(null)

function openEdit(id: TreeItemId) {
  clearMessages()
  const item = store.value.getItem(id)
  if (!item) return
  editForm._originalId = id
  editIdDisplay.value = String(id)
  editForm.parent = item.parent !== null ? String(item.parent) : ''
  editForm.label = item.label ?? ''
  showEditDialog.value = true
  nextTick(() => editLabelRef.value?.focus())
}

function validateEdit(): string | null {
  if (editForm.parent.trim()) {
    const parsedParent = parseId(editForm.parent)
    if (!store.value.getItem(parsedParent)) return 'Родитель с таким ID не найден'
    if (parsedParent === editForm._originalId) return 'Элемент не может быть собственным родителем'

    // Check for cycles: the new parent must not be a descendant of edited item
    const descendants = store.value.getAllChildren(editForm._originalId)
    if (descendants.some(d => d.id === parsedParent)) return 'Нельзя сделать родителем собственного потомка (циклическая ссылка)'
  }
  return null
}

function handleEdit() {
  clearMessages()
  const validationError = validateEdit()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  const updated: TreeItem = {
    id: editForm._originalId,
    parent: editForm.parent === '' ? null : parseId(editForm.parent),
    label: editForm.label || undefined,
  }
  store.value.updateItem(updated)
  forceUpdate()
  flashMessage('success', `Элемент «${updated.label ?? updated.id}» обновлён`)
  showEditDialog.value = false
}

// ---------- ag-grid config ----------
const getDataPath = (data: Record<string, unknown>): (string | number)[] =>
  data.treePath as (string | number)[]

function actionCellRenderer(params: { data: Record<string, unknown> | null }): string | HTMLElement {
  if (!params.data) return ''
  const rawId = params.data._rawId as TreeItemId
  const container = document.createElement('div')
  container.className = 'action-cell'

  const editBtn = document.createElement('button')
  editBtn.innerHTML = '&#9998;'
  editBtn.title = 'Редактировать элемент'
  editBtn.className = 'action-btn action-btn--edit'
  editBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    openEdit(rawId)
  })

  const deleteBtn = document.createElement('button')
  deleteBtn.innerHTML = '&#10005;'
  deleteBtn.title = 'Удалить элемент'
  deleteBtn.className = 'action-btn action-btn--delete'
  deleteBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    confirmRemove(rawId)
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
    width: 70,
    minWidth: 60,
    sortable: false,
    filter: false,
  },
  {
    headerName: 'Категория',
    field: '_category',
    width: 110,
    minWidth: 100,
    sortable: false,
    filter: false,
    cellStyle: { fontWeight: 500 },
  },
  {
    headerName: 'ID',
    field: 'id',
    width: 130,
    minWidth: 100,
  },
  {
    headerName: 'Родитель',
    field: 'parent',
    width: 130,
    minWidth: 100,
  },
  {
    headerName: 'Действия',
    colId: 'actions',
    cellRenderer: actionCellRenderer,
    width: 90,
    minWidth: 80,
    sortable: false,
    filter: false,
    pinned: 'right',
  },
]

const autoGroupColumnDef = {
  headerName: 'Элемент',
  minWidth: 250,
  flex: 1,
  cellRendererParams: {
    suppressCount: true,
    innerRenderer: (p: { data: Record<string, unknown> | null; value: string | number }) => {
      const label = p.data?.label as string | undefined
      const rawId = p.data?._rawId as string | number | undefined
      if (label) return label
      if (rawId !== undefined) return String(rawId)
      return String(p.value)
    },
  },
}

const defaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
  floatingFilter: false,
}

const gridOptions = {
  rowHeight: 42,
  headerHeight: 36,
  suppressRowClickSelection: true,
  enableCellTextSelection: true,
  ensureDomOrder: true,
}
</script>

<template>
  <div class="tree-table-container">
    <!-- Header toolbar -->
    <div class="toolbar">
      <div class="toolbar__left">
        <button
          class="btn btn--add"
          :class="{ 'btn--active': showAddForm }"
          @click="showAddForm ? closeAddForm() : openAddForm()"
        >
          <span class="btn__icon">{{ showAddForm ? '✕' : '+' }}</span>
          {{ showAddForm ? 'Закрыть' : 'Добавить элемент' }}
        </button>
      </div>
      <div class="toolbar__right">
        <span class="toolbar__counter">{{ totalCount }} элемент(ов)</span>
      </div>
    </div>

    <!-- Toast notifications -->
    <Transition name="toast">
      <div v-if="successMessage" class="toast toast--success" @click="successMessage = ''">
        {{ successMessage }}
      </div>
    </Transition>
    <Transition name="toast">
      <div v-if="errorMessage" class="toast toast--error" @click="errorMessage = ''">
        {{ errorMessage }}
      </div>
    </Transition>

    <!-- Add form -->
    <Transition name="slide">
      <div v-if="showAddForm" class="form-panel">
        <div class="form-panel__title">Новый элемент</div>
        <div class="form-row">
          <label class="form-field">
            <span class="form-field__label">ID *</span>
            <input
              ref="addIdRef"
              v-model="addForm.id"
              class="form-field__input"
              placeholder="число или строка"
              @keydown.enter.prevent="handleAdd"
              @keydown.escape.prevent="closeAddForm"
            />
          </label>
          <label class="form-field">
            <span class="form-field__label">Родитель</span>
            <input
              v-model="addForm.parent"
              class="form-field__input"
              placeholder="пусто = корень"
              @keydown.enter.prevent="handleAdd"
              @keydown.escape.prevent="closeAddForm"
            />
          </label>
          <label class="form-field">
            <span class="form-field__label">Название</span>
            <input
              v-model="addForm.label"
              class="form-field__input"
              placeholder="название элемента"
              @keydown.enter.prevent="handleAdd"
              @keydown.escape.prevent="closeAddForm"
            />
          </label>
          <div class="form-actions">
            <button class="btn btn--primary" @click="handleAdd">Добавить</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- AG Grid table -->
    <div class="ag-theme-quartz tree-table">
      <AgGridVue
        :row-data="rowData"
        :column-defs="columnDefs"
        :grid-options="gridOptions"
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

    <!-- Edit dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEditDialog" class="modal-overlay" @click.self="showEditDialog = false" @keydown.escape="showEditDialog = false">
          <div class="modal" role="dialog" aria-label="Редактирование элемента">
            <div class="modal__header">
              <h3 class="modal__title">Редактировать элемент</h3>
              <button class="modal__close" title="Закрыть" @click="showEditDialog = false">✕</button>
            </div>
            <div class="form-row">
              <label class="form-field">
                <span class="form-field__label">ID</span>
                <input :value="editIdDisplay" class="form-field__input" disabled />
              </label>
              <label class="form-field">
                <span class="form-field__label">Родитель</span>
                <input
                  v-model="editForm.parent"
                  class="form-field__input"
                  placeholder="пусто = корень"
                  @keydown.enter.prevent="handleEdit"
                  @keydown.escape.prevent="showEditDialog = false"
                />
              </label>
              <label class="form-field">
                <span class="form-field__label">Название</span>
                <input
                  ref="editLabelRef"
                  v-model="editForm.label"
                  class="form-field__input"
                  placeholder="название элемента"
                  @keydown.enter.prevent="handleEdit"
                  @keydown.escape.prevent="showEditDialog = false"
                />
              </label>
            </div>
            <div class="modal__actions">
              <button class="btn btn--primary" @click="handleEdit">Сохранить</button>
              <button class="btn" @click="showEditDialog = false">Отмена</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete confirmation dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="deleteConfirm" class="modal-overlay" @click.self="cancelRemove" @keydown.enter="handleRemoveConfirmed" @keydown.escape="cancelRemove">
          <div class="modal modal--warning" role="dialog" aria-label="Подтверждение удаления">
            <div class="modal__header">
              <h3 class="modal__title">Подтверждение удаления</h3>
            </div>
            <p class="modal__body">
              Вы уверены, что хотите удалить элемент
              <strong>«{{ deleteConfirm.label }}»</strong>?
            </p>
            <p v-if="deleteConfirm.childCount > 0" class="modal__body modal__body--warn">
              ⚠ Вместе с ним будет удалено <strong>{{ deleteConfirm.childCount }}</strong> дочерних элемент(ов).
            </p>
            <div class="modal__actions">
              <button class="btn btn--danger" @click="handleRemoveConfirmed">Удалить</button>
              <button class="btn" @click="cancelRemove">Отмена</button>
            </div>
            <div class="modal__footer-hint">Enter — подтвердить, Esc — отмена</div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ============== Layout ============== */
.tree-table-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ============== Toolbar ============== */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.toolbar__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__counter {
  font-size: 13px;
  color: #888;
  white-space: nowrap;
}

/* ============== Buttons ============== */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  cursor: pointer;
  border: 1px solid #d0d5dd;
  background: #fff;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 500;
  color: #344054;
  transition: all 0.15s ease;
  user-select: none;
}

.btn:hover {
  background: #f0f2f5;
  border-color: #b0b8c4;
}

.btn:active {
  background: #e4e7ec;
}

.btn--primary {
  background: #4a90d9;
  color: #fff;
  border-color: #357abd;
}

.btn--primary:hover {
  background: #357abd;
  border-color: #2a6cb0;
}

.btn--primary:active {
  background: #2a6cb0;
}

.btn--danger {
  background: #e74c3c;
  color: #fff;
  border-color: #c0392b;
}

.btn--danger:hover {
  background: #c0392b;
  border-color: #a93226;
}

.btn--add {
  background: #e8f5e9;
  color: #2e7d32;
  border-color: #a5d6a7;
}

.btn--add:hover {
  background: #c8e6c9;
  border-color: #81c784;
}

.btn--add.btn--active {
  background: #fce4ec;
  color: #c62828;
  border-color: #ef9a9a;
}

.btn--add.btn--active:hover {
  background: #f8bbd0;
}

.btn__icon {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

/* ============== Toast notifications ============== */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  cursor: pointer;
  max-width: 400px;
}

.toast--success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.toast--error {
  background: #fce4ec;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* ============== Add form ============== */
.form-panel {
  background: #f9fafb;
  border: 1px solid #e0e4e8;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;
}

.form-panel__title {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 160px;
  min-width: 140px;
}

.form-field__label {
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.form-field__input {
  padding: 7px 10px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  width: 100%;
}

.form-field__input:focus {
  border-color: #4a90d9;
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.15);
}

.form-field__input:disabled {
  background: #f0f2f5;
  color: #999;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

/* Slide transition for form */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-bottom: 0;
  border-width: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 200px;
}

/* ============== Modal / Dialog ============== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  min-width: 440px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.modal--warning {
  max-width: 420px;
  min-width: 360px;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.modal__close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
}

.modal__close:hover {
  background: #f0f2f5;
  color: #333;
}

.modal__body {
  margin: 0 0 12px;
  font-size: 15px;
  color: #444;
  line-height: 1.5;
}

.modal__body--warn {
  color: #c62828;
  background: #fce4ec;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 14px;
}

.modal__actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.modal__footer-hint {
  margin-top: 12px;
  font-size: 12px;
  color: #999;
  text-align: center;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.95);
}

/* ============== AG Grid overrides ============== */
.tree-table {
  flex: 1;
  width: 100%;
}

/* Style action buttons inside grid */
:deep(.action-cell) {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 100%;
}

:deep(.action-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px 6px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  font-size: 15px;
  line-height: 1;
  transition: all 0.15s;
  color: #666;
  width: 30px;
  height: 28px;
}

:deep(.action-btn--edit:hover) {
  background: #e3f2fd;
  color: #1976d2;
  border-color: #bbdefb;
}

:deep(.action-btn--delete:hover) {
  background: #fce4ec;
  color: #d32f2f;
  border-color: #f8bbd0;
}

/* Make rows with groups stand out slightly */
:deep(.ag-row) {
  border-bottom: 1px solid #f0f0f0 !important;
  cursor: default;
}

:deep(.ag-row:hover) {
  background-color: #f8faff !important;
}

:deep(.ag-row-group) {
  font-weight: 500;
}

:deep(.ag-header-cell) {
  font-weight: 600;
  color: #555;
}

:deep(.ag-header-cell-text) {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
</style>
