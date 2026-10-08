import { z } from 'zod';
const num = z.number().finite().nonnegative();
const url = z.string().url().refine(s => /^https?:\/\//i.test(s));
export const importSchema = z.array(z.object({
  source: z.string().min(1).max(80), title: z.string().max(500).optional(),
  url: url.optional(), vin: z.string().max(30).optional(), id: z.string().max(200).optional(),
  year: num.int().max(2030).optional(), make: z.string().max(80).optional(), model: z.string().max(100).optional(),
  price: num.optional(), mileage: num.int().optional(), location: z.string().max(300).optional(),
  dealerName: z.string().max(300).optional(), dealerType: z.enum(['dealer','private']).optional(),
  titleStatus: z.string().max(100).optional(), description: z.string().max(20000).optional(),
  ownerCount: num.int().optional(), dealerRating: num.max(5).optional(), distanceMiles: num.optional(),
  searchZip: z.string().regex(/^\d{5}$/).optional(), listedAt: z.string().datetime().optional(),
  mandatoryFeesCents: num.int().optional(), oneOwner: z.boolean().optional(), noAccidents: z.boolean().optional(), personalUse: z.boolean().optional(),
  salvage: z.boolean().optional(), rebuilt: z.boolean().optional(), lemon: z.boolean().optional(), flood: z.boolean().optional(),
  frameDamage: z.boolean().optional(), structuralDamage: z.boolean().optional(),
}).refine(r => r.url || r.vin || r.id, 'Each listing needs URL, VIN or id')).min(1).max(500);
