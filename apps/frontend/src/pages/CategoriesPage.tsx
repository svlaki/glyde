import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { fetchUserCategories, createUserCategory, updateUserCategory, deleteUserCategory, Category } from '../lib/categoryService'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  useEffect(() => {
    if (user) {
      loadCategories()
      subscribeToCategories()
    }
  }, [user])

  async function loadCategories() {
    try {
      const { categories: data, error: fetchError } = await fetchUserCategories(user!)
      if (fetchError) {
        setError(fetchError)
      } else {
        setCategories(data)
        setError(null)
      }
    } catch (err) {
      setError('Failed to load categories')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function subscribeToCategories() {
    const channel = supabase
      .channel('categories-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user!.id}` },
        () => loadCategories()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  function handleCreateClick() {
    setEditingCategory(null)
    setIsModalOpen(true)
  }

  function handleEditClick(category: Category) {
    setEditingCategory(category)
    setIsModalOpen(true)
  }

  function handleModalClose() {
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  async function handleSaveCategory(categoryData: Partial<Category>) {
    try {
      if (editingCategory) {
        await updateUserCategory(user!, editingCategory.id, categoryData)
      } else {
        await createUserCategory(user!, categoryData)
      }
      await loadCategories()
      handleModalClose()
    } catch (err) {
      console.error('Failed to save category:', err)
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm('Are you sure you want to delete this category?')) return
    try {
      await deleteUserCategory(user!, id)
      await loadCategories()
    } catch (err) {
      console.error('Failed to delete category:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading categories...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-foreground">Categories</h1>
          <button
            onClick={handleCreateClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            ➕ Create Category
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(category => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleEditClick}
              onDelete={handleDeleteCategory}
            />
          ))}
        </div>

        <CategoryModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          category={editingCategory}
          onSave={handleSaveCategory}
        />
      </div>
    </div>
  )
}

interface CategoryCardProps {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
}

function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-6 shadow-md hover:shadow-xl transition-all"
      style={{ borderLeftWidth: '4px', borderLeftColor: category.color }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{category.icon || '📁'}</span>
          <h3 className="text-xl font-bold text-foreground">{category.name}</h3>
        </div>
        <div
          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: category.color }}
        />
      </div>

      {category.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {category.description}
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onEdit(category)}
          className="text-sm text-primary hover:text-primary/80 font-semibold px-3 py-1.5 rounded-md hover:bg-primary/10 transition-all"
        >
          ✏️ Edit
        </button>
        <button
          onClick={() => onDelete(category.id)}
          className="text-sm text-red-500 hover:text-red-600 font-semibold px-3 py-1.5 rounded-md hover:bg-red-500/10 transition-all"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  )
}

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  category: Category | null
  onSave: (data: Partial<Category>) => void
}

function CategoryModal({ isOpen, onClose, category, onSave }: CategoryModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (category) {
      setName(category.name || '')
      setColor(category.color || '#3b82f6')
      setIcon(category.icon || '')
      setDescription(category.description || '')
    } else {
      setName('')
      setColor('#3b82f6')
      setIcon('')
      setDescription('')
    }
  }, [category, isOpen])

  function handleSubmit() {
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      color,
      icon,
      description: description.trim(),
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-full max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {category ? '✏️ Edit Category' : '➕ Create Category'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Name *</label>
            <Input
              placeholder="Enter category name..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Color *</label>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-11 w-full border border-input rounded-lg cursor-pointer bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Icon</label>
              <Input
                placeholder="😊"
                value={icon}
                onChange={e => setIcon(e.target.value)}
                className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Description</label>
            <textarea
              placeholder="Enter category description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full h-24 border border-input bg-background rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {category ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
