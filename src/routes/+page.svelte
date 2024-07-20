<script lang="ts">
	import { onMount } from 'svelte';
	import type { FileInfo } from '$lib/types';
	import { initIndexedDB, addFile, getFiles, updateFile } from '$lib/db';
	import { loadFFmpeg, convertToAIFF } from '$lib/ffmpeg';

	let files: FileInfo[] = [];
	let dragActive = false;
	let conversionProgress = '';
	let isLoading = false;

	onMount(async () => {
		isLoading = true;
		await initIndexedDB();
		files = await getFiles();
		await loadFFmpeg((message) => {
			conversionProgress = message;
		});
		isLoading = false;
	});

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragActive = false;

		if (e.dataTransfer?.files) {
			for (const file of e.dataTransfer.files) {
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
				files = [...files, fileInfo];
			}
		}
	}

	async function convertAllFiles() {
		for (const file of files) {
			if (!file.converted) {
				conversionProgress = `Converting ${file.name}...`;
				try {
					const convertedBlob = await convertToAIFF(file.blob, (message) => {
						conversionProgress = `${file.name}: ${message}`;
					});
					const updatedFile: FileInfo = {
						...file,
						converted: true,
						blob: convertedBlob,
						type: 'audio/aiff',
						name: file.name.replace(/\.[^/.]+$/, '.aiff')
					};
					await updateFile(updatedFile);
					files = files.map((f) => (f.id === file.id ? updatedFile : f));
				} catch (error) {
					conversionProgress = `Error converting ${file.name}: ${error.message}`;
				}
			}
		}
		conversionProgress = 'All conversions complete';
	}
</script>

<div>
	{#if isLoading}
		<p>Loading application...</p>
	{:else}
		<div
			class="drop-zone"
			class:active={dragActive}
			on:dragenter={() => (dragActive = true)}
			on:dragleave={() => (dragActive = false)}
			on:dragover|preventDefault
			on:drop|preventDefault={handleDrop}
		>
			<p>Drag and drop files here</p>
		</div>

		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Size</th>
					<th>Type</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{#each files as file}
					<tr>
						<td>{file.name}</td>
						<td>{file.size} bytes</td>
						<td>{file.type}</td>
						<td>{file.converted ? 'Converted' : 'Not converted'}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<button on:click={convertAllFiles}>Convert All Files to AIFF</button>

		{#if conversionProgress}
			<p>{conversionProgress}</p>
		{/if}
	{/if}
</div>

<style>
	.drop-zone {
		border: 2px dashed #ccc;
		border-radius: 4px;
		padding: 20px;
		text-align: center;
		cursor: pointer;
	}

	.drop-zone.active {
		border-color: #000;
		background-color: #f0f0f0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 20px;
	}

	th,
	td {
		border: 1px solid #ccc;
		padding: 8px;
		text-align: left;
	}

	button {
		margin-top: 20px;
		padding: 10px 20px;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #0056b3;
	}
</style>
