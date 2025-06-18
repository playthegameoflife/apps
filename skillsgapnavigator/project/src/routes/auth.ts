import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { supabase } from '../config';
import { AppError } from '../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw new AppError(400, error.message);

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: {
          userId: data.user?.id,
          email: data.user?.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw new AppError(401, 'Invalid credentials');

      const token = jwt.sign(
        {
          userId: data.user.id,
          email: data.user.email,
        },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn as jwt.SignOptions['expiresIn'] }
      );

      res.json({
        status: 'success',
        data: {
          token,
          user: {
            id: data.user.id,
            email: data.user.email,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export const authRouter = router; 