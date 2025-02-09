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
	onProgress?: (progress: number) => void,
	onLog?: (message: string) => void
): Promise<Blob> {
	if (!ffmpeg) {
		throw new Error('FFmpeg not loaded');
	}

	const inputFileName = 'input' + getFileExtension(inputBlob.type);
	const outputFileName = `output.${outputFormat}`;

	await ffmpeg.writeFile(inputFileName, await fetchFile(inputBlob));

	ffmpeg.on('log', ({ message }) => {
		if (onLog) {
			onLog(message);
		}
	});

	ffmpeg.on('progress', ({ progress }) => {
		if (onProgress) {
			onProgress(Math.round(progress * 100));
		}
	});

	try {
		// Base FFmpeg arguments that are common for all formats
		const baseArgs = ['-i', inputFileName, '-map_metadata', '0', '-map', '0:a'];

		// Add video stream mapping only if it exists (for cover art)
		if (await hasVideoStream(inputFileName)) {
			baseArgs.push('-map', '0:v');
		}

		// Format-specific arguments
		const formatArgs = getFormatSpecificArgs(outputFormat);

		// Combine all arguments and add output filename
		const ffmpegArgs = [...baseArgs, ...formatArgs, outputFileName];

		console.log('FFmpeg arguments:', ffmpegArgs);
		const response = await ffmpeg.exec(ffmpegArgs);
		console.log('FFmpeg response:', response);

		const data = await ffmpeg.readFile(outputFileName);
		return new Blob([data], { type: `audio/${outputFormat}` });
	} catch (error) {
		console.error('Conversion error:', error);
		throw new Error(`Error converting to ${outputFormat}: ${error}`);
	}
}

async function hasVideoStream(inputFileName: string): Promise<boolean> {
	try {
		const info = await ffmpeg!.exec(['-i', inputFileName]);
		// Check if the output contains a video stream (attached pic)
		return info.toString().includes('Stream #0:1: Video');
	} catch (error) {
		// FFmpeg prints stream info to stderr, which causes an "error"
		// We actually want to check this error output
		const errorString = error.toString();
		return errorString.includes('Stream #0:1: Video');
	}
}

function getFormatSpecificArgs(format: string): string[] {
	const commonArgs = ['-c:a', getCodecForFormat(format)];

	switch (format) {
		case 'mp3':
			return [
				...commonArgs,
				'-write_id3v2',
				'1',
				'-id3v2_version',
				'3',
				'-ar',
				'44100',
				'-ac',
				'2'
			];

		case 'aiff':
			return [...commonArgs, '-c:v', 'copy', '-write_id3v2', '1'];

		case 'wav':
			return [...commonArgs, '-ar', '44100', '-ac', '2', '-rf64', 'auto'];

		case 'flac':
			return [...commonArgs, '-ar', '44100', '-ac', '2', '-compression_level', '8'];

		case 'ogg':
			return [...commonArgs, '-ar', '44100', '-ac', '2', '-q:a', '6'];

		case 'aac':
			return [...commonArgs, '-ar', '44100', '-ac', '2', '-b:a', '256k', '-f', 'adts'];

		default:
			return [...commonArgs, '-ar', '44100', '-ac', '2'];
	}
}

// Keep your existing helper functions
function getFileExtension(mimeType: string): string {
	const extensions: { [key: string]: string } = {
		'audio/mpeg': '.mp3',
		'audio/wav': '.wav',
		'audio/ogg': '.ogg',
		'audio/flac': '.flac',
		'audio/aiff': '.aiff',
		'audio/aac': '.aac'
	};
	return extensions[mimeType] || '';
}

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
