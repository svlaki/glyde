import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { fetchUserCategories, createUserCategory, updateUserCategory, deleteUserCategory, Category } from '../lib/categoryService'

export default function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  useEffect(() => {
    if (user) {
      loadCategories()
    }
  }, [user])

  async function loadCategories() {
    if (!user) return
    setLoading(true)
    const { categories: fetchedCategories, error } = await fetchUserCategories(user)
    if (error) {
      setError(error)
    } else {
      setCategories(fetchedCategories)
    }
    setLoading(false)
  }

  async function handleCreateCategory(categoryData: Partial<Category>) {
    if (!user) return
    const { error } = await createUserCategory(user, categoryData as any)
    if (error) {
      setError(error)
    } else {
      await loadCategories()
      setShowCreateModal(false)
    }
  }

  async function handleUpdateCategory(categoryId: string, updates: Partial<Category>) {
    if (!user) return
    const { error } = await updateUserCategory(user, categoryId, updates)
    if (error) {
      setError(error)
    } else {
      await loadCategories()
      setEditingCategory(null)
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!user) return
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) return
    const { error } = await deleteUserCategory(user, categoryId)
    if (error) {
      setError(error)
    } else {
      await loadCategories()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <div className="text-lg text-foreground">Loading categories...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">🏷️ Categories</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
          >
            ➕ Create Category
          </button>
        </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-card border border-border rounded-xl">
            <div className="text-6xl mb-4">🏷️</div>
            <p className="text-lg text-muted-foreground">
              No categories found. Create your first category!
            </p>
          </div>
        ) : (
          categories.map(category => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={setEditingCategory}
              onDelete={handleDeleteCategory}
            />
          ))
        )}
      </div>

      {showCreateModal && (
        <CategoryModal
          onSave={handleCreateCategory}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingCategory && (
        <CategoryModal
          category={editingCategory}
          onSave={(updates) => handleUpdateCategory(editingCategory.id, updates)}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
    </div>
  )
}

function CategoryCard({
  category,
  onEdit,
  onDelete
}: {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-lg hover:scale-105 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {category.icon && <span className="text-2xl">{category.icon}</span>}
          <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
        </div>
        <div
          className="w-8 h-8 rounded-full border-2 border-border shadow-sm"
          style={{ backgroundColor: category.color }}
        />
      </div>

      {category.description && (
        <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
      )}

      {category.context && Object.keys(category.context).length > 0 && (
        <div className="mb-3">
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
              🤖 AI Context ({Object.keys(category.context).length} fields)
            </summary>
            <pre className="mt-2 p-3 bg-accent/50 rounded-lg text-xs overflow-x-auto text-foreground">
              {JSON.stringify(category.context, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-3 border-t border-border">
        <button
          onClick={() => onEdit(category)}
          className="text-sm text-primary hover:text-primary/80 font-semibold px-3 py-1.5 rounded-md hover:bg-primary/10 transition-all"
        >
          ✏️ Edit
        </button>
        <button
          onClick={() => onDelete(category.id)}
          className="text-sm text-destructive hover:text-destructive/80 font-semibold px-3 py-1.5 rounded-md hover:bg-destructive/10 transition-all"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  )
}

function CategoryModal({
  category,
  onSave,
  onClose
}: {
  category?: Category
  onSave: (category: Partial<Category>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    color: category?.color || '#3b82f6',
    icon: category?.icon || '',
    description: category?.description || '',
    context: category?.context ? JSON.stringify(category.context, null, 2) : '{}'
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const contextParsed = JSON.parse(formData.context)
      onSave({
        name: formData.name,
        color: formData.color,
        icon: formData.icon || undefined,
        description: formData.description || undefined,
        context: Object.keys(contextParsed).length > 0 ? contextParsed : undefined
      })
    } catch (e) {
      alert('Invalid JSON in context field')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {category ? '✏️ Edit Category' : '➕ Create Category'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Color *</label>
            <div className="flex gap-2">
              <input
                type="color"
                required
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="h-11 w-20 border border-input rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 border border-input bg-background rounded-lg px-3 py-2 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="#3b82f6"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Icon (emoji)</label>
            <input
              type="text"
              value={formData.icon}
              onChange={e => setFormData({ ...formData, icon: e.target.value })}
              className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="📅"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-input bg-background rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">AI Context (JSON)</label>
            <textarea
              value={formData.context}
              onChange={e => setFormData({ ...formData, context: e.target.value })}
              className="w-full border border-input bg-background rounded-lg px-4 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={6}
              placeholder='{"preferredTime": "morning", "energyLevel": "high"}'
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add context the AI can learn from (e.g., preferred times, energy levels, priorities)
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border-2 border-border bg-background text-foreground rounded-lg font-semibold hover:bg-accent transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              {category ? '💾 Update' : '➕ Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
