import React, { useState } from 'react';
import { Upload } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (csvText: string) => Promise<void>;
  loading: boolean;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSubmit, loading }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    await onSubmit(csvText);
    setCsvFile(null);
    setCsvText('');
  };

  const handleFileChange = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>学生データCSV一括インポート</h3>
          <button className="btn btn-icon" onClick={onClose} style={{ border: 'none' }}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div className="form-group">
            <label>CSVファイル選択</label>
            <div
              className={`file-dropzone ${isDraggingFile ? 'dragging' : ''} ${csvFile ? 'has-file' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.name.endsWith('.csv')) {
                  handleFileChange(file);
                } else if (file) {
                  alert('CSVファイルのみ選択可能です。');
                }
              }}
              onClick={() => {
                document.getElementById('csv-file-input')?.click();
              }}
              style={{
                border: '2px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-base)',
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)',
                transition: 'var(--transition-smooth)',
              }}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileChange(file);
                  }
                }}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Upload size={24} style={{ color: 'var(--text-secondary)' }} />
                {csvFile ? (
                  <p style={{ margin: 0, fontWeight: 500, color: 'var(--accent-muted)' }}>{csvFile.name}</p>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    ここにCSVファイルをドラッグ＆ドロップ、<br />
                    またはクリックしてファイルを選択
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>または CSVデータを直接入力 (学籍番号,名前,親の誕生日MMdd)</label>
            <textarea
              className="form-control"
              rows={6}
              placeholder="00ZZ0000,電子太郎,0309&#10;REDACTED,電子次郎,0715"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !csvText.trim()}>
              {loading ? 'インポート中...' : '実行'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
