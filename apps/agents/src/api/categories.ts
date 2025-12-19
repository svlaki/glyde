import { Request, Response } from 'express';
import categoryService from '../services/CategoryService.js';

export async function getUserCategories(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching categories for user:', userId);

    const categories = await categoryService.getCategories(userId);

    // Categories are created during onboarding
    // If user has no categories, they haven't completed onboarding yet
    // or their onboarding was done before category creation was added
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
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { user_id: _ignoredUserId, ...categoryData } = req.body ?? {};

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

    console.log('Creating category for user:', userId);

    const category = await categoryService.createCategory(userId, {
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
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { category_id, ...updates } = req.body ?? {};

    if (!category_id) {
      res.status(400).json({ error: 'category_id is required' });
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

    console.log('Updating category:', category_id, 'for user:', userId);

    const category = await categoryService.updateCategory(userId, category_id, {
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
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { category_id } = req.body ?? {};

    if (!category_id) {
      res.status(400).json({ error: 'category_id is required' });
      return;
    }

    console.log('Deleting category:', category_id, 'for user:', userId);

    await categoryService.deleteCategory(userId, category_id);

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
    const userId = req.body.user_id;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    const { category_name } = req.body ?? {};

    if (!category_name) {
      res.status(400).json({ error: 'category_name is required' });
      return;
    }

    const color = await categoryService.getCategoryColor(userId, category_name);

    res.json({
      success: true,
      color: color
    });

  } catch (error) {
    console.error('Error fetching category color:', error);
    res.status(500).json({ error: 'Failed to fetch category color' });
  }
}
