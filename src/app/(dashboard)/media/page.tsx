"use client";

import { useEffect, useState, useRef } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, Image as ImageIcon, File, Upload, Trash2, ArrowLeft, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function MediaPage() {
  const { activeWorkspace } = useWorkspace();
  const [folders, setFolders] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<any | null>(null);
  const [folderHistory, setFolderHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      fetchMedia();
    }
  }, [activeWorkspace, currentFolder]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const parentId = currentFolder ? currentFolder.id : 'null';
      const res = await fetch(`/api/media?workspace_id=${activeWorkspace?.id}&parent_id=${parentId}`);
      if (!res.ok) throw new Error("Failed to load media");
      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const parentId = currentFolder ? currentFolder.id : null;
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspace?.id,
          name: newFolderName.trim(),
          parent_id: parentId
        })
      });
      if (!res.ok) throw new Error("Failed to create folder");
      toast.success("Folder created");
      setNewFolderName("");
      setIsFolderDialogOpen(false);
      fetchMedia();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeWorkspace) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspace_id", activeWorkspace.id);
    if (currentFolder) {
      formData.append("folder_id", currentFolder.id);
    }

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload file");
      toast.success("File uploaded");
      fetchMedia();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    try {
      const res = await fetch(`/api/media?file_id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete file");
      toast.success("File deleted");
      fetchMedia();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Delete this folder and all its contents?")) return;
    try {
      const res = await fetch(`/api/media?folder_id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete folder");
      toast.success("Folder deleted");
      fetchMedia();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const navigateIntoFolder = (folder: any) => {
    setFolderHistory([...folderHistory, currentFolder]);
    setCurrentFolder(folder);
  };

  const navigateUp = () => {
    if (folderHistory.length > 0) {
      const newHistory = [...folderHistory];
      const previous = newHistory.pop();
      setFolderHistory(newHistory);
      setCurrentFolder(previous);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="flex h-full flex-col p-8 bg-background">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {currentFolder && (
              <Button variant="ghost" size="icon" onClick={navigateUp} className="rounded-full">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Button>
            )}
            {currentFolder ? currentFolder.name : "Media Library"}
          </h1>
          <p className="text-slate-400 mt-1">
            Manage your workspace documents, images, and videos.
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
            <DialogTrigger render={<Button variant="outline" className="border-slate-800 text-slate-300" />}>
                <Folder className="w-4 h-4 mr-2" />
                New Folder
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-200">
              <DialogHeader>
                <DialogTitle>Create Folder</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateFolder} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Folder Name</Label>
                  <Input 
                    value={newFolderName} 
                    onChange={e => setNewFolderName(e.target.value)} 
                    placeholder="e.g. Invoices"
                    className="bg-slate-950 border-slate-800"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Create Folder
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl p-6 overflow-y-auto">
          {folders.length === 0 && files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <Folder className="w-16 h-16 text-slate-700" />
              <p>This folder is empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* Folders */}
              {folders.map(folder => (
                <div 
                  key={folder.id}
                  className="group flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-colors relative"
                  onDoubleClick={() => navigateIntoFolder(folder)}
                  onClick={() => navigateIntoFolder(folder)}
                >
                  <Folder className="w-12 h-12 text-blue-500/80 mb-3" fill="currentColor" />
                  <span className="text-sm font-medium text-slate-200 truncate w-full text-center">
                    {folder.name}
                  </span>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Files */}
              {files.map(file => (
                <div 
                  key={file.id}
                  className="group flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 hover:border-blue-900/30 rounded-xl transition-colors relative"
                >
                  <a href={file.local_path} target="_blank" rel="noreferrer" className="w-full flex flex-col items-center">
                    {file.mime_type?.startsWith('image/') ? (
                      <div className="w-16 h-16 mb-3 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={file.local_path} alt={file.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <File className="w-12 h-12 text-slate-400 mb-3" />
                    )}
                    <span className="text-sm font-medium text-slate-200 truncate w-full text-center hover:text-blue-400 transition-colors">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      {formatSize(file.file_size)}
                    </span>
                  </a>
                  
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteFile(file.id); }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
