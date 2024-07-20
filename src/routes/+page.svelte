<script lang="ts">
	import { onMount } from 'svelte';
	import type { FileInfo } from '$lib/types';
	import { initIndexedDB, addFile, getFiles, updateFile } from '$lib/db';
	import { loadFFmpeg, convertAudioFormat, supportedFormats } from '$lib/ffmpeg';

	let files: FileInfo[] = [];
	let dragActive = false;
	let conversionProgress: { [key: string]: number } = {};
	let isLoading = false;
	let selectedFormats: { [key: string]: string } = {};

	onMount(async () => {
		isLoading = true;
		await initIndexedDB();
		files = await getFiles();
		files.forEach((file) => {
			selectedFormats[file.id] = file.converted ? getFileExtension(file.type).slice(1) : 'flac';
		});
		await loadFFmpeg();
		isLoading = false;
	});

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			await addFiles(input.files);
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragActive = false;
		if (e.dataTransfer?.files) {
			await addFiles(e.dataTransfer.files);
		}
	}

	async function addFiles(fileList: FileList) {
		for (const file of fileList) {
			const fileInfo: FileInfo = {
				id: crypto.randomUUID(),
				name: file.name,
				size: file.size,
				type: file.type,
				lastModified: file.lastModified,
				converted: false,
				blob: file
			};
			await addFile(fileInfo);
			selectedFormats[fileInfo.id] = 'flac';
			files = [...files, fileInfo];
		}
	}

	async function convertFile(file: FileInfo) {
		if (!file.converted) {
			conversionProgress[file.id] = 0;
			try {
				const outputFormat = selectedFormats[file.id];
				const convertedBlob = await convertAudioFormat(file.blob, outputFormat, (progress) => {
					conversionProgress[file.id] = progress;
					conversionProgress = { ...conversionProgress };
				});
				const updatedFile: FileInfo = {
					...file,
					converted: true,
					blob: convertedBlob,
					type: `audio/${outputFormat}`,
					name: file.name.replace(/\.[^/.]+$/, `.${outputFormat}`)
				};
				await updateFile(updatedFile);
				files = files.map((f) => (f.id === file.id ? updatedFile : f));
			} catch (error) {
				console.error(`Error converting ${file.name}:`, error);
			}
		}
	}

	function downloadFile(file: FileInfo) {
		const url = URL.createObjectURL(file.blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = file.name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function downloadAllConverted() {
		files.filter((f) => f.converted).forEach(downloadFile);
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
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
</script>

<div class="max-w-2xl mx-auto mt-8 p-4">
	{#if isLoading}
		<p class="text-center">Loading application...</p>
	{:else}
		<div
			class="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors"
			class:border-gray-400={dragActive}
			on:dragenter={() => (dragActive = true)}
			on:dragleave={() => (dragActive = false)}
			on:dragover|preventDefault
			on:drop|preventDefault={handleDrop}
			on:click={() => document.getElementById('fileInput').click()}
		>
			<p class="text-gray-500">Drag & drop or click to select</p>
			<input
				id="fileInput"
				type="file"
				multiple
				accept="audio/*"
				class="hidden"
				on:change={handleFileSelect}
			/>
		</div>

		{#if files.length > 0}
			<div class="mt-8">
				<div class="flex justify-between items-center mb-2">
					<h2 class="text-lg font-semibold">Your files</h2>
					<button
						on:click={downloadAllConverted}
						class="text-blue-600 hover:underline flex items-center"
					>
						Download all converted files
						<svg
							class="w-4 h-4 ml-1"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 14l-7 7m0 0l-7-7m7 7V3"
							></path>
						</svg>
					</button>
				</div>
				<table class="w-full">
					<thead>
						<tr class="text-left text-gray-500">
							<th class="py-2">File</th>
							<th class="py-2">Size</th>
							<th class="py-2">Format</th>
							<th class="py-2">%</th>
							<th class="py-2">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each files as file}
							<tr class="border-t border-gray-200">
								<td class="py-2 flex items-center">
									<svg
										class="w-4 h-4 mr-2 text-gray-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
										></path>
									</svg>
									{file.name}
								</td>
								<td class="py-2">{formatFileSize(file.size)}</td>
								<td class="py-2">
									<select
										bind:value={selectedFormats[file.id]}
										class="p-1 border border-gray-300 rounded-md"
										disabled={file.converted}
									>
										{#each supportedFormats as format}
											<option value={format}>{format}</option>
										{/each}
									</select>
								</td>
								<td class="py-2"
									>{conversionProgress[file.id] ? Math.round(conversionProgress[file.id]) : 0}%</td
								>
								<td class="py-2">
									{#if file.converted}
										<button
											on:click={() => downloadFile(file)}
											class="text-blue-600 hover:underline"
										>
											Download
										</button>
									{:else}
										<button
											on:click={() => convertFile(file)}
											class="bg-black text-white px-2 py-1 rounded-md hover:bg-gray-800 transition-colors text-sm"
										>
											Convert
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
