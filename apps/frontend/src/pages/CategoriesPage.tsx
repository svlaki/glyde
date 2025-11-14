import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { fetchUserCategories, createUserCategory, updateUserCategory, deleteUserCategory, Category } from '../lib/categoryService'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

export default function CategoriesPage() {
  const { user, session } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  useEffect(() => {
    if (!user) {
      return
    }

    loadCategories()
    const unsubscribe = subscribeToCategories()

    return () => {
      unsubscribe()
    }
  }, [user])

  async function loadCategories() {
    try {
      const { categories: data, error: fetchError } = await fetchUserCategories(user!, session?.access_token)
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
        await updateUserCategory(user!, editingCategory.id, categoryData, session?.access_token)
      } else {
        await createUserCategory(user!, categoryData, session?.access_token)
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
      await deleteUserCategory(user!, id, session?.access_token)
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
      <div className="container mx-auto px-3 py-5 max-w-5xl">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-3xl font-bold text-foreground">Categories</h1>
          <button
            onClick={handleCreateClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Create Category
          </button>
        </div>

        <div className="grid grid-cols-5 gap-4">
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
  // Convert hex color to rgba with transparency for background
  const hexToRgba = (hex: string, alpha: number = 0.15) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div
      className="relative border-3 rounded-xl p-6 shadow-sm hover:shadow-xl transition-all aspect-square flex flex-col items-center justify-between text-center group cursor-pointer"
      style={{
        borderColor: category.color,
        backgroundColor: hexToRgba(category.color, 0.15),
        borderWidth: '3px'
      }}
      onClick={() => onEdit(category)}
    >
      {/* Top content - icon, name, description */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Icon - large and centered */}
        <div className="text-6xl mb-3">{category.icon || ''}</div>

        {/* Category name */}
        <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-2">
          {category.name}
        </h3>

        {/* Description - always visible */}
        {category.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 px-2">
            {category.description}
          </p>
        )}
      </div>

      {/* Action buttons - at bottom, show on hover */}
      <div className="w-full flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity mt-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit(category)
          }}
          className="text-sm text-primary hover:text-primary/80 font-semibold px-3 py-1.5 rounded-md hover:bg-primary/10 transition-all bg-background/80"
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(category.id)
          }}
          className="text-sm text-red-500 hover:text-red-600 font-semibold px-3 py-1.5 rounded-md hover:bg-red-500/10 transition-all bg-background/80"
        >
          Delete
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md w-full max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {category ? 'Edit Category' : 'Create Category'}
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
