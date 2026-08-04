"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AiSummaryModalProps {
  conversationId: string;
}

export function AiSummaryModal({ conversationId }: AiSummaryModalProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function fetchSummary() {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/summarize`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error("[AiSummaryModal] Error:", err);
      toast.error(`Summary failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (newOpen && !summary && !loading) {
      void fetchSummary();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Generate AI executive summary of this chat"
          />
        }
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">AI Summarize</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              Chat Summary (Groq AI)
            </span>
            {summary && !loading && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void fetchSummary()}
                title="Regenerate summary"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 min-h-[160px] rounded-lg border bg-muted/50 p-4 text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap">
          {loading ? (
            <div className="flex h-36 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Analyzing conversation history via Groq Llama 3...</p>
            </div>
          ) : summary ? (
            summary
          ) : (
            <div className="flex h-36 flex-col items-center justify-center text-muted-foreground">
              <p className="text-xs">Click regenerate to load summary.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
