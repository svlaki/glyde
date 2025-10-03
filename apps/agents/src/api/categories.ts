import { Request, Response } from 'express';
import categoryService from '../services/CategoryService.js';

export async function getUserCategories(req: Request, res: Response): Promise<void> {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching categories for user:', user_id);

    let categories = await categoryService.getCategories(user_id);

    // Auto-create default categories if user has none
    if (categories.length === 0) {
      console.log('No categories found for user, creating defaults...');
      await categoryService.createDefaultCategories(user_id);
      categories = await categoryService.getCategories(user_id);
    }

    res.json({
      success: true,
      categories: categories
    });

  } catch (error) {
    console.error('Error fetching user categories:', error);
    res.status(500).json({ error: 'Failed to fetch user categories' });
  }
}

export async function createUserCategory(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, ...categoryData } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    if (!categoryData.name || !categoryData.color) {
      res.status(400).json({ error: 'name and color are required' });
      return;
    }

    // Validate category data
    if (typeof categoryData.name !== 'string' || categoryData.name.trim().length === 0) {
      res.status(400).json({ error: 'Category name must be a non-empty string' });
      return;
    }

    if (typeof categoryData.color !== 'string' || !categoryData.color.match(/^#[0-9A-Fa-f]{6}$/)) {
      res.status(400).json({ error: 'Color must be a valid hex color (e.g., #3b82f6)' });
      return;
    }

    console.log('Creating category for user:', user_id);

    const category = await categoryService.createCategory(user_id, {
      name: categoryData.name.trim(),
      color: categoryData.color.trim(),
      icon: categoryData.icon?.trim(),
      description: categoryData.description?.trim(),
      context: categoryData.context || {}
    });

    if (!category) {
      res.status(500).json({ error: 'Failed to create category - service returned null' });
      return;
    }

    res.json({
      success: true,
      category: category
    });

  } catch (error) {
    console.error('Error creating user category:', error);
    res.status(500).json({ error: 'Failed to create user category' });
  }
}

export async function updateUserCategory(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, category_id, ...updates } = req.body;

    if (!user_id || !category_id) {
      res.status(400).json({ error: 'user_id and category_id are required' });
      return;
    }

    // Validate updates
    if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim().length === 0)) {
      res.status(400).json({ error: 'Category name must be a non-empty string' });
      return;
    }

    if (updates.color !== undefined && (typeof updates.color !== 'string' || !updates.color.match(/^#[0-9A-Fa-f]{6}$/))) {
      res.status(400).json({ error: 'Color must be a valid hex color (e.g., #3b82f6)' });
      return;
    }

    console.log('Updating category:', category_id, 'for user:', user_id);

    const category = await categoryService.updateCategory(user_id, category_id, {
      name: updates.name?.trim(),
      color: updates.color?.trim(),
      icon: updates.icon?.trim(),
      description: updates.description?.trim(),
      context: updates.context
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found or failed to update' });
      return;
    }

    res.json({
      success: true,
      category: category
    });

  } catch (error) {
    console.error('Error updating user category:', error);
    res.status(500).json({ error: 'Failed to update user category' });
  }
}

export async function deleteUserCategory(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, category_id } = req.body;

    if (!user_id || !category_id) {
      res.status(400).json({ error: 'user_id and category_id are required' });
      return;
    }

    console.log('Deleting category:', category_id, 'for user:', user_id);

    await categoryService.deleteCategory(user_id, category_id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user category:', error);
    res.status(500).json({ error: 'Failed to delete user category' });
  }
}

export async function getCategoryColor(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, category_name } = req.body;

    if (!user_id || !category_name) {
      res.status(400).json({ error: 'user_id and category_name are required' });
      return;
    }

    const color = await categoryService.getCategoryColor(user_id, category_name);

    res.json({
      success: true,
      color: color
    });

  } catch (error) {
    console.error('Error fetching category color:', error);
    res.status(500).json({ error: 'Failed to fetch category color' });
  }
}
