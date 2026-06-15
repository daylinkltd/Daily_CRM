'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Loader2,
  Settings2,
  Database,
  FileText,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import type {
  CustomForm,
  CustomFormField,
  FormFieldType,
  FormMappingType,
} from '@/types';

interface CustomFieldDef {
  id: string;
  field_name: string;
  field_type: string;
}

interface PipelineStageDef {
  id: string;
  pipeline_id: string;
  name: string;
}

interface PipelineDef {
  id: string;
  name: string;
  pipeline_stages?: PipelineStageDef[];
}

export default function FormBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { id: formId } = React.use(params);

  // Data State
  const [form, setForm] = React.useState<CustomForm | null>(null);
  const [fields, setFields] = React.useState<Partial<CustomFormField>[]>([]);
  const [submissions, setSubmissions] = React.useState<any[]>([]);
  const [pipelines, setPipelines] = React.useState<PipelineDef[]>([]);
  const [customFields, setCustomFields] = React.useState<CustomFieldDef[]>([]);

  // Loading States
  const [loading, setLoading] = React.useState(true);
  const [savingFields, setSavingFields] = React.useState(false);
  const [savingIntegrations, setSavingIntegrations] = React.useState(false);

  // Navigation / Tabs
  const [activeTab, setActiveTab] = React.useState('builder');

  // Editing State
  const [formTitle, setFormTitle] = React.useState('');
  const [formDesc, setFormDesc] = React.useState('');
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [deletedFieldIds, setDeletedFieldIds] = React.useState<string[]>([]);

  // Integration State
  const [createDealOnSubmit, setCreateDealOnSubmit] = React.useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>('');
  const [selectedStageId, setSelectedStageId] = React.useState<string>('');

  // UI state
  const [copied, setCopied] = React.useState(false);

  // Fetch all page data
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Form
      const { data: formData, error: formErr } = await supabase
        .from('custom_forms')
        .select('*')
        .eq('id', formId)
        .maybeSingle();

      if (formErr) throw formErr;
      if (!formData) {
        toast.error('Form not found');
        router.push('/forms');
        return;
      }

      setForm(formData);
      setFormTitle(formData.title);
      setFormDesc(formData.description || '');
      setCreateDealOnSubmit(!!(formData.pipeline_id && formData.stage_id));
      setSelectedPipelineId(formData.pipeline_id || '');
      setSelectedStageId(formData.stage_id || '');

      // 2. Fetch Fields
      const { data: fieldsData, error: fieldsErr } = await supabase
        .from('custom_form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('position', { ascending: true });

      if (fieldsErr) throw fieldsErr;
      setFields(fieldsData || []);

      // 3. Fetch Pipelines with Stages
      const { data: pipelinesData, error: pipelinesErr } = await supabase
        .from('pipelines')
        .select('*, pipeline_stages(*)');

      if (pipelinesErr) throw pipelinesErr;
      setPipelines(pipelinesData || []);

      // 4. Fetch Custom Field definitions
      const { data: customFieldsData, error: cfErr } = await supabase
        .from('custom_fields')
        .select('id, field_name, field_type')
        .order('field_name');

      if (cfErr) throw cfErr;
      setCustomFields(customFieldsData || []);

      // 5. Fetch Submissions
      const { data: subsData, error: subsErr } = await supabase
        .from('custom_form_submissions')
        .select(`
          id,
          created_at,
          submitted_values,
          contacts (id, name, phone, email),
          deals (id, title, value)
        `)
        .eq('form_id', formId)
        .order('created_at', { ascending: false });

      if (subsErr) throw subsErr;
      setSubmissions(subsData || []);

    } catch (err: any) {
      toast.error(err.message || 'Error fetching form builder data');
    } finally {
      setLoading(false);
    }
  }, [formId, supabase, router]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Field ref
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Add field helper
  const addField = (type: FormFieldType) => {
    const tempId = `temp-${Date.now()}`;
    const newField: Partial<CustomFormField> = {
      id: tempId,
      form_id: formId,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      field_type: type,
      is_required: false,
      placeholder: '',
      mapping_type: 'none',
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
      position: fields.length,
    };

    setFields([...fields, newField]);
    setSelectedFieldId(tempId);
  };

  // Delete field helper
  const removeField = (id: string) => {
    if (!id.startsWith('temp-')) {
      setDeletedFieldIds([...deletedFieldIds, id]);
    }
    setFields(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  // Reordering helpers
  const moveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    // Swap positions
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    setFields(updated);
  };

  // Field change updates
  const updateSelectedField = (updates: Partial<CustomFormField>) => {
    if (!selectedFieldId) return;
    setFields(
      fields.map((f) => (f.id === selectedFieldId ? { ...f, ...updates } : f))
    );
  };

  // Batch Save Form & Fields
  const saveFormAndFields = async () => {
    if (!formTitle.trim()) {
      toast.error('Form title is required');
      return;
    }

    setSavingFields(true);
    try {
      // 1. Update form metadata
      const { error: formErr } = await supabase
        .from('custom_forms')
        .update({
          title: formTitle.trim(),
          description: formDesc.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', formId);

      if (formErr) throw formErr;

      // 2. Delete removed fields
      if (deletedFieldIds.length > 0) {
        const { error: delErr } = await supabase
          .from('custom_form_fields')
          .delete()
          .in('id', deletedFieldIds);

        if (delErr) throw delErr;
        setDeletedFieldIds([]);
      }

      // 3. Upsert current fields
      const existingFieldsPayload: any[] = [];
      const newFieldsPayload: any[] = [];

      fields.forEach((f, index) => {
        const payload: any = {
          form_id: formId,
          label: f.label?.trim() || 'Field Label',
          field_type: f.field_type,
          placeholder: f.placeholder?.trim() || null,
          is_required: !!f.is_required,
          options: f.options || null,
          mapping_type: f.mapping_type || 'none',
          mapping_key: f.mapping_key || null,
          position: index,
        };

        if (f.id && !f.id.startsWith('temp-')) {
          payload.id = f.id;
          existingFieldsPayload.push(payload);
        } else {
          newFieldsPayload.push(payload);
        }
      });

      let savedExisting: any[] = [];
      let savedNew: any[] = [];

      if (existingFieldsPayload.length > 0) {
        const { data: upserted, error: fieldsErr } = await supabase
          .from('custom_form_fields')
          .upsert(existingFieldsPayload)
          .select();

        if (fieldsErr) throw fieldsErr;
        savedExisting = upserted || [];
      }

      if (newFieldsPayload.length > 0) {
        const { data: inserted, error: fieldsErr } = await supabase
          .from('custom_form_fields')
          .insert(newFieldsPayload)
          .select();

        if (fieldsErr) throw fieldsErr;
        savedNew = inserted || [];
      }

      const savedFields = [...savedExisting, ...savedNew].sort((a, b) => a.position - b.position);

      setFields(savedFields);
      // Reset selected field to the DB ID if it was temporary
      if (selectedFieldId && selectedFieldId.startsWith('temp-')) {
        const tempIndex = fields.findIndex((f) => f.id === selectedFieldId);
        if (tempIndex !== -1 && savedFields[tempIndex]) {
          setSelectedFieldId(savedFields[tempIndex].id);
        }
      }

      toast.success('Form changes saved successfully');
      setForm((prev: any) => ({ ...prev, title: formTitle.trim(), description: formDesc.trim() }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save form fields');
    } finally {
      setSavingFields(false);
    }
  };

  // Save integration deal rules
  const saveIntegrations = async () => {
    setSavingIntegrations(true);
    try {
      const pipelineId = createDealOnSubmit && selectedPipelineId ? selectedPipelineId : null;
      const stageId = createDealOnSubmit && selectedStageId ? selectedStageId : null;

      const { error } = await supabase
        .from('custom_forms')
        .update({
          pipeline_id: pipelineId,
          stage_id: stageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', formId);

      if (error) throw error;

      toast.success('Integration settings saved successfully');
      setForm((prev: any) => ({ ...prev, pipeline_id: pipelineId, stage_id: stageId }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save integrations');
    } finally {
      setSavingIntegrations(false);
    }
  };

  const copyShareLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareLink = `${origin}/forms/shared/${formId}`;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success('Public form link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // Active stages list based on pipeline selection
  const activeStages =
    pipelines.find((p) => p.id === selectedPipelineId)?.pipeline_stages || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="size-8 animate-spin text-[#00aef0]" />
        <p className="text-sm text-slate-400">Loading form builder...</p>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/forms')}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white line-clamp-1">
                {form.title}
              </h1>
              <span
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                  form.is_active
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Form ID: {form.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={copyShareLink}
            className="border-slate-800 hover:bg-slate-800 text-slate-300"
          >
            {copied ? <Check className="size-4 mr-2 text-emerald-400" /> : <Copy className="size-4 mr-2" />}
            Copy Public Link
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              window.open(`${origin}/forms/shared/${form.id}`, '_blank');
            }}
            className="text-slate-300 hover:text-white"
          >
            <ExternalLink className="size-4 mr-1.5" />
            View Form
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="builder" className="data-[state=active]:bg-[#00aef0] data-[state=active]:text-white text-slate-400">
            Form Builder
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-[#00aef0] data-[state=active]:text-white text-slate-400">
            Pipelines Integration
          </TabsTrigger>
          <TabsTrigger value="responses" className="data-[state=active]:bg-[#00aef0] data-[state=active]:text-white text-slate-400">
            Responses ({submissions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Builder */}
        <TabsContent value="builder" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Canvas Panel */}
            <div className="lg:col-span-2 space-y-4">
              {/* Form Metadata */}
              <Card className="bg-slate-900/60 border-slate-800 text-slate-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-white">Form Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="form-meta-title" className="text-slate-400">Form Title</Label>
                    <Input
                      id="form-meta-title"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Lead Contact Sheet"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="form-meta-desc" className="text-slate-400">Description / Instructions</Label>
                    <Textarea
                      id="form-meta-desc"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="Enter the form description or welcome message shown to leads..."
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[70px]"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Dynamic Field Canvas List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-300">Form Fields Structure</h3>
                  <span className="text-xs text-slate-500">{fields.length} fields configured</span>
                </div>

                {fields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center bg-slate-900/20">
                    <p className="text-sm text-slate-500 italic">No fields configured. Click below to add your first question.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {fields.map((field, idx) => {
                      const isSelected = field.id === selectedFieldId;
                      let mappingBadge = 'No CRM Sync';
                      if (field.field_type === 'file') {
                        mappingBadge = 'Auto Deal File Sync';
                      } else if (field.mapping_type === 'contact_field') {
                        mappingBadge = `Contact ➔ ${field.mapping_key}`;
                      } else if (field.mapping_type === 'contact_custom_field') {
                        const matchedCf = customFields.find((cf) => cf.id === field.mapping_key);
                        mappingBadge = `Custom Field ➔ ${matchedCf?.field_name || 'unknown'}`;
                      } else if (field.mapping_type === 'deal_field') {
                        mappingBadge = `Deal ➔ ${field.mapping_key}`;
                      }

                      return (
                        <div
                          key={field.id}
                          onClick={() => setSelectedFieldId(field.id || null)}
                          className={`group flex items-center justify-between border rounded-lg p-3.5 bg-slate-900/40 hover:bg-slate-900/70 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#00aef0] bg-slate-900/80 ring-1 ring-[#00aef0]/20'
                              : 'border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Position Ordering Arrows */}
                            <div className="flex flex-col gap-0.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveField(idx, 'up');
                                }}
                                disabled={idx === 0}
                                className="text-slate-400 hover:text-white disabled:text-slate-700"
                              >
                                <ChevronUp className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveField(idx, 'down');
                                }}
                                disabled={idx === fields.length - 1}
                                className="text-slate-400 hover:text-white disabled:text-slate-700"
                              >
                                <ChevronDown className="size-4" />
                              </button>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-white">
                                  {field.label || <span className="italic text-slate-500">Untitled Field</span>}
                                </span>
                                {field.is_required && (
                                  <span className="text-xs text-red-400 font-semibold">* Required</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 font-semibold bg-slate-800 rounded text-slate-300 uppercase">
                                  {field.field_type}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 font-semibold bg-slate-800 rounded text-slate-400 flex items-center gap-1">
                                  <Database className="size-2.5" />
                                  {mappingBadge}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id!);
                            }}
                            className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Fields Quick Actions */}
                <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/40">
                  <span className="text-xs text-slate-400 block mb-2.5 font-semibold uppercase">Add Form Element</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: 'text', label: 'Single Line Text' },
                      { type: 'textarea', label: 'Paragraph Area' },
                      { type: 'email', label: 'Email Field' },
                      { type: 'phone', label: 'Phone Number' },
                      { type: 'number', label: 'Number Input' },
                      { type: 'select', label: 'Select Dropdown' },
                      { type: 'checkbox', label: 'Checkbox' },
                      { type: 'file', label: 'File/Document Upload' },
                    ].map((item) => (
                      <Button
                        key={item.type}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addField(item.type as FormFieldType)}
                        className="bg-slate-900 border-slate-800 hover:bg-slate-800 text-xs text-slate-300"
                      >
                        <Plus className="size-3.5 mr-1" />
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Settings Configuration Panel */}
            <div className="space-y-4">
              <Card className="bg-slate-900 border-slate-800 text-slate-300 sticky top-4">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                    <Settings2 className="size-4 text-[#00aef0]" />
                    Field Mapping Settings
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Configure validation and map form questions directly to CRM fields.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedField ? (
                    <div className="text-center py-10">
                      <p className="text-xs text-slate-500 italic">Select a field on the canvas to edit its details and mapping settings.</p>
                    </div>
                  ) : (
                    <>
                      {/* Label */}
                      <div className="space-y-1.5">
                        <Label htmlFor="field-label" className="text-slate-400 text-xs">Field Label</Label>
                        <Input
                          id="field-label"
                          value={selectedField.label || ''}
                          onChange={(e) => updateSelectedField({ label: e.target.value })}
                          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm"
                        />
                      </div>

                      {/* Placeholder */}
                      {selectedField.field_type !== 'checkbox' && selectedField.field_type !== 'file' && (
                        <div className="space-y-1.5">
                          <Label htmlFor="field-placeholder" className="text-slate-400 text-xs">Placeholder Text</Label>
                          <Input
                            id="field-placeholder"
                            value={selectedField.placeholder || ''}
                            onChange={(e) => updateSelectedField({ placeholder: e.target.value })}
                            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm"
                          />
                        </div>
                      )}

                      {/* Select Options */}
                      {selectedField.field_type === 'select' && (
                        <div className="space-y-1.5">
                          <Label htmlFor="field-options" className="text-slate-400 text-xs">Dropdown Options</Label>
                          <Input
                            id="field-options"
                            value={selectedField.options ? selectedField.options.join(', ') : ''}
                            onChange={(e) =>
                              updateSelectedField({
                                options: e.target.value
                                  .split(',')
                                  .map((opt) => opt.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="Option A, Option B, Option C"
                            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-sm"
                          />
                          <p className="text-[10px] text-slate-500 italic">Separate options with commas.</p>
                        </div>
                      )}

                      {/* Required Toggle */}
                      <div className="flex items-center justify-between border-y border-slate-800 py-3 mt-2">
                        <Label htmlFor="field-req" className="text-slate-300 text-xs font-semibold uppercase">Is Field Required?</Label>
                        <Switch
                          id="field-req"
                          checked={!!selectedField.is_required}
                          onCheckedChange={(checked) => updateSelectedField({ is_required: checked })}
                          className="data-checked:bg-[#00aef0] data-unchecked:bg-slate-800"
                        />
                      </div>

                      {/* CRM Mapping Type */}
                      {selectedField.field_type === 'file' ? (
                        <div className="rounded-md bg-slate-950/40 border border-slate-800 p-3 mt-2 space-y-1">
                          <p className="text-xs text-[#00aef0] font-medium">Auto Deal File Sync</p>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Uploaded documents are automatically saved to your CRM file vault and linked to the generated pipeline deal.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label htmlFor="mapping-type" className="text-slate-400 text-xs">Map response values to</Label>
                          <Select
                            value={selectedField.mapping_type || 'none'}
                            onValueChange={(val) =>
                              updateSelectedField({
                                mapping_type: (val || 'none') as FormMappingType,
                                mapping_key: undefined,
                              })
                            }
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-xs">
                              <SelectValue placeholder="No mapping" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-slate-300 text-xs">
                              <SelectItem value="none">Do not map (Save raw answer only)</SelectItem>
                              <SelectItem value="contact_field">Contact (Standard Attribute)</SelectItem>
                              <SelectItem value="contact_custom_field">Contact (Custom Field)</SelectItem>
                              <SelectItem value="deal_field">Pipeline Deal Property</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* CRM Mapping Key */}
                      {selectedField.field_type !== 'file' && selectedField.mapping_type === 'contact_field' && (
                        <div className="space-y-1.5">
                          <Label htmlFor="mapping-key-contact" className="text-slate-400 text-xs">Select Contact Field</Label>
                          <Select
                            value={selectedField.mapping_key || ''}
                            onValueChange={(val) => updateSelectedField({ mapping_key: val || undefined })}
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-xs">
                              <SelectValue placeholder="Choose attribute" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-slate-300 text-xs">
                              <SelectItem value="name">Full Name</SelectItem>
                              <SelectItem value="phone">Phone Number (For Deduplication)</SelectItem>
                              <SelectItem value="email">Email Address</SelectItem>
                              <SelectItem value="company">Company Name</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedField.field_type !== 'file' && selectedField.mapping_type === 'contact_custom_field' && (
                        <div className="space-y-1.5">
                          <Label htmlFor="mapping-key-custom" className="text-slate-400 text-xs">Select Custom Field</Label>
                          {customFields.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic">No custom fields created in your CRM contacts.</p>
                          ) : (
                            <Select
                              key={`cf-${selectedField.mapping_key}-${customFields.length}`}
                              value={selectedField.mapping_key || ''}
                              onValueChange={(val) => updateSelectedField({ mapping_key: val || undefined })}
                            >
                              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-xs">
                                <SelectValue placeholder="Choose custom field" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700 text-slate-300 text-xs">
                                {customFields.map((cf) => (
                                  <SelectItem key={cf.id} value={cf.id}>
                                    {cf.field_name} ({cf.field_type})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {selectedField.field_type !== 'file' && selectedField.mapping_type === 'deal_field' && (
                        <div className="space-y-1.5">
                          <Label htmlFor="mapping-key-deal" className="text-slate-400 text-xs">Select Deal Field</Label>
                          <Select
                            value={selectedField.mapping_key || ''}
                            onValueChange={(val) => updateSelectedField({ mapping_key: val || undefined })}
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-xs">
                              <SelectValue placeholder="Choose deal attribute" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-slate-300 text-xs">
                              <SelectItem value="title">Deal Title</SelectItem>
                              <SelectItem value="value">Deal Value (Financial)</SelectItem>
                              <SelectItem value="notes">Deal Description / Notes</SelectItem>
                              <SelectItem value="expected_close_date">Expected Close Date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
                {selectedField && (
                  <CardFooter className="border-t border-slate-800 pt-3 flex justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFieldId(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      Deselect
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeField(selectedFieldId!)}
                      className="bg-red-950/20 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-xs"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Remove Field
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>

          {/* Floating Save button */}
          <div className="flex justify-end mt-6">
            <Button
              onClick={saveFormAndFields}
              disabled={savingFields}
              className="bg-[#00aef0] hover:bg-[#009bd6] text-white"
            >
              {savingFields ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Form & Canvas
            </Button>
          </div>
        </TabsContent>

        {/* Tab 2: Integrations */}
        <TabsContent value="integrations" className="focus-visible:outline-none">
          <Card className="bg-slate-900 border-slate-800 text-slate-300 max-w-xl">
            <CardHeader>
              <CardTitle className="text-white">Pipeline Automation Settings</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Automatically generate deals for incoming form responses and route them to specific pipelines and stages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggle automation */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <Label htmlFor="auto-deal" className="text-white font-medium">Create a Pipeline Deal</Label>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate an open deal linked to the contact card upon form submission.
                  </p>
                </div>
                <Switch
                  id="auto-deal"
                  checked={createDealOnSubmit}
                  onCheckedChange={setCreateDealOnSubmit}
                  className="data-checked:bg-[#00aef0] data-unchecked:bg-slate-800"
                />
              </div>

              {createDealOnSubmit && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Select Pipeline */}
                  <div className="space-y-1.5">
                    <Label htmlFor="target-pipeline" className="text-slate-400">Target Pipeline</Label>
                    {pipelines.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No pipelines created yet. Go to Pipelines to build one.</p>
                    ) : (
                      <Select
                        key={`pipeline-${selectedPipelineId}-${pipelines.length}`}
                        value={selectedPipelineId}
                        onValueChange={(val) => {
                          setSelectedPipelineId(val || '');
                          setSelectedStageId('');
                        }}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder="Select a pipeline..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-slate-300">
                          {pipelines.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Select Pipeline Stage */}
                  <div className="space-y-1.5">
                    <Label htmlFor="target-stage" className="text-slate-400">Target Stage</Label>
                    <Select
                      key={`stage-${selectedStageId}-${activeStages.length}`}
                      value={selectedStageId}
                      onValueChange={(val) => setSelectedStageId(val || '')}
                      disabled={!selectedPipelineId}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white disabled:opacity-50">
                        <SelectValue placeholder={selectedPipelineId ? "Choose pipeline stage..." : "Choose pipeline first..."} />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-300">
                        {activeStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-slate-800 pt-4 flex justify-end">
              <Button
                onClick={saveIntegrations}
                disabled={savingIntegrations || (createDealOnSubmit && (!selectedPipelineId || !selectedStageId))}
                className="bg-[#00aef0] hover:bg-[#009bd6] text-white"
              >
                {savingIntegrations ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Save Integration Rules
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Tab 3: Responses */}
        <TabsContent value="responses" className="focus-visible:outline-none">
          <Card className="bg-slate-900 border-slate-800 text-slate-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-white">Submission History</CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                Complete log of responses filled out by leads, cross-referenced with your CRM entities.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {submissions.length === 0 ? (
                <div className="text-center py-20">
                  <FileText className="size-12 mx-auto text-slate-600 mb-3" />
                  <h3 className="text-md font-semibold text-white">No submissions yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Share the public form link. When leads fill it out, their details and answers will appear here.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400">
                      <th className="p-4 font-semibold">Submission Date</th>
                      <th className="p-4 font-semibold">Linked Contact</th>
                      <th className="p-4 font-semibold">Linked Deal</th>
                      {fields.map((field) => (
                        <th key={field.id} className="p-4 font-semibold">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="border-b border-slate-800/80 hover:bg-slate-950/20">
                        <td className="p-4 text-slate-400 whitespace-nowrap">
                          {new Date(sub.created_at).toLocaleString()}
                        </td>
                        <td className="p-4 font-medium text-white whitespace-nowrap">
                          {sub.contacts ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/contacts?id=${sub.contacts.id}`)}
                              className="text-[#00aef0] hover:underline"
                            >
                              {sub.contacts.name || sub.contacts.phone}
                            </button>
                          ) : (
                            <span className="text-slate-500 italic">Deleted contact</span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {sub.deals ? (
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {sub.deals.title}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">—</span>
                          )}
                        </td>
                        {fields.map((field) => {
                          const val = sub.submitted_values[field.id!] !== undefined
                            ? sub.submitted_values[field.id!]
                            : sub.submitted_values[field.label!];

                          const displayVal = Array.isArray(val)
                            ? val.join(', ')
                            : typeof val === 'boolean'
                              ? (val ? 'Yes' : 'No')
                              : val;

                          return (
                            <td key={field.id} className="p-4 text-slate-300 max-w-[200px] truncate">
                              {displayVal !== undefined && displayVal !== null && displayVal !== '' ? (
                                String(displayVal)
                              ) : (
                                <span className="text-slate-600 italic">empty</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
