export function parsePauseDuration(text: string): number {
  const value = text.trim().toLowerCase();
  if (!value) return 0;
  const minutes = /^(\d+(?:[.,]\d+)?)\s*(?:min(?:uten)?|m)?$/.exec(value);
  if (minutes) return Math.round(Number(minutes[1].replace(",", ".")) * 60);
  const clock = /^(\d+):([0-5]\d)(?::([0-5]\d))?$/.exec(value);
  if (clock)
    return (
      Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] || 0)
    );
  throw Error("Bitte eine Pausendauer wie 45min oder 00:45:00 eingeben.");
}
