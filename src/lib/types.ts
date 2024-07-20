export type FileInfo = {
	id: string;
	name: string;
	size: number;
	type: string;
	lastModified: number;
	converted: boolean;
	blob: Blob;
};
