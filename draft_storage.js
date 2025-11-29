const DRAFT_KEY = 'absher_secure_draft';

async function saveDraft(data) {
    const payload = { ...data, timestamp: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    return payload.timestamp;
}

async function loadDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
}

async function removeDraft() {
    localStorage.removeItem(DRAFT_KEY);
}
