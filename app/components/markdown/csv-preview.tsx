'use client'
import React, { useMemo } from 'react';
import Papa from 'papaparse';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface CsvPreviewProps {
  content: string;
  options?: string;
}

export function CsvPreview({ content, options = '' }: CsvPreviewProps) {
  const parsedData = useMemo(() => {
    // Parse options from string like {header="true" delimiter=","}
    const optionPairs = options.match(/(\w+)="([^"]+)"/g) || [];
    const parseOptions: Papa.ParseConfig = {
      header: false,
      delimiter: ',',
    };

    optionPairs.forEach(pair => {
      const [key, value] = pair.split('=').map(s => s.replace(/"/g, ''));
      if (key === 'header') {
        parseOptions.header = value === 'true';
      } else if (key === 'delimiter') {
        parseOptions.delimiter = value;
      }
    });

    const result = Papa.parse(content.trim(), parseOptions);
    return result;
  }, [content, options]);

  if (parsedData.errors.length > 0) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error parsing CSV: {parsedData.errors[0].message}
        </AlertDescription>
      </Alert>
    );
  }

  const data = parsedData.data as string[][] | Record<string, string>[];
  if (data.length === 0) return null;

  // If header is true, data is an array of objects
  const hasHeader = parsedData.meta.fields !== undefined;
  const headers = hasHeader ? parsedData.meta.fields : null;
  const rows = hasHeader ? data : data;

  return (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full border-collapse">
        {hasHeader && headers && (
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="border border-border px-4 py-2 text-left bg-muted/50 font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-muted/20">
              {hasHeader ? (
                headers!.map((header, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-border px-4 py-2 text-left"
                  >
                    {(row as Record<string, string>)[header]}
                  </td>
                ))
              ) : (
                (row as string[]).map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-border px-4 py-2 text-left"
                  >
                    {cell}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}