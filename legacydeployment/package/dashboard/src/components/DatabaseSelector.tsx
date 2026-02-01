import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Database, FolderOpen } from 'lucide-react';
import FileBrowser from './FileBrowser';
import { apiUrl } from '@/config';

interface DatabaseSelectorProps {
  currentDbPath: string;
  onDatabaseChange: (dbPath: string) => void;
}

export default function DatabaseSelector({ currentDbPath, onDatabaseChange }: DatabaseSelectorProps) {
  const [showBrowser, setShowBrowser] = useState(false);
  const [defaultDbPath, setDefaultDbPath] = useState<string>('');

  useEffect(() => {
    // Fetch user's default database path
    fetch(apiUrl('/api/files/default-db'), {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.dbPath) {
          setDefaultDbPath(data.dbPath);
          // If no current db path, use default
          if (!currentDbPath) {
            onDatabaseChange(data.dbPath);
          }
        }
      })
      .catch(err => console.error('Failed to fetch default database:', err));
  }, []);

  const handleSelectDatabase = (dbPath: string) => {
    onDatabaseChange(dbPath);
    localStorage.setItem('lastDatabasePath', dbPath);
  };

  const handleUseDefault = () => {
    if (defaultDbPath) {
      handleSelectDatabase(defaultDbPath);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(71, 85, 105, 0.3)',
      borderRadius: '8px'
    }}>
      <Database style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
          Current Database
        </div>
        <div style={{
          fontSize: '14px',
          color: '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {currentDbPath || 'No database selected'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {defaultDbPath && (
          <Button
            onClick={handleUseDefault}
            variant="outline"
            size="sm"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6'
            }}
          >
            Use Default
          </Button>
        )}
        <Button
          onClick={() => setShowBrowser(true)}
          variant="outline"
          size="sm"
          style={{
            backgroundColor: 'rgba(71, 85, 105, 0.2)',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FolderOpen style={{ width: '16px', height: '16px' }} />
          Browse
        </Button>
      </div>

      <FileBrowser
        open={showBrowser}
        onClose={() => setShowBrowser(false)}
        onSelect={handleSelectDatabase}
        title="Select Database File"
        fileFilter={(file) => !file.isDirectory && file.name.endsWith('.db')}
      />
    </div>
  );
}
