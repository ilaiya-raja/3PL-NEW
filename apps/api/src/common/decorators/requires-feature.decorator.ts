import { SetMetadata } from '@nestjs/common';
import type { LicenseFeature } from '@wms/types';

export const REQUIRES_FEATURE_KEY = 'requiresFeature';

export const RequiresFeature = (
  feature: LicenseFeature,
): ReturnType<typeof SetMetadata> => SetMetadata(REQUIRES_FEATURE_KEY, feature);
