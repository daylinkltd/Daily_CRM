'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function SheetsConfig() {
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Leads');

  async function handleConnect() {
    // In a real app, this would trigger Google OAuth flow
    toast.success('OAuth flow would launch here');
    setTimeout(() => {
      setConnectionStatus('connected');
    }, 1000);
  }

  async function handleSave() {
    if (!spreadsheetId.trim() || !sheetName.trim()) {
      toast.error('Spreadsheet ID and Sheet Name are required');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      toast.success('Google Sheets Configuration saved');
      setSaving(false);
    }, 1000);
  }

  async function handleSync() {
    setSyncing(true);
    setTimeout(() => {
      toast.success('Successfully synced data with Google Sheets');
      setSyncing(false);
    }, 1500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] mt-4">
      <div className="space-y-6">
        <Alert className="bg-slate-900 border-slate-700">
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? <CheckCircle2 className="size-4 text-[#00aef0]" /> : <XCircle className="size-4 text-red-500" />}
            <AlertTitle className="text-white mb-0">{connectionStatus === 'connected' ? 'Google Account Connected' : 'Not Connected'}</AlertTitle>
          </div>
          <AlertDescription className="text-slate-400">
            {connectionStatus === 'connected' ? 'Your Google Workspace account is successfully linked.' : 'Authenticate with Google to enable 2-way sync.'}
          </AlertDescription>
          {connectionStatus === 'disconnected' && (
            <Button onClick={handleConnect} className="mt-4 bg-white text-black hover:bg-slate-200">
              Sign in with Google
            </Button>
          )}
        </Alert>

        {connectionStatus === 'connected' && (
          <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
            <CardHeader>
              <CardTitle className="text-white">Sync Configuration</CardTitle>
              <CardDescription className="text-slate-400">Map your Daily CRM data to a specific spreadsheet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Spreadsheet ID</Label>
                <Input value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)} placeholder="1BxiMVs0XRY..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
                <p className="text-xs text-slate-500">The long string of characters in your Google Sheets URL.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Target Sheet / Tab Name</Label>
                <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Sheet1" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button onClick={handleSave} disabled={saving} className="bg-[#00aef0] hover:bg-[#00aef0]/90 text-white">
                  {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Saving...</> : 'Save Sync Settings'}
                </Button>
                <Button variant="outline" onClick={handleSync} disabled={syncing} className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
                  {syncing ? <><RefreshCw className="mr-2 size-4 animate-spin" /> Syncing...</> : 'Force Manual Sync'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <div>
        <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
          <CardHeader>
            <CardTitle className="text-white text-base">2-Way Sync Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-slate-400">
              <li>Changes in CRM Contacts are pushed to the Sheet instantly.</li>
              <li>Row updates in the Sheet are synced back to CRM every 15 minutes.</li>
              <li>Deleting a row in Sheets will NOT delete the Contact in CRM (Safety check).</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
