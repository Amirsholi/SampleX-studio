const DATABASE_NAME = "samplex-recordings";
const STORE_NAME = "recordings";
const LATEST_KEY = "latest";

export interface StoredRecording {
  blob: Blob;
  createdAt: number;
  sourceTitle: string;
}

export async function saveLatestRecording(recording: StoredRecording) {
  const database = await openDatabase();
  await requestToPromise(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(recording, LATEST_KEY));
  database.close();
}

export async function getLatestRecording(): Promise<StoredRecording | null> {
  const database = await openDatabase();
  const result = await requestToPromise(database.transaction(STORE_NAME).objectStore(STORE_NAME).get(LATEST_KEY));
  database.close();
  return (result as StoredRecording | undefined) ?? null;
}

export async function deleteLatestRecording() {
  const database = await openDatabase();
  await requestToPromise(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(LATEST_KEY));
  database.close();
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
