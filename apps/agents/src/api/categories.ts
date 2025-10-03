import { Request, Response } from 'express';
import categoryService from '../services/CategoryService.js';

export async function getUserCategories(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, type } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching categories for user:', user_id);

    let categories = await categoryService.getCategories(user_id, type);

    // Auto-create default categories if user has none
    if (categories.length === 0) {
      console.log('No categories found for user, creating defaults...');
      await categoryService.createDefaultCategories(user_id);
      categories = await categoryService.getCategories(user_id, type);
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

    console.log('Creating category for user:', user_id);

    const category = await categoryService.createCategory(user_id, {
      name: categoryData.name,
      color: categoryData.color,
      icon: categoryData.icon,
      description: categoryData.description,
      context: categoryData.context,
      applies_to: categoryData.applies_to
    });

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

    console.log('Updating category:', category_id, 'for user:', user_id);

    const category = await categoryService.updateCategory(user_id, category_id, {
      name: updates.name,
      color: updates.color,
      icon: updates.icon,
      description: updates.description,
      context: updates.context,
      applies_to: updates.applies_to
    });

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
