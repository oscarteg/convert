// src/lib/indexedDB.ts
import type { FileInfo } from './types';

let db: IDBDatabase;

export async function initIndexedDB(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('FileConverterDB', 1);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			db = request.result;
			resolve();
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			db.createObjectStore('files', { keyPath: 'id' });
		};
	});
}

export async function addFile(file: FileInfo): Promise<void> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['files'], 'readwrite');
		const store = transaction.objectStore('files');
		const request = store.add(file);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function getFiles(): Promise<FileInfo[]> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['files'], 'readonly');
		const store = transaction.objectStore('files');
		const request = store.getAll();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
	});
}

export async function updateFile(file: FileInfo): Promise<void> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['files'], 'readwrite');
		const store = transaction.objectStore('files');
		const request = store.put(file);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function clearFiles(): Promise<void> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['files'], 'readwrite');
		const store = transaction.objectStore('files');
		const request = store.clear();
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}
