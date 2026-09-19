export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function detectDelimiterFromContent(text: string): string {
  const samples = text.split('\n').slice(0, 5).filter(Boolean);
  if (!samples.length) return ',';
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0, '|': 0 };
  for (const line of samples) {
    counts[','] += (line.match(/,/g) || []).length;
    counts['\t'] += (line.match(/\t/g) || []).length;
    counts[';'] += (line.match(/;/g) || []).length;
    counts['|'] += (line.match(/\|/g) || []).length;
  }
  let best = ',';
  let bestCount = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}
