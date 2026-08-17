export function formatVotingCountdown(deadline: Date): string {
  const msLeft = deadline.getTime() - Date.now();
  if (msLeft <= 0) return "Voting closed";
  const totalSecs = Math.floor(msLeft / 1_000);
  const totalMins = Math.floor(totalSecs / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const secs = totalSecs % 60;
  if (hours >= 24) {
    const month = deadline.toLocaleString("en-US", { month: "short" });
    const day = deadline.getDate();
    const hour12 = deadline.getHours() % 12 || 12;
    const ampm = deadline.getHours() < 12 ? "AM" : "PM";
    return `Closes ${month} ${day} at ${hour12} ${ampm}`;
  }
  if (hours > 0 && mins > 0) return `Closes in ${hours}h ${mins}m`;
  if (hours > 0) return `Closes in ${hours}h`;
  if (mins >= 5) return `Closes in ${mins}m`;
  if (mins > 0) return `Closes in ${mins}m ${secs}s`;
  return `Closes in ${secs}s`;
}
