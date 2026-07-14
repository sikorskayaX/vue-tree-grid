import type { TreeItem, TreeItemId } from '@/types'

export class TreeStore {
  private itemsMap: Map<TreeItemId, TreeItem> = new Map()
  private childrenMap: Map<TreeItemId, TreeItemId[]> = new Map()
  private rootIds: TreeItemId[] = []

  constructor(items: TreeItem[]) {
    for (const item of items) {
      this.itemsMap.set(item.id, item)

      if (item.parent === null) {
        this.rootIds.push(item.id)
      } else {
        const siblings = this.childrenMap.get(item.parent)
        if (siblings) {
          siblings.push(item.id)
        } else {
          this.childrenMap.set(item.parent, [item.id])
        }
      }
    }
  }

  getAll(): TreeItem[] {
    return Array.from(this.itemsMap.values())
  }

  getItem(id: TreeItemId): TreeItem | undefined {
    return this.itemsMap.get(id)
  }

  hasChildren(id: TreeItemId): boolean {
    const childrenIds = this.childrenMap.get(id)
    return !!childrenIds && childrenIds.length > 0
  }

  getChildren(id: TreeItemId): TreeItem[] {
    const childrenIds = this.childrenMap.get(id)
    if (!childrenIds) return []

    const result: TreeItem[] = []
    for (const childId of childrenIds) {
      const item = this.itemsMap.get(childId)
      if (item) result.push(item)
    }
    return result
  }

  getAllChildren(id: TreeItemId): TreeItem[] {
    const directChildren = this.childrenMap.get(id)
    if (!directChildren) return []

    const result: TreeItem[] = []
    const idsToProcess: TreeItemId[] = [...directChildren]

    while (idsToProcess.length > 0) {
      const currentId = idsToProcess.pop()!
      const item = this.itemsMap.get(currentId)
      if (item) {
        result.push(item)
      }
      const grandChildren = this.childrenMap.get(currentId)
      if (grandChildren) {
        for (let i = grandChildren.length - 1; i >= 0; i--) {
          idsToProcess.push(grandChildren[i])
        }
      }
    }

    return result
  }

  getAllParents(id: TreeItemId): TreeItem[] {
    const result: TreeItem[] = []
    let currentId: TreeItemId | null = id

    while (currentId != null) {
      const item = this.itemsMap.get(currentId)
      if (!item) break
      result.push(item)
      currentId = item.parent
    }

    return result
  }

  addItem(item: TreeItem): void {
    this.itemsMap.set(item.id, item)

    if (item.parent === null) {
      this.rootIds.push(item.id)
    } else {
      const siblings = this.childrenMap.get(item.parent)
      if (siblings) {
        siblings.push(item.id)
      } else {
        this.childrenMap.set(item.parent, [item.id])
      }
    }
  }

  removeItem(id: TreeItemId): void {
    const idsToRemove: TreeItemId[] = [id]
    const queue: TreeItemId[] = [id]
    let headIndex = 0

    while (headIndex < queue.length) {
      const currentId = queue[headIndex]
      headIndex++
      const children = this.childrenMap.get(currentId)
      if (children) {
        for (const childId of children) {
          idsToRemove.push(childId)
          queue.push(childId)
        }
      }
    }

    const item = this.itemsMap.get(id)
    if (item) {
      if (item.parent === null) {
        const idx = this.rootIds.indexOf(id)
        if (idx !== -1) this.rootIds.splice(idx, 1)
      } else {
        const parentChildren = this.childrenMap.get(item.parent)
        if (parentChildren) {
          const idx = parentChildren.indexOf(id)
          if (idx !== -1) parentChildren.splice(idx, 1)
        }
      }
    }

    for (const removeId of idsToRemove) {
      this.itemsMap.delete(removeId)
      this.childrenMap.delete(removeId)
    }
  }

  updateItem(updatedItem: TreeItem): void {
    const existing = this.itemsMap.get(updatedItem.id)
    if (!existing) return

    if (existing.parent !== updatedItem.parent) {
      if (existing.parent === null) {
        const idx = this.rootIds.indexOf(updatedItem.id)
        if (idx !== -1) this.rootIds.splice(idx, 1)
      } else {
        const oldParentChildren = this.childrenMap.get(existing.parent)
        if (oldParentChildren) {
          const idx = oldParentChildren.indexOf(updatedItem.id)
          if (idx !== -1) oldParentChildren.splice(idx, 1)
        }
      }

      if (updatedItem.parent === null) {
        this.rootIds.push(updatedItem.id)
      } else {
        const newParentChildren = this.childrenMap.get(updatedItem.parent)
        if (newParentChildren) {
          newParentChildren.push(updatedItem.id)
        } else {
          this.childrenMap.set(updatedItem.parent, [updatedItem.id])
        }
      }
    }

    this.itemsMap.set(updatedItem.id, updatedItem)
  }
}
