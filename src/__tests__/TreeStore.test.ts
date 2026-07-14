import { describe, it, expect, beforeEach } from 'vitest'
import { TreeStore } from '../store/TreeStore'
import type { TreeItem, TreeItemId } from '../types'

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

describe('TreeStore', () => {
  let store: TreeStore

  beforeEach(() => {
    store = new TreeStore(items)
  })

  describe('constructor', () => {
    it('should store all items', () => {
      expect(store.getAll()).toHaveLength(8)
    })
  })

  describe('getAll()', () => {
    it('should return all items', () => {
      const all = store.getAll()
      expect(all).toHaveLength(8)
    })

    it('should return items in original order', () => {
      const all = store.getAll()
      expect(all[0].id).toBe(1)
      expect(all[1].id).toBe('91064cee')
      expect(all[7].id).toBe(8)
    })
  })

  describe('getItem()', () => {
    it('should return item by numeric id', () => {
      const item = store.getItem(1)
      expect(item).toBeDefined()
      expect(item!.label).toBe('Айтем 1')
    })

    it('should return item by string id', () => {
      const item = store.getItem('91064cee')
      expect(item).toBeDefined()
      expect(item!.label).toBe('Айтем 2')
    })

    it('should return undefined for non-existing id', () => {
      expect(store.getItem(999)).toBeUndefined()
    })
  })

  describe('hasChildren()', () => {
    it('should return true for root with children', () => {
      expect(store.hasChildren(1)).toBe(true)
    })

    it('should return true for intermediate node', () => {
      expect(store.hasChildren('91064cee')).toBe(true)
    })

    it('should return true for deeper node with children', () => {
      expect(store.hasChildren(4)).toBe(true)
    })

    it('should return false for leaf node', () => {
      expect(store.hasChildren(7)).toBe(false)
    })

    it('should return false for non-existing id', () => {
      expect(store.hasChildren(999)).toBe(false)
    })
  })

  describe('getChildren()', () => {
    it('should return direct children of root item', () => {
      const children = store.getChildren(1)
      expect(children).toHaveLength(2)
      // children are returned in insertion order
      expect(children.map((c: TreeItem) => c.id)).toEqual(['91064cee', 3])
    })

    it('should return direct children of intermediate node', () => {
      const children = store.getChildren('91064cee')
      expect(children).toHaveLength(3)
      expect(children.map((c: TreeItem) => c.id)).toEqual([4, 5, 6])
    })

    it('should return children of deeper node', () => {
      const children = store.getChildren(4)
      expect(children).toHaveLength(2)
      expect(children.map((c: TreeItem) => c.id)).toEqual([7, 8])
    })

    it('should return empty array for leaf node', () => {
      expect(store.getChildren(7)).toEqual([])
    })

    it('should return empty array for non-existing id', () => {
      expect(store.getChildren(999)).toEqual([])
    })
  })

  describe('getAllChildren()', () => {
    it('should return all descendants of root', () => {
      const all = store.getAllChildren(1)
      expect(all).toHaveLength(7)
    })

    it('should return all descendants of intermediate node', () => {
      const all = store.getAllChildren('91064cee')
      expect(all).toHaveLength(5)
      expect(all.map((c: TreeItem) => c.id)).toContain(4)
      expect(all.map((c: TreeItem) => c.id)).toContain(7)
    })

    it('should return empty array for leaf node', () => {
      expect(store.getAllChildren(7)).toEqual([])
    })

    it('should return empty array for non-existing id', () => {
      expect(store.getAllChildren(999)).toEqual([])
    })
  })

  describe('getAllParents()', () => {
    it('should return path from leaf to root', () => {
      const parents = store.getAllParents(7)
      expect(parents).toHaveLength(4)
      expect(parents[0].id).toBe(7)
      expect(parents[1].id).toBe(4)
      expect(parents[2].id).toBe('91064cee')
      expect(parents[3].id).toBe(1)
    })

    it('should return path from intermediate node to root', () => {
      const parents = store.getAllParents('91064cee')
      expect(parents).toHaveLength(2)
      expect(parents[0].id).toBe('91064cee')
      expect(parents[1].id).toBe(1)
    })

    it('should return only root item for root node', () => {
      const parents = store.getAllParents(1)
      expect(parents).toHaveLength(1)
      expect(parents[0].id).toBe(1)
    })

    it('should return empty array for non-existing id', () => {
      expect(store.getAllParents(999)).toEqual([])
    })
  })

  describe('addItem()', () => {
    it('should add a new leaf item to root', () => {
      const newItem: TreeItem = { id: 9, parent: null, label: 'Айтем 9' }
      store.addItem(newItem)
      expect(store.getAll()).toHaveLength(9)
      expect(store.getItem(9)).toEqual(newItem)
      expect(store.getChildren(null as any)).toEqual([])
    })

    it('should add a new child to existing parent', () => {
      const newItem: TreeItem = { id: 10, parent: 4, label: 'Айтем 10' }
      store.addItem(newItem)
      expect(store.getAll()).toHaveLength(9)
      expect(store.getChildren(4)).toHaveLength(3)
      expect(store.getChildren(4).find((c: TreeItem) => c.id === 10)).toBeDefined()
    })

    it('should add a new item without label', () => {
      const newItem: TreeItem = { id: 99, parent: null }
      store.addItem(newItem)
      expect(store.getItem(99)).toEqual(newItem)
    })
  })

  describe('removeItem()', () => {
    it('should remove a leaf node', () => {
      store.removeItem(7)
      expect(store.getItem(7)).toBeUndefined()
      expect(store.getChildren(4)).toHaveLength(1)
      expect(store.getChildren(4)[0].id).toBe(8)
    })

    it('should remove node with all descendants', () => {
      store.removeItem(4)
      expect(store.getItem(4)).toBeUndefined()
      expect(store.getItem(7)).toBeUndefined()
      expect(store.getItem(8)).toBeUndefined()
      expect(store.getChildren('91064cee')).toHaveLength(2)
    })

    it('should remove root node with all descendants', () => {
      store.removeItem(1)
      expect(store.getItem(1)).toBeUndefined()
      expect(store.getAll()).toHaveLength(0)
    })

    it('should handle non-existing id gracefully', () => {
      expect(() => store.removeItem(999)).not.toThrow()
    })
  })

  describe('updateItem()', () => {
    it('should update item label', () => {
      const updated = { id: 1, parent: null, label: 'Обновлённый корень' }
      store.updateItem(updated)
      expect(store.getItem(1)!.label).toBe('Обновлённый корень')
    })

    it('should change parent of an item', () => {
      const updated = { id: 4, parent: 1, label: 'Айтем 4' }
      store.updateItem(updated)
      expect(store.getChildren(1)).toHaveLength(3)
      expect(store.getChildren('91064cee')).toHaveLength(2)
      expect(store.getChildren(1).find(c => c.id === 4)).toBeDefined()
    })

    it('should move item to root', () => {
      const updated = { id: 4, parent: null, label: 'Айтем 4' }
      store.updateItem(updated)
      expect(store.getItem(4)!.parent).toBeNull()
    })

    it('should do nothing for non-existing id', () => {
      store.updateItem({ id: 999, parent: null } as TreeItem)
      expect(store.getAll()).toHaveLength(8)
    })
  })
})
