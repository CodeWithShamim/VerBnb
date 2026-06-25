// Client-side helper that uploads an evidence file to IPFS through our server
// route (which holds the Pinata JWT). Returns the public gateway URL.

export interface UploadResult {
  cid: string;
  url: string;
}

export async function uploadEvidence(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);

    // XMLHttpRequest is used (not fetch) so we can report upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          onProgress?.(100);
          resolve({ cid: data.cid, url: data.url });
        } else {
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      } catch (err) {
        reject(new Error("Invalid response from upload service"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}
