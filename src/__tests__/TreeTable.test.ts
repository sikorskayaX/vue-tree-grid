import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import TreeTable from '../components/TreeTable.vue'
import type { TreeItem } from '../types'

// Mock browser APIs that AG Grid requires
beforeAll(() => {
  if (typeof ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }

  if (typeof SVGElement !== 'undefined') {
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
      writable: true,
      configurable: true,
    })
  }
})

const testItems: TreeItem[] = [
  { id: 1, parent: null, label: 'Айтем 1' },
  { id: 2, parent: 1, label: 'Айтем 2' },
  { id: 3, parent: 2, label: 'Айтем 3' },
]

describe('TreeTable', () => {
  it('should mount without errors', () => {
    const wrapper = mount(TreeTable, {
      props: { items: testItems },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('should render grid container with ag-theme-quartz class', () => {
    const wrapper = mount(TreeTable, {
      props: { items: testItems },
    })
    const gridContainer = wrapper.find('.ag-theme-quartz')
    expect(gridContainer.exists()).toBe(true)
  })

  it('should render the ag-grid-vue component', () => {
    const wrapper = mount(TreeTable, {
      props: { items: testItems },
    })
    // AG Grid renders a .ag-root DOM element inside
    expect(wrapper.find('.ag-root').exists()).toBe(true)
  })

  it('should render column headers', () => {
    const wrapper = mount(TreeTable, {
      props: { items: testItems },
    })
    const headerCells = wrapper.findAll('.ag-header-cell-text')
    const headerTexts = headerCells.map(el => el.text())
    expect(headerTexts).toContain('№ п/п')
    expect(headerTexts).toContain('Категория')
    expect(headerTexts).toContain('ID')
    expect(headerTexts).toContain('Parent')
  })

  it('should render correct number of rows', () => {
    const wrapper = mount(TreeTable, {
      props: { items: testItems },
    })
    // With tree data, AG Grid creates virtual group rows
    const rows = wrapper.findAll('.ag-row')
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })

  it('should display Категория values', () => {
    const wrapper = mount(TreeTable, {
      props: { items: testItems },
    })
    const categoryCells = wrapper.findAll(
      '.ag-cell[col-id="Категория"], .ag-cell-value'
    )
    const categoryTexts = categoryCells
      .map(el => el.text())
      .filter(t => t === 'Группа' || t === 'Элемент')
    expect(categoryTexts.length).toBeGreaterThan(0)
  })
})
