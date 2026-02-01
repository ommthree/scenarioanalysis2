import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, File, ChevronRight, Home } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  absolutePath?: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

interface FileBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (filePath: string) => void;
  title?: string;
  fileFilter?: (file: FileEntry) => boolean;
}

export default function FileBrowser({
  open,
  onClose,
  onSelect,
  title = 'Select File',
  fileFilter
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDirectory, setUserDirectory] = useState<string>('');

  // Load files when path changes
  useEffect(() => {
    if (open) {
      loadFiles(currentPath);
    }
  }, [open, currentPath]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const queryParam = path ? `?path=${encodeURIComponent(path)}` : '';
      const response = await fetch(`/api/files/browse${queryParam}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load files');
      }

      const data = await response.json();
      setFiles(data.files || []);
      setUserDirectory(data.userDirectory || '');
    } catch (err) {
      console.error('Failed to load files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (file: FileEntry) => {
    if (file.isDirectory) {
      setCurrentPath(file.path);
    } else {
      // Use absolute path if available, otherwise relative path
      onSelect(file.absolutePath || file.path);
      onClose();
    }
  };

  const handleGoUp = () => {
    if (currentPath) {
      const parentPath = currentPath.split('/').slice(0, -1).join('/');
      setCurrentPath(parentPath);
    }
  };

  const handleGoHome = () => {
    setCurrentPath('');
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredFiles = fileFilter ? files.filter(fileFilter) : files;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoHome}
            disabled={!currentPath}
          >
            <Home className="w-4 h-4" />
          </Button>
          {currentPath && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoUp}
              >
                ← Up
              </Button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </>
          )}
          <div className="flex-1 text-sm text-muted-foreground truncate">
            {currentPath || 'Home'}
          </div>
        </div>

        {/* File List */}
        <div className="overflow-auto" style={{ maxHeight: '400px' }}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">{error}</div>
            </div>
          )}

          {!loading && !error && filteredFiles.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">No files found</div>
            </div>
          )}

          {!loading && !error && filteredFiles.length > 0 && (
            <div className="space-y-1">
              {filteredFiles.map((file) => (
                <div
                  key={file.path}
                  onClick={() => handleNavigate(file)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex-shrink-0">
                    {file.isDirectory ? (
                      <Folder className="w-5 h-5 text-blue-500" />
                    ) : (
                      <File className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{file.name}</div>
                    {!file.isDirectory && (
                      <div className="text-xs text-muted-foreground">
                        {formatSize(file.size)} • {formatDate(file.modified)}
                      </div>
                    )}
                  </div>
                  {file.isDirectory && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            {userDirectory && `Directory: ${userDirectory}`}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
