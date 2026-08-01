"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
  Printer,
  Eye,
  Download,
  CheckCircle2,
  Clock,
  Building,
  User,
  Plus
} from "lucide-react";

interface OfficialDocumentItem {
  id: string;
  document_number: string;
  title: string;
  recipient_name: string;
  recipient_email?: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Issued" | "Cancelled" | "Archived";
  issued_date: string;
  category_name?: string;
}

interface DocumentVaultTableProps {
  documents: OfficialDocumentItem[];
  loading?: boolean;
}

export function DocumentVaultTable({ documents, loading }: DocumentVaultTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.document_number.toLowerCase().includes(search.toLowerCase()) ||
      doc.recipient_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Issued":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Issued</Badge>;
      case "Approved":
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Approved</Badge>;
      case "Pending Approval":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Pending Approval</Badge>;
      case "Draft":
        return <Badge className="bg-muted text-muted-foreground">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 text-foreground">
      {/* Search & Status Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title, number, or recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {["ALL", "Issued", "Approved", "Pending Approval", "Draft"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader className="bg-muted/50 text-xs text-muted-foreground">
            <TableRow>
              <TableHead>Doc Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs divide-y divide-border/60">
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center p-8 text-muted-foreground">
                  <FileText className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                  <span>No official documents found.</span>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono font-bold text-foreground">
                    {doc.document_number}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {doc.title}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="size-3.5 text-muted-foreground" />
                      <span>{doc.recipient_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(doc.status)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{doc.issued_date}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Link href={`/documents/${doc.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:bg-primary/10">
                        <Eye className="size-3.5 mr-1" /> View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
