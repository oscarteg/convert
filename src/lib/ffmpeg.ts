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

	// toBlobURL is used to bypass CORS issue, urls with the same
	// domain can be used directly.
	await ffmpeg.load({
		coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
		wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
		workerURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript')
	});
}

export async function convertToAIFF(
	inputBlob: Blob,
	onProgress?: (message: string) => void
): Promise<Blob> {
	if (!ffmpeg) {
		if (onProgress) onProgress('Loading FFmpeg...');
		await loadFFmpeg(onProgress);
	}

	if (!ffmpeg) throw new Error('Failed to load FFmpeg');

	const inputFileName = 'input' + getFileExtension(inputBlob.type);
	const outputFileName = 'output.aiff';

	if (onProgress) onProgress('Writing input file...');
	await ffmpeg.writeFile(inputFileName, await fetchFile(inputBlob));

	if (onProgress) onProgress('Converting to AIFF...');
	await ffmpeg.exec(['-i', inputFileName, outputFileName]);

	if (onProgress) onProgress('Reading output file...');
	const data = await ffmpeg.readFile(outputFileName);

	if (onProgress) onProgress('Conversion complete');
	return new Blob([data], { type: 'audio/aiff' });
}

function getFileExtension(mimeType: string): string {
	const extensions: { [key: string]: string } = {
		'audio/mpeg': '.mp3',
		'audio/wav': '.wav',
		'audio/ogg': '.ogg',
		'audio/flac': '.flac'
		// Add more mime types and their corresponding extensions as needed
	};
	return extensions[mimeType] || '';
}
