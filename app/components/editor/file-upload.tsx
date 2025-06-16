"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onUpload: (files: File[]) => void;
  className?: string;
}

export function FileUpload({ onUpload, className }: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onUpload(acceptedFiles);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/pdf": [".pdf"],
      "text/*": [".txt", ".md"],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2">
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop the files here..."
            : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground">
          Supports images, PDFs, and text files
        </p>
      </div>
    </div>
  );
}