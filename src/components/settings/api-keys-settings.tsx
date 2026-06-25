'use client';

import { KeyRound } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';

/**
 * API Keys placeholder — coming soon.
 * Will allow creating and revoking API keys for programmatic access.
 */
export function ApiKeysSettings() {
  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="API keys"
        description="Create API keys to access the app programmatically from your own tools and scripts."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="size-4 text-primary" />
            API access
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            API key management is coming soon. Check back in the next update.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <KeyRound className="size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            API key management will be available here soon.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
