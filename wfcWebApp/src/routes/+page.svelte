<script lang="ts">
	import welcome from '$lib/images/svelte-welcome.webp';
	import welcome_fallback from '$lib/images/svelte-welcome.png';
	import { WfcModel } from '$lib/waveFunctionAlgorithm';
	import type { jsonRules } from '$lib/waveFunctionAlgorithm';
	//import * as rules from '$lib/tilesets/tileset1/rules.json';
	import type { PngDataArray } from 'fast-png';

	function generateOutput() {

		const rules : jsonRules = [
    {
        "Path" : "tilesets/tileset1/tiles/b_half.png",
        "Weight" : 1,
        "Rules" : [
            [ 1, 3, 4, 6 ],
            [ 0, 1, 2, 7 ],
            [ 4, 5, 6, 7 ],
            [ 0, 1, 6, 7 ]
        ]
    },
    {
        "Path" : "tilesets/tileset1/tiles/b_i.png",
        "Weight" : 1,
        "Rules" : [
            [ 1, 3, 4, 6 ],
            [ 0, 1, 2, 7 ],
            [ 0, 1, 2, 3 ],
            [ 0, 1, 6, 7 ]
        ]
    },
    {
        "Path" : "tilesets/tileset1/tiles/b_quarter.png",
        "Weight" : 1,
        "Rules" : [
            [ 1, 3, 4, 6 ],
            [ 3, 4, 5, 6 ],
            [ 4, 5, 6, 7 ],
            [ 0, 1, 6, 7 ]
        ]
    },
    {
        "Path" : "tilesets/tileset1/tiles/b.png",
        "Weight" : 1,
        "Rules" : [
            [ 1, 3, 4, 6 ],
            [ 3, 4, 5, 6 ],
            [ 0, 1, 2, 3 ],
            [ 2, 3, 4, 5 ]
        ]
    },
    {
        "Path" : "tilesets/tileset1/tiles/w_half.png",
        "Weight" : 1,
        "Rules" : [
            [ 0, 2, 5, 7 ],
            [ 3, 4, 5, 6 ],
            [ 0, 1, 2, 3 ],
            [ 2, 3, 4, 5 ]
        ]
    },
    {
        "Path" : "tilesets/tileset1/tiles/w_i.png",
        "Weight" : 1,
        "Rules" : [
            [ 0, 2, 5, 7 ],
            [ 3, 4, 5, 6 ],
            [ 4, 5, 6, 7 ],
            [ 2, 3, 4, 5 ]
        ]
    },
    {
        "Path" : "tilesets/tileset1/tiles/w_quarter.png",
        "Weight" : 1,
        "Rules" : [
            [ 0, 2, 5, 7 ],
            [ 0, 1, 2, 7 ],
            [ 0, 1, 2, 3 ],
            [ 2, 3, 4, 5 ]
        ]
    },
    {
        "Path" : "tilesets/tileset1/tiles/w.png",
        "Weight" : 1,
        "Rules" : [
            [ 0, 2, 5, 7 ],
            [ 0, 1, 2, 7 ],
            [ 4, 5, 6, 7 ],
            [ 0, 1, 6, 7 ]
        ]
    }
]

		const model : WfcModel = new WfcModel(rules, [10, 10]);

		model.collapse();

		model.getResultAsEncodedPNG().then(e => {

			let blob = new Blob([e as PngDataArray], {type: 'image/png'});
			let img = new Image();
			img.src = URL.createObjectURL(blob);

			document.getElementById("imageDisplay")?.appendChild(img);
		});
	}
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	<h1>
		COLLAPSE THE FUNCTION WAVE
	</h1>

	<h2>
		<button on:click={ generateOutput }>Generate an Image</button>
	</h2>

	<div id="imageDisplay">Image</div>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}

	h1 {
		width: 100%;
	}

	.welcome {
		display: block;
		position: relative;
		width: 100%;
		height: 0;
		padding: 0 0 calc(100% * 495 / 2048) 0;
	}

	.welcome img {
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		display: block;
	}
</style>
