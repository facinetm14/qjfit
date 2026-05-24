import { Router } from 'express';
import { z } from 'zod';
import type { GetProfileService } from '../../core/services/get-profile.service.js';
import type { UpsertProfileService } from '../../core/services/upsert-profile.service.js';

const upsertProfileSchema = z.object({
  targetRole: z.string().min(1),
  targetCompanyIndustry: z.array(z.string()),
  techStack: z.array(z.string()),
  seniorityMin: z.number().int().min(0),
  seniorityMax: z.number().int().min(0),
  location: z.string().min(1),
  excludedKeywords: z.array(z.string()),
  contractTypes: z.array(z.enum(['CDI', 'CDD', 'Freelance', 'Internship', 'Apprenticeship', 'Other'])),
  salaryMin: z.number().int().positive().nullable(),
  bio: z.string().nullable(),
  availability: z.string().datetime().nullable()
});

interface ProfileRouteDeps {
  getProfileService: GetProfileService;
  upsertProfileService: UpsertProfileService;
}

export function createProfileRouter(deps: ProfileRouteDeps): Router {
  const router = Router();

  router.get('/profile', async (_req, res, next) => {
    try {
      const profile = await deps.getProfileService.execute();
      res.status(200).json({ data: profile });
    } catch (error) {
      next(error);
    }
  });

  router.put('/profile', async (req, res, next) => {
    try {
      const parsed = upsertProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid profile payload' });
        return;
      }

      const result = await deps.upsertProfileService.execute({
        ...parsed.data,
        availability: parsed.data.availability ? new Date(parsed.data.availability) : null
      });

      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
