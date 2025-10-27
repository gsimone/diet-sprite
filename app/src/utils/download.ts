/**
 * Downloads content as a file in the browser
 * 
 * @param content The content to download (can be string, Blob, or object to be JSON stringified)
 * @param filename The name of the file to download
 * @param mimeType The MIME type of the file (default: "text/plain")
 */
export function downloadFile(
  content: string | Blob | object,
  filename: string,
  mimeType: string = "text/plain"
) {
  let blob: Blob;

  if (content instanceof Blob) {
    blob = content;
  } else if (typeof content === "object") {
    // Convert object to JSON string
    const jsonString = JSON.stringify(content, null, 2);
    blob = new Blob([jsonString], { type: mimeType });
  } else {
    // Assume string content
    blob = new Blob([content], { type: mimeType });
  }

  // Create download link and trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

