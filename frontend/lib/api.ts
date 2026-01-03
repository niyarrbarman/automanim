export async function generateCode(baseUrl: string, body: { session_id: string; prompt: string; }) {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to generate code');
  return res.json();
}

export async function renderVideo(baseUrl: string, body: any) {
  const res = await fetch(`${baseUrl}/api/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to render');
  return res.json();
}

export async function getMediaList(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/media/list`);
  if (!res.ok) throw new Error('Failed to list media');
  return res.json();
}

export async function setSettings(baseUrl: string, sessionId: string, settings: any) {
  const res = await fetch(`${baseUrl}/api/settings/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to set settings');
  return res.json();
}

export async function getSettings(baseUrl: string, sessionId: string) {
  const res = await fetch(`${baseUrl}/api/settings/${sessionId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function resetSession(baseUrl: string, sessionId: string) {
  const res = await fetch(`${baseUrl}/api/reset/${sessionId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset session');
  return res.json();
}
