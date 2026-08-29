'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle, Upload, File, X } from 'lucide-react';
import type { CustomForm, CustomFormField } from '@/types';
import { NativeSelect } from "@/components/ui/native-select";

interface SharedFormClientProps {
  form: CustomForm;
  fields: CustomFormField[];
}

export default function SharedFormClient({ form, fields }: SharedFormClientProps) {
  // Form values state mapping { [fieldId]: value }
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (fieldId: string, val: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
    // Clear error on change
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleFileChange = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleInputChange(fieldId, {
        name: file.name,
        type: file.type,
        size: file.size,
        base64: base64,
      });
    };
    reader.onerror = () => {
      toast.error('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (fieldId: string) => {
    handleInputChange(fieldId, undefined);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const val = values[field.id];
      let isPresent = val !== undefined && val !== null;
      if (isPresent) {
        if (typeof val === 'object' && !Array.isArray(val)) {
          isPresent = !!val.base64;
        } else {
          isPresent = String(val).trim() !== '';
        }
      }

      // 1. Required Check
      if (field.is_required && !isPresent) {
        newErrors[field.id] = `${field.label} is required`;
        return;
      }

      if (isPresent && typeof val === 'string') {
        // 2. Email format validation
        if (field.field_type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val.trim())) {
            newErrors[field.id] = 'Please enter a valid email address';
          }
        }

        // 3. Phone format validation
        if (field.field_type === 'phone') {
          const phoneRegex = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/;
          if (!phoneRegex.test(val.trim()) || val.trim().replace(/\D/g, '').length < 6) {
            newErrors[field.id] = 'Please enter a valid phone number';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix validation errors before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submitted_values: values,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit form');
      }

      setSubmitted(true);
      toast.success('Form submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error submitting response');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glow meshes */}
        <div className="absolute top-1/4 left-1/4 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-80 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative max-w-md w-full rounded-2xl border border-border bg-muted/60 backdrop-blur-md p-8 text-center shadow-2xl space-y-5 animate-scaleUp">
          <div className="relative size-16 mx-auto flex items-center justify-center">
            {/* Pulsing ring background */}
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <CheckCircle2 className="relative size-14 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white tracking-tight">Response Submitted</h2>
            <p className="text-sm text-muted-foreground">
              Thank you! Your information has been received and logged in our CRM. A representative will contact you shortly.
            </p>
          </div>

          <div className="pt-3">
            <Button
              onClick={() => {
                setValues({});
                setSubmitted(false);
                setErrors({});
              }}
              className="w-full bg-primary hover:bg-primary-hover text-white"
            >
              Submit Another Response
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 relative overflow-hidden py-12">
      {/* Background radial overlays */}
      <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />

      <div className="relative max-w-xl w-full rounded-2xl border border-border/80 bg-muted/50 backdrop-blur-md p-7 sm:p-10 shadow-2xl space-y-6">
        {/* Form Title & description */}
        <div className="border-b border-border/80 pb-5 space-y-2">
          <h1 className="text-lg sm:text-lg font-semibold text-white tracking-tight">
            {form.title}
          </h1>
          {form.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {form.description}
            </p>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((field) => {
            const hasError = !!errors[field.id];

            return (
              <div key={field.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.id} className="text-foreground text-sm font-medium">
                    {field.label}
                    {field.is_required && <span className="text-red-400 ml-1 font-bold">*</span>}
                  </Label>
                </div>

                {/* Text Field Rendering */}
                {(field.field_type === 'text' ||
                  field.field_type === 'email' ||
                  field.field_type === 'phone' ||
                  field.field_type === 'number') && (
                  <Input
                    id={field.id}
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    value={values[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className={`bg-muted/40 border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 h-10 transition-all ${
                      hasError ? 'border-red-500/70 focus:border-red-500' : 'border-border'
                    }`}
                  />
                )}

                {/* Textarea Field Rendering */}
                {field.field_type === 'textarea' && (
                  <Textarea plain
                    id={field.id}
                    value={values[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className={`bg-muted/40 border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 min-h-[90px] transition-all ${
                      hasError ? 'border-red-500/70 focus:border-red-500' : 'border-border'
                    }`}
                  />
                )}

                {/* Select Dropdown Rendering */}
                {field.field_type === 'select' && (
                  <NativeSelect
                    id={field.id}
                    value={values[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    className={`w-full bg-muted/50 border text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-md h-10 px-3 transition-all outline-none ${
                      hasError ? 'border-red-500/70' : 'border-border'
                    }`}
                  >
                    <option value="" className="bg-muted text-muted-foreground">
                      Select option...
                    </option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt} className="bg-muted text-foreground">
                        {opt}
                      </option>
                    ))}
                  </NativeSelect>
                )}

                {/* Checkbox Rendering */}
                {field.field_type === 'checkbox' && (
                  <div className="flex items-center space-x-2.5 py-1.5">
                    <input
                      id={field.id}
                      type="checkbox"
                      checked={!!values[field.id]}
                      onChange={(e) => handleInputChange(field.id, e.target.checked)}
                      className="size-4 rounded-none border-border bg-muted/40 text-primary focus:ring-primary/20"
                    />
                    <label htmlFor={field.id} className="text-sm text-muted-foreground select-none">
                      {field.placeholder || 'Please check this box'}
                    </label>
                  </div>
                )}

                {/* File Field Rendering */}
                {field.field_type === 'file' && (
                  <div className="space-y-2">
                    {!values[field.id] ? (
                      <div className="flex items-center justify-center w-full animate-fadeIn">
                        <label
                          htmlFor={field.id}
                          className={`flex flex-col items-center justify-center w-full h-32 border border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 border-border hover:border-border transition-all ${
                            hasError ? 'border-red-500/70' : 'border-border'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2.5 text-muted-foreground" />
                            <p className="mb-1 text-sm text-muted-foreground">
                              <span className="font-semibold text-primary">Click to upload</span> or drag & drop
                            </p>
                            <p className="text-[10px] text-muted-foreground">PDF, Word, Images, etc. (Max 10MB)</p>
                          </div>
                          <input
                            id={field.id}
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileChange(field.id, e)}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border animate-scaleUp">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <File className="w-5 h-5 text-primary shrink-0 animate-pulse" />
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate font-medium">
                              {values[field.id].name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {(values[field.id].size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(field.id)}
                          className="p-1 rounded-none hover:bg-muted text-muted-foreground hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Error snippet */}
                {hasError && (
                  <div className="flex items-center gap-1.5 text-red-400 text-xs mt-1 animate-slideDown">
                    <AlertCircle className="size-3.5" />
                    <span>{errors[field.id]}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Form Actions */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 text-sm transition-all h-10 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting response...
                </>
              ) : (
                'Submit Form'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
