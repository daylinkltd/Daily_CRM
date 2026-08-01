'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
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

interface DepartmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: any | null;
  onSaved: () => void;
}

export function DepartmentForm({ open, onOpenChange, department, onSaved }: DepartmentFormProps) {
  const supabase = createClient();
  const { activeWorkspace } = useWorkspace();
  
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(department?.name || '');
      setDescription(department?.description || '');
    }
  }, [open, department]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace?.id || !name.trim()) return;

    setSaving(true);
    
    try {
      if (department?.id) {
        // Update
        const { error } = await supabase
          .from('departments')
          .update({ name: name.trim(), description: description.trim() })
          .eq('id', department.id);
          
        if (error) throw error;
        toast.success('Department updated successfully');
      } else {
        // Create
        const { error } = await supabase
          .from('departments')
          .insert({ 
            workspace_id: activeWorkspace.id, 
            name: name.trim(), 
            description: description.trim() 
          });
          
        if (error) throw error;
        toast.success('Department created successfully');
      }
      
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {department ? 'Edit Department' : 'Add Department'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Department Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering, Sales, HR"
              className="bg-card border-border text-foreground"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
            <Textarea plain
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this department..."
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
              {department ? 'Save Changes' : 'Create Department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
