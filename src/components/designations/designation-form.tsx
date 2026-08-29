'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { assertAffected } from '@/lib/supabase/affected-rows';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/hooks/use-workspace';
import { RichTextArea } from "@/components/ui/rich-textarea";

interface DesignationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designation?: any | null;
  onSaved: () => void;
}

export function DesignationForm({ open, onOpenChange, designation, onSaved }: DesignationFormProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(designation?.title || '');
      setDescription(designation?.description || '');
    }
  }, [open, designation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim()) return;

    setSaving(true);
    
    try {
      if (designation?.id) {
        // Update
        // .select() so an update that RLS filtered to zero rows is caught
        // rather than reported as a successful save.
        const result = await supabase
          .from('designations')
          .update({ title: name.trim(), description: description.trim() })
          .eq('id', designation.id)
          .select('id');

        assertAffected(result, 'the designation', 'save');
        toast.success('Designation updated successfully');
      } else {
        // Create
        const { error } = await supabase
          .from('designations')
          .insert({ 
            workspace_id: activeWorkspace.id, 
            title: name.trim(), 
            description: description.trim() 
          });
          
        if (error) throw error;
        toast.success('Designation created successfully');
      }
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save designation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {designation ? 'Edit Designation' : 'Add Designation'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Designation Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Developer, Marketing Manager"
              className="bg-card border-border text-foreground"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
            <RichTextArea plain
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this role..."
              className="bg-card border-border text-foreground resize-none"
              rows={3}
            />
          </div>
          <DialogFooter className="pt-4 border-t border-border mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={saving || !name.trim()}
            >
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              {designation ? 'Save Changes' : 'Create Designation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
