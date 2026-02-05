/**
 * Google Drive file downloader
 * Handles both small files and large files requiring confirmation
 */

export async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const exportUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(exportUrl, { redirect: "follow" });

  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";

  // Large files return HTML with a confirmation link
  if (contentType.includes("text/html")) {
    const html = await res.text();
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
    if (confirmMatch) {
      const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`;
      const res2 = await fetch(confirmUrl, { redirect: "follow" });
      if (!res2.ok) {
        throw new Error(`Drive confirm download failed: ${res2.status}`);
      }
      return Buffer.from(await res2.arrayBuffer());
    }
    throw new Error("Got HTML instead of file data");
  }

  return Buffer.from(await res.arrayBuffer());
}
