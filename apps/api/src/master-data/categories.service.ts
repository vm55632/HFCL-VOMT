import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@vop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CategoryInput {
  key: string;
  name: string;
  description?: string;
  sortOrder?: number;
  enhancedDueDiligence?: boolean;
  requiredDocuments?: string[];
  requiredValidations?: string[];
  workflowKey: string;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Categories for the intake form (active only) or the full set for admins. */
  list(includeInactive = false) {
    return this.prisma.vendorCategory.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(input: CategoryInput, actorId: string) {
    const exists = await this.prisma.vendorCategory.findUnique({ where: { key: input.key } });
    if (exists) throw new BadRequestException(`Category "${input.key}" already exists.`);
    const created = await this.prisma.vendorCategory.create({
      data: {
        id: newId(),
        key: input.key,
        name: input.name,
        description: input.description ?? '',
        sortOrder: input.sortOrder ?? 100,
        enhancedDueDiligence: input.enhancedDueDiligence ?? false,
        requiredDocuments: input.requiredDocuments ?? [],
        requiredValidations: input.requiredValidations ?? [],
        workflowKey: input.workflowKey,
      },
    });
    await this.audit.append({
      action: 'category.create',
      entityType: 'VendorCategory',
      entityId: created.id,
      actorId,
      detail: { key: input.key },
    });
    return created;
  }

  async update(
    key: string,
    changes: Partial<Omit<CategoryInput, 'key'>> & { active?: boolean },
    actorId: string,
  ) {
    const before = await this.prisma.vendorCategory.findUnique({ where: { key } });
    if (!before) throw new NotFoundException('Category not found.');
    const after = await this.prisma.vendorCategory.update({
      where: { key },
      data: {
        name: changes.name,
        description: changes.description,
        sortOrder: changes.sortOrder,
        enhancedDueDiligence: changes.enhancedDueDiligence,
        requiredDocuments: changes.requiredDocuments,
        requiredValidations: changes.requiredValidations,
        workflowKey: changes.workflowKey,
        active: changes.active,
      },
    });
    await this.audit.append({
      action: 'category.update',
      entityType: 'VendorCategory',
      entityId: after.id,
      actorId,
      detail: { key },
    });
    return after;
  }
}
