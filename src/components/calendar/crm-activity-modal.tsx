"use client";

import React, { useState, useEffect } from 'react';
import type { CRMActivity, CRMActivityType } from '@/types/calendar';
import { X, Calendar, User, Building, Briefcase, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CRMActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activityData: Partial<CRMActivity>) => void;
  initialActivity?: CRMActivity | null;
}

const CRM_TYPES: { type: CRMActivityType; label: string }[] = [
  { type: 'meeting', label: 'Client Meeting' },
  { type: 'call', label: 'Phone Call' },
  { type: 'followup', label: 'Follow-up' },
  { type: 'task', label: 'Task' },
  { type: 'appointment', label: 'Appointment' },
  { type: 'deal', label: 'Deal Activity' },
  { type: 'reminder', label: 'Reminder' },
];

export function CRMActivityModal({
  isOpen,
  onClose,
  onSave,
  initialActivity,
}: CRMActivityModalProps) {
  const [type, setType] = useState<CRMActivityType>('meeting');
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dealName, setDealName] = useState('');
  const [date, setDate] = useState('2026-08-25');
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialActivity) {
      setType(initialActivity.type || 'meeting');
      setTitle(initialActivity.title || '');
      setContactName(initialActivity.contactName || '');
      setCompanyName(initialActivity.companyName || '');
      setDealName(initialActivity.dealName || '');
      setDate(initialActivity.date || '2026-08-25');
      setTime(initialActivity.time || '10:00');
      setNotes(initialActivity.notes || '');
    } else {
      setType('meeting');
      setTitle('');
      setContactName('');
      setCompanyName('');
      setDealName('');
      setDate('2026-08-25');
      setTime('10:00');
      setNotes('');
    }
  }, [initialActivity, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter an activity title.');
      return;
    }

    onSave({
      type,
      title,
      contactName: contactName.trim() || undefined,
      companyName: companyName.trim() || undefined,
      dealName: dealName.trim() || undefined,
      date: date || undefined,
      time: time || '10:00',
      notes: notes.trim() || undefined,
      status: 'upcoming',
    });

    onClose();
    toast.success('CRM activity created successfully!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6 bg-muted/20">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              {initialActivity ? 'Edit CRM Activity' : 'New CRM Activity'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Activity Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CRMActivityType)}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CRM_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Q4 Growth Strategy Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-xl font-bold text-xs"
            />
          </div>

          {/* Contact & Company */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Contact Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Sarah Jenkins"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Company / Organization
              </label>
              <Input
                type="text"
                placeholder="e.g. ABC Corporation"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Deal Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Deal Pipeline Link
            </label>
            <Input
              type="text"
              placeholder="e.g. Enterprise SaaS Renewal"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Activity Date
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Activity Time
              </label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Notes & Action Items
            </label>
            <Textarea
              rows={3}
              placeholder="Add agenda items, meeting notes, or follow-up details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md"
            >
              Save CRM Activity
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
