// src/lib/ffmpegUtils.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

const BASE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

export async function loadFFmpeg(onProgress?: (message: string) => void): Promise<void> {
	if (ffmpeg) return;

	ffmpeg = new FFmpeg();

	if (onProgress) {
		ffmpeg.on('log', ({ message }) => {
			onProgress(message);
		});
	}

	await ffmpeg.load({
		coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
		wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
		workerURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript')
	});
}

export async function convertAudioFormat(
	inputBlob: Blob,
	outputFormat: string,
	onProgress?: (progress: number) => void
): Promise<Blob> {
	if (!ffmpeg) {
		throw new Error('FFmpeg not loaded');
	}

	const inputFileName = 'input' + getFileExtension(inputBlob.type);
	const outputFileName = `output.${outputFormat}`;

	await ffmpeg.writeFile(inputFileName, await fetchFile(inputBlob));

	ffmpeg.on('progress', ({ progress }) => {
		if (onProgress) {
			onProgress(Math.round(progress * 100));
		}
	});

	// Add -map_metadata 0 to preserve metadata
	await ffmpeg.exec([
		'-i',
		inputFileName,
		'-map_metadata',
		'0',
		'-c:a',
		getCodecForFormat(outputFormat), // Get the appropriate codec
		outputFileName
	]);

	const data = await ffmpeg.readFile(outputFileName);
	return new Blob([data], { type: `audio/${outputFormat}` });
}

function getFileExtension(mimeType: string): string {
	const extensions: { [key: string]: string } = {
		'audio/mpeg': '.mp3',
		'audio/wav': '.wav',
		'audio/ogg': '.ogg',
		'audio/flac': '.flac',
		'audio/aiff': '.aiff'
		// Add more mime types and their corresponding extensions as needed
	};
	return extensions[mimeType] || '';
}

// Helper function to get the appropriate codec for each format
function getCodecForFormat(format: string): string {
	const codecMap: { [key: string]: string } = {
		mp3: 'libmp3lame',
		aac: 'aac',
		ogg: 'libvorbis',
		flac: 'flac',
		wav: 'pcm_s16le',
		aiff: 'pcm_s16be'
	};

	return codecMap[format] || format;
}

export const supportedFormats = ['mp3', 'wav', 'ogg', 'flac', 'aiff', 'aac'];
