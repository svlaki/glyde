import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { supabase } from '../lib/supabase'
import { fetchUserCategories, createUserCategory, updateUserCategory, deleteUserCategory, Category } from '../lib/categoryService'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useToast } from '../components/ui/toast'

type CategoryFormValues = Pick<Category, 'name' | 'color' | 'icon' | 'description'>

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const { toast } = useToast()
  const loadErrorShown = useRef(false)
  const isMountedRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadCategories = useCallback(async () => {
    if (!user) {
      if (!isMountedRef.current) return
      setCategories([])
      setLoading(false)
      hasLoadedOnceRef.current = false
      return
    }

    try {
      const { categories: data, error: fetchError } = await fetchUserCategories(user)

      if (!isMountedRef.current) {
        return
      }

      if (fetchError) {
        if (!hasLoadedOnceRef.current) {
          setError(fetchError)
        }
        if (!loadErrorShown.current) {
          toast({
            title: 'Unable to load categories',
            description: fetchError,
            variant: 'error'
          })
          loadErrorShown.current = true
        }
        return
      }

      loadErrorShown.current = false
      setCategories(data)
      setError(null)
      hasLoadedOnceRef.current = true
    } catch (err) {
      if (!isMountedRef.current) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to load categories'
      if (!hasLoadedOnceRef.current) {
        setError('Failed to load categories')
      }
      if (!loadErrorShown.current) {
        toast({
          title: 'Failed to load categories',
          description: message,
          variant: 'error'
        })
        loadErrorShown.current = true
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [toast, user])

  useEffect(() => {
    if (!user) {
      setCategories([])
      setLoading(false)
      hasLoadedOnceRef.current = false
      return
    }

    setLoading(true)
    void loadCategories()

    const channel = supabase
      .channel(`categories-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${user.id}` },
        () => {
          void loadCategories()
        }
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [loadCategories, user])

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
    setIsSaving(false)
  }

  async function handleSaveCategory(categoryData: CategoryFormValues) {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in to manage categories.', variant: 'warning' })
      return
    }

    try {
      setIsSaving(true)

      if (editingCategory) {
        const { error: updateError } = await updateUserCategory(user, editingCategory.id, categoryData)
        if (updateError) {
          throw new Error(updateError)
        }
        toast({
          title: 'Category updated',
          description: `"${categoryData.name || editingCategory.name}" has been refreshed.`,
          variant: 'success'
        })
      } else {
        const { error: createError } = await createUserCategory(user, categoryData)
        if (createError) {
          throw new Error(createError)
        }
        toast({
          title: 'Category created',
          description: `"${categoryData.name}" is ready to use.`,
          variant: 'success'
        })
      }

      await loadCategories()
      handleModalClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save category'
      toast({ title: 'Unable to save category', description: message, variant: 'error' })
      console.error('Failed to save category:', err)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in to manage categories.', variant: 'warning' })
      return
    }

    const confirmed = confirm('Are you sure you want to delete this category?')
    if (!confirmed) return

    try {
      setDeletingCategoryId(id)
      const { success, error: deleteError, message } = await deleteUserCategory(user, id)
      if (!success || deleteError) {
        throw new Error(deleteError || message || 'Failed to delete category')
      }

      toast({ title: 'Category deleted', description: 'The category has been removed.', variant: 'success' })
      await loadCategories()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete category'
      toast({ title: 'Unable to delete category', description: message, variant: 'error' })
      console.error('Failed to delete category:', err)
    } finally {
      setDeletingCategoryId(null)
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
        <div className="flex justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-foreground">Categories</h1>
          <Button
            onClick={handleCreateClick}
            className="bg-primary px-6 py-2.5 text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl"
            size="lg"
          >
            ➕ Create Category
          </Button>
        </div>

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-card/40 p-10 text-center text-muted-foreground">
            <p className="text-base">You haven&apos;t created any categories yet.</p>
            <p className="text-sm text-muted-foreground/80">Organize tasks faster by grouping them into color-coded categories.</p>
            <Button onClick={handleCreateClick} size="lg" variant="outline" className="border-dashed">
              Start with your first category
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categories.map(category => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={handleEditClick}
                onDelete={handleDeleteCategory}
                isDeleting={deletingCategoryId === category.id}
              />
            ))}
          </div>
        )}

        <CategoryModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          category={editingCategory}
          onSave={handleSaveCategory}
          isSaving={isSaving}
        />
      </div>
    </div>
  )
}

interface CategoryCardProps {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (id: string) => Promise<void> | void
  isDeleting: boolean
}

function CategoryCard({ category, onEdit, onDelete, isDeleting }: CategoryCardProps) {
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
        <Button
          onClick={() => onEdit(category)}
          variant="ghost"
          size="sm"
          className="text-sm font-semibold text-primary hover:text-primary/80"
        >
          ✏️ Edit
        </Button>
        <Button
          onClick={() => onDelete(category.id)}
          variant="ghost"
          size="sm"
          disabled={isDeleting}
          className="text-sm font-semibold text-red-500 hover:text-red-600 disabled:text-red-300"
        >
          {isDeleting ? 'Deleting…' : '🗑️ Delete'}
        </Button>
      </div>
    </div>
  )
}

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  category: Category | null
  onSave: (data: CategoryFormValues) => Promise<void> | void
  isSaving: boolean
}

function CategoryModal({ isOpen, onClose, category, onSave, isSaving }: CategoryModalProps) {
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
    if (!name.trim() || isSaving) return

    const trimmedDescription = description.trim()
    const trimmedIcon = icon.trim()

    void onSave({
      name: name.trim(),
      color,
      icon: trimmedIcon ? trimmedIcon : undefined,
      description: trimmedDescription ? trimmedDescription : undefined,
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
            disabled={!name.trim() || isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSaving ? 'Saving…' : category ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
