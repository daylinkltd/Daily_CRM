'use client';

import React from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { CreateWorkspaceTabs } from '@/components/marketing/create-tabs';

export default function MarketingCreatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create"
        description="Central creation workflow for Social Posts, Blog Articles, Marketing Campaigns, and Content Ideas."
      />
      <CreateWorkspaceTabs />
    </div>
  );
}
