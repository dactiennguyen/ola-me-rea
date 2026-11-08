// Local 1-1 history. The server only keeps the last message per conversation
// (getLastMessage2 / addLastMessage5), so threads are what this device sent and
// received: one JSON file per signed-in account, chat-<uid>.json, with one key
// per thread (`thread:<peerUid>`) and per peer (`peer:<peerUid>`), so a write
// touches only that conversation. Writes to one file run one at a time.

import type { ChatMessage, ChatUser } from '@ola/core/chat.ts';
import { openJsonFile, type JsonFile } from './platform.ts';

const MAX_PER_THREAD = 500;
const THREAD = 'thread:';
const PEER = 'peer:';

interface PeerInfo { displayName: string; photoURL: string; }

const fileFor = (myUid: string) => openJsonFile(`chat-${myUid}.json`);

// Read-modify-write runs in order per file, so concurrent messages (inbox and
// an open chat) cannot overwrite each other.
const queues = new Map<string, Promise<unknown>>();

function serialized<T>(myUid: string, task: (file: JsonFile) => Promise<T>): Promise<T> {
  const previous = queues.get(myUid) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(async () => task(await fileFor(myUid)));
  queues.set(myUid, run);
  return run;
}

export async function loadThread(myUid: string, peerUid: string): Promise<ChatMessage[]> {
  return (await (await fileFor(myUid)).get<ChatMessage[]>(THREAD + peerUid)) ?? [];
}

export async function loadThreadPeers(myUid: string): Promise<Record<string, { last: ChatMessage; peer?: PeerInfo }>> {
  const file = await fileFor(myUid);
  const [threads, peers] = await Promise.all([
    file.entries<ChatMessage[]>(THREAD),
    file.entries<PeerInfo>(PEER),
  ]);
  const peerBy = new Map(peers.map(([key, info]) => [key.slice(PEER.length), info]));
  const out: Record<string, { last: ChatMessage; peer?: PeerInfo }> = {};
  for (const [key, messages] of threads) {
    const uid = key.slice(THREAD.length);
    const last = messages.at(-1);
    if (last) out[uid] = { last, peer: peerBy.get(uid) };
  }
  return out;
}

/** Merges messages into a thread by id, keeps time order, trims to the newest 500. */
export function appendThread(myUid: string, peerUid: string, messages: ChatMessage[]): Promise<ChatMessage[]> {
  return serialized(myUid, async file => {
    const existing = (await file.get<ChatMessage[]>(THREAD + peerUid)) ?? [];
    const merged = mergeMessages(existing, messages).slice(-MAX_PER_THREAD);
    await file.set(THREAD + peerUid, merged);
    await file.save();
    return merged;
  });
}

export function rememberPeer(myUid: string, user: ChatUser): Promise<void> {
  if (!user.displayName && !user.photoURL) return Promise.resolve();
  return serialized(myUid, async file => {
    await file.set(PEER + user.uid, { displayName: user.displayName, photoURL: user.photoURL } satisfies PeerInfo);
    await file.save();
  });
}

type LocalMessageListener = (myUid: string, peerUid: string, message: ChatMessage) => void;
const localMessageListeners = new Set<LocalMessageListener>();

/** A message this app sent from outside the chat screen (Tự trả lời), already in the thread. */
export function onLocalMessage(listener: LocalMessageListener): () => void {
  localMessageListeners.add(listener);
  return () => { localMessageListeners.delete(listener); };
}

export function publishLocalMessage(myUid: string, peerUid: string, message: ChatMessage): void {
  for (const listener of localMessageListeners) listener(myUid, peerUid, message);
}

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(existing.map(m => [m.id, m]));
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m });
  return [...byId.values()].sort((a, b) => a.at - b.at);
}
