/**
 * Toggle the expansion state of a file in a file tree
 * @param fileHash - The hash/identifier of the file to toggle
 * @param expandedFiles - Set of currently expanded file hashes
 * @param setExpandedFiles - Function to update the expanded files set
 */
export function toggleFileExpansion(
  fileHash: string,
  expandedFiles: Set<string>,
  setExpandedFiles: (files: Set<string>) => void
) {
  const newExpanded = new Set(expandedFiles)
  if (newExpanded.has(fileHash)) {
    newExpanded.delete(fileHash)
  } else {
    newExpanded.add(fileHash)
  }
  setExpandedFiles(newExpanded)
}