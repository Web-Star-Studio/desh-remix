import { useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "preparing" | "hashing" | "uploading" | "confirming" | "done" | "error" | "duplicate" | "validating";
  error?: string;
}

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  uploads: Record<string, UploadProgress>;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

const FileUploadZone = ({ onFilesSelected, uploads, disabled, compact, className }: FileUploadZoneProps) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected, disabled]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) onFilesSelected(files);
      e.target.value = "";
    },
    [onFilesSelected]
  );

  const uploadEntries = Object.entries(uploads);
  const hasActiveUploads = uploadEntries.length > 0;

  return (
    <div className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer
          flex flex-col items-center justify-center gap-2 text-center min-h-[120px]
          ${dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/50 hover:border-primary/50 hover:bg-muted/30"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <Upload className={`w-6 h-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm text-muted-foreground">
          {dragOver ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para fazer upload"}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>

      <AnimatePresence>
        {hasActiveUploads && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2"
          >
            {uploadEntries.map(([id, u]) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm"
              >
                {u.status === "done" ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                ) : u.status === "error" ? (
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                )}
                <span className="truncate flex-1 text-foreground">{u.fileName}</span>
                <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUploadZone;
